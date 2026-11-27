// KILLTOY 2: QUEST 1 "FIRST SONG" (Eman, 7 Nov 2026). The first of the card quests: a n00b makes a
// short song in the real playground, guided by the avatar in the corner, and wins TOY MACHINE.
// - Starts from the CARDS tab (PLAY QUEST), from the page address #quest, or KT2Quest.start().
// - First a level question (N00B / BEATMAKER / PRO; only N00B is built), then a starter project
//   "NIGHT SHIFT" (140 BPM) starts fully empty: the person picks the key and makes every pattern.
// - Each moment is checked from the real commands (window.run), never from clicks on our own UI,
//   so the person does the thing themselves. The avatar rises and talks, a ring shows where.
// - +10 / +25 / +100 pops where you clicked, coins in the top bar; at the end the coins fly into
//   the CARDS score one by one (tick, tick, chime) and then the TOY MACHINE card flips.
// Plan: Claude doc "KILLTOY Missions". KT2_QUEST_OFF hides the entry points. ASCII only, like ui/.
// QUEST 2 "BUILD IT UP" (Eman, 7 Nov 14:17): the quest 1 song gets TOY MACHINE on the chords, MAKE UNIQUE intro chords,
// the melody out of the intro, a TOY MACHINE bassline at bar 5 and a cutoff that opens over bars 1-4. KT2Quest.start(false, 1)
// or #quest2. Quest 1 plays on TOY KEYS once that plugin is in (KT2Pick.SYNTHS has builtin:toykeys), else TOY MACHINE.
"use strict";

(function () {
  const html = document.documentElement;
  if (!html.classList.contains("kt2") || window.KT2_QUEST_OFF) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const H = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  // while the quest goes back a step (halt), a step that's still waiting stops instead of carrying on
  let halt = false;
  const wait = (ms) => new Promise((r, j) => setTimeout(() => (halt ? j(new Error("quest stopped")) : r()), ms));
  const rawWait = (ms) => new Promise((r) => setTimeout(r, ms));
  // V5p: the old way, where the move is shown first and you watch before you may press
  const showFirst = () => !!(window.KT2_QUEST_SHOW_FIRST || window.KT2_QUEST_R2_LOOK);
  const snd = (name, a) => { try { window.KT2Juice && KT2Juice.sound[name] && KT2Juice.sound[name](a); } catch (e) { /* quiet */ } };

  const css = H("style");
  css.textContent = `
  .kq-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; font-family: Inter, system-ui, sans-serif; }
  .kq-hud { position: fixed; top: calc(var(--k2-head, 52px) + 1px); left: 50%; transform: translateX(-50%); padding: 4px 10px !important; display: flex; align-items: center; gap: 14px;
    background: #141417; border: 1px solid #2c2c33; padding: 7px 12px; pointer-events: auto; box-shadow: 0 8px 30px rgba(0,0,0,.5); }
  .kq-hud b { font: 800 11px Inter, sans-serif; letter-spacing: .18em; color: #fff; }
  .kq-hud .kq-step { font: 600 10px Inter, sans-serif; letter-spacing: .14em; color: #c9a8ff; min-width: 120px; }
  .kq-pips { display: flex; gap: 4px; }
  .kq-pips i { width: 14px; height: 6px; background: #2c2c33; }
  .kq-pips i.done { background: #9b5cff; }
  .kq-pips i.now { background: #fff; animation: kq-blink 1s infinite; }
  @keyframes kq-blink { 50% { opacity: .35; } }
  .kq-coins { display: flex; align-items: center; gap: 6px; font: 800 14px Inter, sans-serif; color: #fff; font-variant-numeric: tabular-nums; }
  .kq-coin { width: 12px; height: 12px; border-radius: 50%; background: #c9a8ff; box-shadow: inset 0 0 0 2px #9b5cff, 0 0 8px rgba(155,92,255,.8); }
  .kq-x { background: none; border: 1px solid #2c2c33; color: #8a8a96; font: 600 9px Inter, sans-serif; letter-spacing: .14em; padding: 4px 7px; cursor: pointer; }
  .kq-x:hover { color: #fff; border-color: #fff; }
  .kq-bub { position: fixed; right: 170px; bottom: 120px; max-width: 360px; background: #1a1a1f; border: 1px solid #c9a8ff; color: #fff;
    padding: 14px 16px; font: 500 15px/1.45 Inter, sans-serif; pointer-events: auto; box-shadow: 0 10px 40px rgba(0,0,0,.6);
    transform-origin: 100% 100%; animation: kq-in .25s cubic-bezier(.2,.9,.25,1); }
  .kq-bub::after { content: ""; position: absolute; right: -9px; bottom: 26px; width: 16px; height: 16px; background: #1a1a1f;
    border-right: 1px solid #c9a8ff; border-top: 1px solid #c9a8ff; transform: rotate(45deg); }
  .kq-bub:not(:has(button)) { pointer-events: none; }
  .kq-bub.kq-hi { bottom: auto; top: 96px; right: 56px; }
  .kq-bub.kq-hi::after { display: none; }
  .kq-bub .kq-btns { display: flex; gap: 8px; margin-top: 12px; }
  .kq-bub button { white-space: nowrap; }
  .kq-bub button { background: #9b5cff; color: #fff; border: 0; font: 800 11px Inter, sans-serif; letter-spacing: .14em; padding: 8px 12px; cursor: pointer; }
  .kq-bub button.q { background: none; border: 1px solid #3a3a44; color: #aaa; }
  @keyframes kq-in { from { opacity: 0; transform: translateY(10px) scale(.96); } }
  html.kq-on .kt-ai { transition: transform .35s cubic-bezier(.2,.9,.25,1); transform-origin: 100% 100%; }
  html.kq-on.kq-talk .kt-ai { transform: translateY(-14px) scale(1.18); }
  html.kq-on .kt-ai .kt-bub { display: none !important; }
  html.kq-on .kt-ai { z-index: 2147483001 !important; }
  .kq-ring { position: fixed; z-index: 60; border: 2px solid #c9a8ff; box-shadow: 0 0 0 4px rgba(155,92,255,.25), 0 0 24px rgba(155,92,255,.6);
    pointer-events: none; animation: kq-ring 1.1s ease-in-out infinite; transition: left .2s, top .2s, width .2s, height .2s; box-sizing: border-box; }
  .kq-cur { position: fixed; z-index: 61; width: 0; height: 0; pointer-events: none; transition: left .25s, top .25s; }
  .kq-cur svg { position: absolute; left: -3px; top: -2px; filter: drop-shadow(0 2px 6px rgba(0,0,0,.6)); animation: kq-press 1.4s ease-in-out infinite; transform-origin: 0 0; }
  .kq-cur.dbl svg { animation: kq-press2 1.6s ease-in-out infinite; }
  .kq-tap { position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; border-radius: 50%; border: 2px solid #c9a8ff; opacity: 0; animation: kq-tap 1.4s ease-out infinite; }
  .kq-tap2 { display: none; }
  .kq-cur.dbl .kq-tap { animation: kq-tap 1.6s ease-out infinite; }
  .kq-cur.dbl .kq-tap2 { display: block; animation-delay: .22s; }
  @keyframes kq-press { 0%, 40% { transform: translate(8px, 8px); } 50% { transform: translate(0, 0) scale(.88); } 60%, 100% { transform: translate(0, 0); } }
  @keyframes kq-press2 { 0%, 30% { transform: translate(8px, 8px); } 38% { transform: scale(.88); } 46% { transform: none; } 54% { transform: scale(.88); } 62%, 100% { transform: none; } }
  @keyframes kq-tap { 0%, 45% { opacity: 0; transform: scale(.3); } 50% { opacity: 1; transform: scale(.4); } 100% { opacity: 0; transform: scale(1.4); } }
  .kq-slot { position: fixed; z-index: 59; pointer-events: none; box-sizing: border-box; border: 1.5px dashed #c9a8ff; background: rgba(155,92,255,.16);
    box-shadow: 0 0 14px rgba(155,92,255,.45); animation: kq-slot 1.6s ease-in-out infinite; }
  @keyframes kq-slot { 50% { background: rgba(155,92,255,.28); } }
  html.kq-wantbars .k2-dragout-tag { color: #ff3b5c !important; font-weight: 800; }
  html.kq-wantbars .k2-dragout-tag.kq-ok { color: #3cff8f !important; }
  @keyframes kq-ring { 50% { box-shadow: 0 0 0 9px rgba(155,92,255,0), 0 0 30px rgba(155,92,255,.9); } }
  .kq-pop { position: fixed; font: 900 18px Inter, sans-serif; color: #c9a8ff; text-shadow: 0 0 12px rgba(155,92,255,.9), 0 2px 0 #000;
    pointer-events: none; animation: kq-pop .9s cubic-bezier(.2,.9,.25,1) forwards; }
  .kq-pop.big { font-size: 28px; color: #fff; }
  .kq-sounds { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  .kq-sounds button { width: 34px; height: 34px; padding: 0; font-size: 15px; }
  .kq-sname { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .kq-sname b { font: 700 13px Inter, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kq-sname small { font: 600 10px Inter, sans-serif; letter-spacing: .14em; color: #8a8a96; }
  /* show, don't tell (Eman, 7 Nov V4m): the rest of the app dims, the thing to press glows, a short word sits on it,
     and a ghost hand does the move first */
  .kq-dim { position: fixed; pointer-events: none; box-shadow: 0 0 0 300vmax rgba(6,6,10,.6); opacity: 0; transition: opacity .3s, left .2s, top .2s, width .2s, height .2s; }
  .kq-dim.on { opacity: 1; }
  .kq-tip { position: fixed; pointer-events: none; white-space: nowrap; background: #9b5cff; color: #fff; font: 800 11px Inter, sans-serif; letter-spacing: .16em;
    padding: 6px 9px; box-shadow: 0 6px 20px rgba(0,0,0,.5), 0 0 16px rgba(155,92,255,.6); transform: translate(-50%, 0); animation: kq-tipin .3s cubic-bezier(.2,.9,.25,1); }
  .kq-tip::before { content: ""; position: absolute; left: 50%; top: -5px; width: 10px; height: 10px; background: #9b5cff; transform: translateX(-50%) rotate(45deg); }
  .kq-tip.up::before { top: auto; bottom: -5px; }
  @keyframes kq-tipin { from { opacity: 0; margin-top: 6px; } }
  .kq-ghost { position: fixed; width: 0; height: 0; pointer-events: none; }
  .kq-ghost svg { position: absolute; left: -3px; top: -2px; filter: drop-shadow(0 0 8px rgba(155,92,255,.9)); transition: transform .08s; }
  .kq-ghost.down svg { transform: scale(.86); }
  .kq-ghost .kq-tap { animation: none; }
  /* Eman's notes on V4w (7 Nov 13:00): no dark overlay, no hand on plain clicks; the demo cursor is an acid-yellow
     arrow the size of the real one, and what it makes looks like the real thing. */
  .kq-ghost.acid svg { left: 0; top: 0; width: 24px !important; height: 24px !important; filter: drop-shadow(0 2px 4px rgba(0,0,0,.6)); transform-origin: var(--hx) var(--hy); }
  .kq-ghost.acid.down svg { transform: scale(.88); }
  .kq-ghost.acid .kq-tap { left: -16px; top: -16px; width: 32px; height: 32px; border: 2px solid #E4FF3A; }
  .kq-fakenote { position: fixed; pointer-events: none; box-sizing: border-box; border-radius: 4px; background: #8b5cf6;
    box-shadow: inset 0 3px 0 -1px rgba(255,255,255,.35), 0 0 10px rgba(139,92,246,.55); }
  .kq-fakenote.set { box-shadow: inset 0 3px 0 -1px rgba(255,255,255,.35), 0 0 0 1.5px #fff, 0 0 14px rgba(139,92,246,.8); }
  .kq-fakeclip { position: fixed; pointer-events: none; box-sizing: border-box; border: 1px solid var(--c);
    background: color-mix(in srgb, var(--c) 45%, #141417); box-shadow: 0 0 14px color-mix(in srgb, var(--c) 45%, transparent); }
  .kq-bad { position: fixed; pointer-events: none; box-sizing: border-box; border: 2px solid #ff3b5c; background: rgba(255,59,92,.45);
    box-shadow: 0 0 16px #ff3b5c; animation: kq-bad 1.4s ease-out forwards; z-index: 70; }
  @keyframes kq-bad { 0% { opacity: 0; } 10%, 70% { opacity: 1; } 100% { opacity: 0; } }
  .kq-badtip { position: fixed; pointer-events: none; white-space: pre; text-align: center; line-height: 1.6; background: #ff3b5c; color: #fff; font: 800 11px Inter, sans-serif; letter-spacing: .16em;
    padding: 6px 9px; transform: translate(-50%, 0); box-shadow: 0 6px 20px rgba(0,0,0,.5); animation: kq-tipin .2s; }
  .kq-nope { position: fixed; pointer-events: none; transform: translate(-50%, -140%); font: 800 10px Inter, sans-serif; letter-spacing: .16em; color: #fff;
    background: #ff3b5c; padding: 4px 7px; animation: kq-pop .9s cubic-bezier(.2,.9,.25,1) forwards; }
  html.kq-on #empty { display: none !important; }
  .kq-ring, .kq-tip, .kq-bub, .kq-hud { transition: opacity .25s; }
  html.kq-busy .kq-ring, html.kq-busy .kq-tip, html.kq-busy .kq-bub, html.kq-busy .kq-hud, html.kq-busy .kq-cur { opacity: 0 !important; pointer-events: none !important; }
  .kq-keyrow { position: absolute; pointer-events: none; box-sizing: border-box; background: #fff; box-shadow: 0 0 12px rgba(255,255,255,.8);
    animation: kq-keyrow .5s ease-out forwards; }
  .kq-keyrow.root { background: #E4FF3A; box-shadow: 0 0 14px rgba(228,255,58,.9); }
  .kq-keydark { position: absolute; pointer-events: none; background: #0b0b0e; opacity: .92; transition: opacity .25s ease-out; }
  .kq-keydark.off { opacity: 0; }
  .kq-keyrow.kq-keyrow2 { animation: kq-keyrow2 .7s ease-out forwards; }
  @keyframes kq-keyrow2 { 0% { opacity: 0; } 25% { opacity: .95; } 100% { opacity: .3; } }
  @keyframes kq-keyrow { 0% { opacity: 0; transform: scaleX(.2); transform-origin: 0 50%; } 60% { opacity: .9; } 100% { opacity: .35; transform: none; } }
  .kq-slot.lit { border: 1.5px solid rgba(201,168,255,.9); background: rgba(155,92,255,.18); animation: kq-lit 1.8s ease-in-out infinite; }
  @keyframes kq-lit { 50% { box-shadow: 0 0 16px rgba(155,92,255,.7); } }
  .kq-meter { position: fixed; right: 56px; top: 96px; width: 300px; padding: 14px 16px; background: #141417; border: 1px solid #2c2c33; box-shadow: 0 10px 40px rgba(0,0,0,.6);
    display: flex; flex-direction: column; gap: 10px; animation: kq-in .3s cubic-bezier(.2,.9,.25,1); }
  .kq-meter .kq-mtop { display: flex; align-items: baseline; justify-content: space-between; }
  .kq-meter b { font: 800 11px Inter, sans-serif; letter-spacing: .2em; color: #8a8a96; }
  .kq-meter strong { font: 900 30px Inter, sans-serif; color: #fff; font-variant-numeric: tabular-nums; transition: color .3s; }
  .kq-meter strong small { font-size: 14px; color: #6b6b78; margin-left: 4px; }
  .kq-meter .kq-mbar { height: 12px; background: #2a2a31; position: relative; overflow: hidden; }
  .kq-meter .kq-mbar i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(90deg, #7a3cff, #c9a8ff); box-shadow: 0 0 14px rgba(155,92,255,.9); transition: width .12s; }
  .kq-meter.full strong { color: #E4FF3A; }
  .kq-meter.full .kq-mbar i { background: #E4FF3A; box-shadow: 0 0 18px rgba(228,255,58,.9); }
  .kq-meter .kq-unl { font: 900 13px Inter, sans-serif; letter-spacing: .3em; color: #E4FF3A; text-align: center; height: 0; overflow: hidden; transition: height .25s; }
  .kq-meter.full .kq-unl { height: 18px; }
  .kq-coin3 { position: fixed; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle at 35% 30%, #fff 0 8%, #e9dcff 9% 30%, #b48cff 31% 62%, #7a3cff 63%);
    box-shadow: inset 0 0 0 2px #5b25d6, inset 0 0 0 4px #d9c4ff, 0 0 12px rgba(155,92,255,.9); animation: kq-spin .5s linear infinite; }
  @keyframes kq-spin { 50% { transform: scaleX(.25); } }
  .kq-trail { position: fixed; pointer-events: none; box-sizing: border-box; border: 2px solid #c9a8ff; background: rgba(155,92,255,.3); box-shadow: 0 0 18px rgba(155,92,255,.7); }
  .kq-trail.box { border-style: dashed; background: rgba(155,92,255,.12); }
  .kq-trail b { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); font: 800 10px Inter, sans-serif; letter-spacing: .12em; color: #fff; text-shadow: 0 1px 2px #000; }
  .kq-slot.lit { border: 2px solid #c9a8ff; background: rgba(155,92,255,.22); }
  .kq-endbtns { display: flex; gap: 10px; justify-content: center; margin-top: 10px; }
  .kq-endbtns button { background: #9b5cff; color: #fff; border: 0; font: 800 11px Inter, sans-serif; letter-spacing: .16em; padding: 9px 14px; cursor: pointer; }
  .kq-endbtns button.q { background: none; border: 1px solid #5a5a66; color: #ddd; }
  .kq-pop em { font-style: normal; color: #fff; margin-left: 8px; font-size: 22px; }
  @keyframes kq-pop { 0% { transform: translate(-50%, 0) scale(.6); opacity: 0; } 20% { transform: translate(-50%, -14px) scale(1.15); opacity: 1; }
    100% { transform: translate(-50%, -54px) scale(1); opacity: 0; } }
  .kq-fly { position: fixed; width: 16px; height: 16px; border-radius: 50%; background: #c9a8ff; box-shadow: inset 0 0 0 3px #9b5cff, 0 0 12px rgba(155,92,255,.9); pointer-events: none; }
  .kq-modal { position: fixed; inset: 0; background: rgba(8,8,10,.82); backdrop-filter: blur(6px); display: grid; place-items: center; pointer-events: auto; z-index: 9001; }
  /* the guide's words over the HOW DEEP question sat under its blur, unreadable (bug check, 7 Nov). html.kq-bub-under = old */
  html:not(.kq-bub-under) .kq-layer:has(> .kq-modal) > .kq-bub { z-index: 9002; }
  .kq-pick { display: flex; flex-direction: column; align-items: center; gap: 22px; }
  .kq-pick h2 { margin: 0; font: 800 13px Inter, sans-serif; letter-spacing: .3em; color: #8a8a96; }
  .kq-cards { display: flex; gap: 16px; }
  .kq-lv { width: 210px; padding: 18px; background: #18181c; border: 1px solid #2c2c33; color: #fff; text-align: left; cursor: pointer; font-family: inherit;
    display: flex; flex-direction: column; gap: 8px; transition: transform .15s, border-color .15s; }
  .kq-lv:hover { transform: translateY(-4px); border-color: #c9a8ff; }
  .kq-lv b { font: 800 22px Inter, sans-serif; letter-spacing: .08em; }
  .kq-lv span { font: 500 13px Inter, sans-serif; color: #9a9aa6; }
  .kq-lv em { font: 700 9px Inter, sans-serif; letter-spacing: .2em; color: #c9a8ff; font-style: normal; }
  .kq-lv[disabled] { opacity: .35; cursor: default; transform: none; border-color: #2c2c33; }
  .kq-free { background: none; border: 0; color: #6b6b78; font: 700 10px Inter, sans-serif; letter-spacing: .2em; cursor: pointer; }
  .kq-free:hover { color: #fff; }
  .kq-start { position: absolute; right: 18px; top: 10px; z-index: 2; background: #9b5cff; color: #fff; border: 0; font: 800 10px Inter, sans-serif;
    letter-spacing: .18em; padding: 8px 12px; cursor: pointer; box-shadow: 0 0 18px rgba(155,92,255,.6); }
  .kq-start:hover { background: #b07cff; }
  .kq-end { position: fixed; right: 22vw; top: 46%; transform: translateY(-50%); width: min(440px, calc(100vw - 32px)); z-index: 2147483002; pointer-events: auto;
    background: #141417; border: 1px solid #c9a8ff; box-shadow: 0 20px 70px rgba(0,0,0,.7), 0 0 40px rgba(155,92,255,.35); padding: 26px 26px 18px;
    display: flex; flex-direction: column; gap: 14px; animation: kq-in .35s cubic-bezier(.2,.9,.25,1); }
  .kq-end small { font: 800 11px Inter, sans-serif; letter-spacing: .26em; color: #E4FF3A; }
  .kq-end h3 { margin: 0; font: 800 26px/1.15 Inter, sans-serif; color: #fff; }
  .kq-endrow { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
  .kq-end button { cursor: pointer; font: 800 14px Inter, sans-serif; letter-spacing: .18em; border: 0; padding: 20px 18px; }
  .kq-endgo { background: #9b5cff; color: #fff; font-size: 17px !important; box-shadow: 0 0 26px rgba(155,92,255,.6); animation: kq-pulse 1.4s ease-in-out infinite; }
  .kq-endgo:hover { background: #b07cff; }
  .kq-endq { background: none; border: 1px solid #4a4a55 !important; color: #ddd; }
  .kq-endq:hover { border-color: #fff !important; color: #fff; }
  .kq-endstay { background: none !important; color: #6b6b78; padding: 6px !important; font-size: 10px !important; align-self: center; }
  .kq-endstay:hover { color: #fff; }
  /* V5w (Eman 22:44): the card shows alone first; then a small panel fades in from the right, in the middle of the
     space right of the card, never over it. window.KT2_QUEST_END_OLD = the big panel over the card. */
  .kq-end.kq-end2 { right: auto; top: 50%; width: 220px; padding: 0; gap: 8px; transform: translateY(-50%); background: none; border: 0;
    box-shadow: none; animation: none; }
  .kq-end2 > small, .kq-end2 > h3 { display: none; }
  .kq-end2 .kq-endrow > button, .kq-end2 > .kq-endstay { animation: kq-end2btn .6s cubic-bezier(.2,.9,.25,1) both; }
  .kq-end2 .kq-endgo { animation: kq-end2btn .6s cubic-bezier(.2,.9,.25,1) both, kq-pulse 1.4s ease-in-out .8s infinite !important; }
  @keyframes kq-end2btn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: none; } }
  .kq-end2 .kq-endrow > button:nth-child(2) { animation-delay: .12s; }
  .kq-end2 > .kq-endstay { animation-delay: .24s; }
  .kq-end2 .kq-endq { background: rgba(20,20,23,.85); }
  @keyframes kq-end2in { from { opacity: 0; transform: translate(70px, -50%); } to { opacity: 1; transform: translate(0, -50%); } }
  .kq-end2 small { font-size: 9px; letter-spacing: .22em; }
  .kq-end2 h3 { font-size: 15px; line-height: 1.25; }
  .kq-end2 .kq-endrow { gap: 7px; margin-top: 4px; }
  .kq-end2 button { font-size: 10px; letter-spacing: .16em; padding: 11px 10px; }
  .kq-end2 .kq-endgo { font-size: 12px !important; }
  .kq-end2 .kq-endstay { font-size: 9px !important; padding: 4px !important; }
  /* Eman's notes on V4x (7 Nov 14:00): a light 15% shade over everything but the buttons to press (it goes as soon
     as you press); a soft glowing outline (no fill) on the one thing to press next; note boxes with rounded corners
     and a glow that runs around them; a plain marker where to stop; the button for the next step pulses. */
  .kq-dim2 { position: fixed; inset: 0; pointer-events: none; opacity: 0; transition: opacity .12s; }
  .kq-dim2.on { opacity: 1; }
  .kq-dim2 svg { position: absolute; left: 0; top: 0; width: 100% !important; height: 100% !important; display: block; }
  html.kq-busy:not(.kq-shade) .kq-dim2 { opacity: 0 !important; }
  html.kq-help2 .kq-ring { border-width: 4px; border-color: #E4FF3A; animation-duration: .7s; box-shadow: 0 0 0 8px rgba(228,255,58,.25), 0 0 40px rgba(228,255,58,.7); }
  html.kq-help2 .kq-tip { transform-origin: 50% 50%; scale: 1.3; }
  html.kq-help2 .kq-slot { border-color: #E4FF3A; box-shadow: 0 0 22px rgba(228,255,58,.6); }
  .kq-ring.soft { border-radius: 8px; border: 2px solid rgba(201,168,255,.8); animation: kq-soft 1.6s ease-in-out infinite; }
  @keyframes kq-soft { 0%, 100% { box-shadow: 0 0 6px rgba(155,92,255,.45); border-color: rgba(201,168,255,.65); }
    50% { box-shadow: 0 0 22px rgba(155,92,255,.95), 0 0 0 3px rgba(155,92,255,.22); border-color: #fff; } }
  html.kq-kf-t .k2-keypick .k2-kp-notes button.on, html.kq-kf-s .k2-keypick .k2-kp-scales button.on { color: rgba(255,255,255,.75); background: rgba(255,255,255,.05); }
  @property --kqa { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
  .kq-slot.note { border: 0; border-radius: 4px; background: rgba(155,92,255,.13); box-shadow: 0 0 10px rgba(155,92,255,.35); animation: none; }
  .kq-slot.note::before { content: ""; position: absolute; inset: -1px; border-radius: 5px; padding: 1.5px;
    background: conic-gradient(from var(--kqa), rgba(201,168,255,.35) 0deg, #fff 36deg, #c9a8ff 80deg, rgba(201,168,255,.35) 150deg, rgba(201,168,255,.35) 360deg);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: kq-around 2.2s linear infinite; }
  @keyframes kq-around { to { --kqa: 360deg; } }
  .kq-mark { position: fixed; width: 2px; margin-left: -1px; background: #fff; box-shadow: 0 0 10px #c9a8ff, 0 0 3px #fff; pointer-events: none; }
  .kq-bub button.pulse { animation: kq-pulse 1.1s ease-in-out infinite; }
  @keyframes kq-pulse { 50% { box-shadow: 0 0 0 6px rgba(155,92,255,.22), 0 0 22px rgba(155,92,255,.9); transform: scale(1.04); } }
  html.kq-busy .kq-tip.kq-keep { opacity: 1 !important; }
  /* 10 Nov quest-safe (Eman 10 Nov: "always have the text open"): the words stay while you work; they only let clicks through */
  html.kq-safe.kq-busy .kq-bub, html.kq-safe.kq-busy .kq-hud, html.kq-safe.kq-busy .kq-tip { opacity: .92 !important; }
  html.kq-on .k2-renpop { z-index: 2147482990 !important; }
  /* KILLTOY 2 hides automation lines; quest 2's cutoff step shows them while you draw */
  html.kq-autoshow.kt2 .auto-row { display: flex !important; }
  /* V5a notes (Eman, 7 Nov 15:26). KT2_QUEST_R2_LOOK = the look before */
  html:not(.kq-r2) .kq-bub { border-radius: 22px; border-width: 2px; padding: 16px 20px 16px; font: 500 17px/1.45 Inter, sans-serif; max-width: 380px;
    animation: kq-bubin .42s cubic-bezier(.3,1.6,.5,1); box-shadow: 0 14px 44px rgba(0,0,0,.6), 0 0 0 4px rgba(155,92,255,.10); }
  html:not(.kq-r2) .kq-bub::after { right: -11px; bottom: 22px; width: 20px; height: 20px; border-right-width: 2px; border-top-width: 2px; border-radius: 0 6px 0 0;
    transform: rotate(45deg); }
  html.kq-on:has(.k2-keypick) .kq-hud { opacity: 0; pointer-events: none; }   /* the quest bar never covers the key menu */
  html:not(.kq-r2) .kq-bub button { border-radius: 999px; padding: 9px 16px; font-size: 12px; }
  @keyframes kq-bubin { from { opacity: 0; transform: translateY(14px) scale(.82) rotate(-2deg); } 60% { opacity: 1; } }
  .kq-tip::before { left: var(--ax, 50%); }
  /* the tip nudges toward where to press, over and over (Eman, V5n notes: instead of the zoom) */
  html:not(.kq-r2) .kq-tip[data-dir] { animation: kq-tipin .3s cubic-bezier(.2,.9,.25,1), kq-nudge-v .85s .3s ease-in-out infinite; --nx: 0px; --ny: -7px; }
  html:not(.kq-r2) .kq-tip[data-dir="above"] { --ny: 7px; }
  html:not(.kq-r2) .kq-tip[data-dir="right"] { --nx: -7px; --ny: 0px; }
  html:not(.kq-r2) .kq-tip[data-dir="left"] { --nx: 7px; --ny: 0px; }
  @keyframes kq-nudge-v { 0%, 100% { translate: 0 0; } 50% { translate: var(--nx) var(--ny); } }
  .kq-tip.side::before { top: 50%; left: -5px; transform: translateY(-50%) rotate(45deg); }
  .kq-tip.side.lft::before { left: auto; right: -5px; }
  html:not(.kq-r2) .kq-slot.note { background: rgba(155,92,255,.08); box-shadow: none; }
  html:not(.kq-r2) .kq-slot.note::before { opacity: .55; padding: 1px; }
  html:not(.kq-r2) .kq-slot.lit { border: 1px solid rgba(201,168,255,.35); background: rgba(155,92,255,.10); animation: none; box-shadow: none; }
  .kq-line { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; }
  .kq-line svg { position: absolute; left: 0; top: 0; width: 100% !important; height: 100% !important; overflow: visible; }
  .kq-line path { fill: none; stroke: #c9a8ff; stroke-width: 2.5; stroke-linecap: round; filter: drop-shadow(0 0 6px rgba(155,92,255,.9)); }
  .kq-line circle { fill: #fff; filter: drop-shadow(0 0 8px #c9a8ff); }
  `;
  document.head.append(css);

  // ---------------------------------------------------------------- the quest's own layer
  let layer = null, hud = null, bub = null, ring = null, ringFor = null, coins = 0, coinEl = null, pipsEl = null, stepEl = null;
  const SAVE_KEY = "kt2.quest.firstSong.v5";   // v5 (V4w notes): A minor, every note a box   // v2 (Eman's notes, 7 Nov): you make the patterns yourself; old saves start over
  // the game plan (Eman, 7 Nov 16:21): 1 PLAYGROUND, 2 MAKE IT MOVE (NEON RUN), 3 YOUR OWN BEAT (VILLAIN).
  // KT2_QUEST_OLD_SET = the earlier BUILD IT UP / DROP IT quests on the quest 1 song.
  const SAVE_KEYS = window.KT2_QUEST_OLD_SET ? [SAVE_KEY, "kt2.quest.buildUp.v1", "kt2.quest.dropIt.v1"] : [SAVE_KEY, "kt2.quest.makeItMove.v1", "kt2.quest.ownBeat.v1"];
  let QI = 0;   // which quest is running (0 = FIRST SONG, 1 = BUILD IT UP)
  const loadSave = (qi) => { try { return JSON.parse(localStorage.getItem(SAVE_KEYS[qi == null ? QI : qi]) || "null"); } catch (e) { return null; } };
  const writeSave = (o, qi) => { try { localStorage.setItem(SAVE_KEYS[qi == null ? QI : qi], JSON.stringify(Object.assign(loadSave(qi) || {}, o))); } catch (e) { /* fine */ } };
  let active = false, cancel = null, lastXY = { x: innerWidth / 2, y: innerHeight / 2 };
  addEventListener("pointerdown", (e) => { lastXY = { x: e.clientX, y: e.clientY }; }, true);

  function buildLayer() {
    layer = H("div", "kq-layer");
    hud = H("div", "kq-hud");
    stepEl = H("span", "kq-step", "");
    pipsEl = H("div", "kq-pips");
    const c = H("div", "kq-coins"); c.append(H("i", "kq-coin")); coinEl = H("span", null, "0"); c.append(coinEl);
    const x = H("button", "kq-x", "PAUSE"); x.title = "Leave the quest for now. CONTINUE it from QUESTS on the projects page."; x.onclick = () => stop(true);
    hud.append(H("b", null, (QDEF()[QI] && QDEF()[QI].hud) || "QUEST"), stepEl, pipsEl, c, x);
    layer.append(hud);
    document.body.append(layer);
  }
  function setCoins(n) { coins = n; if (coinEl) coinEl.textContent = String(Math.round(n)); }
  function pop(n, xy, big, label) {
    if (!layer) return;
    const p = H("div", "kq-pop" + (big ? " big" : ""), "+" + n);
    if (label) p.append(H("em", null, label));
    const at = xy || lastXY;
    p.style.left = at.x + "px"; p.style.top = at.y - 10 + "px";
    layer.append(p); setTimeout(() => p.remove(), 950);
    setCoins(coins + n);
    snd("tick", big ? 9 : 5);
  }

  // the avatar (kt2-avatar.js's head in the corner) rises while she talks
  let typing = 0;
  function say(text, buttons) {
    if (halt) throw new Error("quest stopped");
    if (bub) bub.remove();
    clearInterval(typing);
    bub = H("div", "kq-bub");
    const p = H("div"); bub.append(p);
    layer.append(bub);
    dodge();
    html.classList.add("kq-talk");
    try { window.ktAvatar && ktAvatar.mode && ktAvatar.mode("speaking"); } catch (e) { /* quiet */ }
    // V5p (Eman, 20:52): the words are there at once. window.KT2_QUEST_TYPEWRITER = typed out letter by letter.
    let i = window.KT2_QUEST_TYPEWRITER ? 0 : Math.max(0, text.length - 2);
    if (!window.KT2_QUEST_TYPEWRITER) { p.textContent = text; try { window.ktAvatar && ktAvatar.word && ktAvatar.word(); } catch (e) { /* quiet */ } }
    typing = setInterval(() => {
      i += 2; p.textContent = text.slice(0, i);
      try { window.ktAvatar && ktAvatar.word && i % 8 === 0 && ktAvatar.word(); } catch (e) { /* quiet */ }
      if (i >= text.length) { clearInterval(typing); try { window.ktAvatar && ktAvatar.mode && ktAvatar.mode("idle"); } catch (e) { /* quiet */ } setTimeout(() => html.classList.remove("kq-talk"), 900); }
    }, 22);
    return new Promise((resolve) => {
      if (!buttons || !buttons.length) return resolve();
      const row = H("div", "kq-btns");
      buttons.forEach(([label, val, quiet, pulse]) => { const b = H("button", (quiet ? "q" : "") + (pulse ? " pulse" : ""), label); b.onclick = () => resolve(val); row.append(b); });
      bub.append(row);
    });
  }
  function quiet() { if (bub) { bub.remove(); bub = null; } html.classList.remove("kq-talk"); }

  // Pointers on top of the real app (Eman's notes on V4w, 7 Nov 13:00): the thing to press glows (a ring) with a
  // short word on an arrow tag. No dark overlay (KT2_QUEST_DIM = the old dim), no hand cursor on plain clicks
  // (KT2_QUEST_CURSOR = old). A cursor only shows a move that needs showing (double-click and pull, press and drag),
  // once, as an acid-yellow arrow the size of the real one, with sounds; then it's your turn.
  // A target is an element, a rect on screen { left, top, width, height }, or a rect inside a host
  // element { host, left, top, width, height }. Anything inside the pattern window is drawn INSIDE
  // that window, so its zoom (the window size grip) can't put the ring in the wrong place.
  let dim2 = null, curEl = null, ptrOpts = {}, slotEls = [], slotFor = null, slotCls = "", dimEl = null, tipEls = [], demoTimer = 0, demoGo = 0;
  function offsetIn(el, host) {
    let x = 0, y = 0, n = el;
    while (n && n !== host) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; if (n && !host.contains(n) && n !== host) return null; }
    if (!n) return null;
    for (let p = el.parentElement; p && p !== host; p = p.parentElement) { x -= p.scrollLeft || 0; y -= p.scrollTop || 0; }
    return { x, y };
  }
  function resolve(t) {
    if (!t) return null;
    if (t.getBoundingClientRect) {
      if (!t.isConnected || !t.offsetParent) return null;
      const host = t.closest("#iw-card");
      if (host) { const o = offsetIn(t, host); if (o) return { host, left: o.x, top: o.y, width: t.offsetWidth, height: t.offsetHeight }; }
      const r = t.getBoundingClientRect();
      return r.width ? { host: null, left: r.left, top: r.top, width: r.width, height: r.height } : null;
    }
    return t.width != null ? { host: t.host || null, left: t.left, top: t.top, width: t.width, height: t.height } : null;
  }
  // where a resolved target really is on screen (a rect inside the zoomed pattern window scales with it)
  function screenRect(t) {
    if (!t) return null;
    if (!t.host) return { left: t.left, top: t.top, width: t.width, height: t.height };
    const hr = t.host.getBoundingClientRect(), k = hr.width / (t.host.offsetWidth || hr.width || 1) || 1;
    return { left: hr.left + (t.left + t.host.clientLeft) * k, top: hr.top + (t.top + t.host.clientTop) * k, width: t.width * k, height: t.height * k };
  }
  function putIn(node, host) {
    const parent = host || layer;
    if (node.parentNode !== parent) parent.append(node);
    node.style.position = host ? "absolute" : "fixed";
  }
  const getT = (g) => (typeof g === "function" ? g() : typeof g === "string" ? $(g) : g);
  // point(target, { tip, tips: [[target, word]...], ring, allow: [...], demo, every })
  function point(get, opts) {
    if (halt) throw new Error("quest stopped");
    ringFor = get; ptrOpts = opts || {}; misses = 0; shadeOff = false;
    busy(false);
    const wantRing = ptrOpts.ring !== false && get;
    if (wantRing && !ring) ring = H("div", "kq-ring");
    if (!wantRing && ring) { ring.remove(); ring = null; }
    if (ring) ring.classList.toggle("soft", !!ptrOpts.soft);
    // V5a: the shade is on for every step that points at something (dim: false turns it off)
    const wantDim2 = (shadeAlways() || ptrOpts.dim || (ptrOpts.dim !== false && !window.KT2_QUEST_R2_LOOK && (get || (ptrOpts.tips || []).length))) && !window.KT2_QUEST_NO_SHADE;
    if (wantDim2 && !dim2) makeDim2();
    if (!wantDim2 && dim2) { dim2.remove(); dim2 = null; }
    const wantCur = ptrOpts.cursor && window.KT2_QUEST_CURSOR;
    if (wantCur && !curEl) { curEl = H("div", "kq-cur"); curEl.innerHTML = '<i class="kq-tap"></i><i class="kq-tap kq-tap2"></i><svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 3l14 8-6 1.6L9.6 19z" fill="#fff" stroke="#141218" stroke-width="1.6" stroke-linejoin="round"/></svg>'; }
    if (!wantCur && curEl) { curEl.remove(); curEl = null; }
    if (curEl) curEl.classList.toggle("dbl", ptrOpts.cursor === "dbl");
    const wantDim = ptrOpts.spot && window.KT2_QUEST_DIM;
    if (wantDim && !dimEl) { dimEl = H("div", "kq-dim"); layer.prepend(dimEl); requestAnimationFrame(() => dimEl && dimEl.classList.add("on")); }
    if (!wantDim && dimEl) { dimEl.remove(); dimEl = null; }
    tipEls.forEach((t) => t.el.remove()); tipEls = [];
    const tips = [];
    if (ptrOpts.tip && get) tips.push([get, ptrOpts.tip, ptrOpts.tipSide]);
    (ptrOpts.tips || []).forEach((t) => tips.push(t));
    tips.forEach(([g, word, side, cls], k) => { const el = H("div", "kq-tip" + (cls ? " " + cls : ""), word); layer.append(el); tipEls.push({ el, get: g, side, at: k === 0 && ptrOpts.tip ? ptrOpts.tipAt : null }); });
    // only the things of this step can be pressed (Eman: "freeze the page")
    // look: true = the thing is only shown, not pressed (Eman, 8 Nov 03:05: ONLY KEY "is just on and it tells you it's
    // on, but if you press it, it tells you you can't do it right now"). window.KT2_QUEST_LOOK_PRESS = old (pressable).
    const lookOnly = ptrOpts.look && !window.KT2_QUEST_LOOK_PRESS && !window.KT2_QUEST_LOOSE;
    allowFns = lookOnly ? [...(ptrOpts.allow || [])].filter(Boolean)
      : [get, ...(ptrOpts.onlyGet && !window.KT2_QUEST_LOOSE ? [] : tips.map((t) => t[0])), ...(ptrOpts.allow || [])].filter(Boolean);
    stopDemo();
    helpLv = 0; html.classList.remove("kq-help2");
    // V5p (Eman, 21:10): help grows when someone is stuck. Every step has a move to show (a plain button gets a press
    // shown on it); the first time stuck = the move is shown; stuck again = the spot gets big and pulsing and a plainer
    // line says what to do, and the move keeps showing. window.KT2_QUEST_HELP_FLAT = only the old repeat.
    const autoDemo = !lookOnly && !ptrOpts.demo && !window.KT2_QUEST_HELP_FLAT && !window.KT2_QUEST_R2_LOOK && (get || (ptrOpts.tips || []).length)
      ? () => { const a = aimOf(get || ptrOpts.tips[0][0]); return a ? ghostMove({ x: a.x, y: a.y }, null, {}) : null; } : null;
    if (ptrOpts.demo || autoDemo) {
      const d = ptrOpts.demo || autoDemo, go = ++demoGo;
      const first0 = !!ptrOpts.demoNow;
      // shown once; again only when nothing has happened for a while
      const loop = async (now) => {
        if (go !== demoGo) return; demoAt = Date.now();
        if (now !== true && !window.KT2_QUEST_HELP_FLAT && !window.KT2_QUEST_R2_LOOK) { helpLv++; if (helpLv >= 2) help2(); }
        try { await d(); } catch (e) { /* fine */ }
        demoAt = Date.now(); if (go === demoGo) demoTimer = setTimeout(idle, 1000);
      };
      // V5a (Eman): it keeps showing, about 5 s after the last press (or a wrong move), until you get it
      // V5p (Eman, friend test): let the person try a few times first. The move shows again only after 3 misses or
      // 15 s with nothing pressed, and it never takes the mouse away. window.KT2_QUEST_SHOW_FIRST = the old 5 s.
      const gap = () => (window.KT2_QUEST_R2_LOOK ? ptrOpts.every : Math.min(ptrOpts.every || 1e9, idleGap()));
      const idle = () => { if (go !== demoGo) return; if (gap() && !held && !html.classList.contains("k2-dragging-out") && Date.now() - Math.max(lastAct, demoAt) > gap()) loop(); else demoTimer = setTimeout(idle, 500); };
      demoAt = Date.now();
      demoTimer = setTimeout(first0 ? () => loop(true) : idle, first0 ? 450 : 1000);
    }
    placeRing();
    if (!window.KT2_QUEST_R2_LOOK) requestAnimationFrame(() => guideTo(get || (tips[0] && tips[0][0]), ptrOpts));
  }
  // V5p (Eman, 20:52): the shade is on the whole time the quest runs, from the moment a step starts, with holes only
  // where you may press, so it's clear the rest can't be used. window.KT2_QUEST_SHADE_GAPS = the shade only on some steps.
  const shadeAlways = () => !window.KT2_QUEST_SHADE_GAPS && !window.KT2_QUEST_R2_LOOK && !window.KT2_QUEST_NO_SHADE;
  function makeDim2() {
    html.classList.toggle("kq-shade", shadeAlways());
    if (dim2 || !layer) return;
    dim2 = H("div", "kq-dim2"); dim2.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><defs><mask id="kq-dmask"><rect width="100%" height="100%" fill="#fff"/><g></g></mask></defs><rect width="100%" height="100%" fill="rgba(4,4,8,' + (window.KT2_QUEST_R2_LOOK || window.KT2_QUEST_SHADE15 ? ".15" : ".34") + ')" mask="url(#kq-dmask)"/></svg>'; layer.prepend(dim2);
    placeDim();
  }
  let helpLv = 0, help2Said = null;
  function help2() {
    if (!active || halt) return;
    html.classList.add("kq-help2");
    const key = ptrOpts.help || ptrOpts.tip || (ptrOpts.tips && ptrOpts.tips[0] && ptrOpts.tips[0][1]) || "";
    if (help2Said === key) return;
    help2Said = key;
    const word = (ptrOpts.tip || (ptrOpts.tips && ptrOpts.tips[0] && ptrOpts.tips[0][1]) || "").replace(/\s+/g, " ").trim();
    try { say(ptrOpts.help || ("Stuck? Only the big glowing spot works right now" + (word ? ", the one that says " + word : "") + ". Watch the yellow arrow, then do exactly the same.")); } catch (e) { /* fine */ }
  }
  let lastAim = null, zoomSeen = new Set(), zoomOn = false;
  function aimOf(g) { let v; try { v = getT(g); } catch (e) { v = null; } if (Array.isArray(v)) v = v[0]; const r = v && screenRect(resolve(v)); return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, r } : null; }
  function guideTo(g, o) {
    const a = g && aimOf(g);
    if (!a || !layer) { return; }
    const from = lastAim; lastAim = { x: a.x, y: a.y };
    if (from && Math.hypot(a.x - from.x, a.y - from.y) > 60) {
      const box = H("div", "kq-line");
      const mx = (from.x + a.x) / 2, my = Math.min(from.y, a.y) - Math.min(160, Math.abs(a.x - from.x) * 0.25 + 40);
      const d = `M${from.x} ${from.y} Q${mx} ${my} ${a.x} ${a.y}`;
      box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/><circle r="5"/></svg>`;
      layer.append(box);
      const path = box.querySelector("path"), dot = box.querySelector("circle"), len = path.getTotalLength();
      path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
      const t0 = performance.now(), dur = 700;
      const step = (t) => { if (!box.isConnected) return; const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); path.style.strokeDashoffset = len * (1 - e); const pt = path.getPointAtLength(len * e); dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y); if (k < 1) requestAnimationFrame(step); else box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" }).onfinish = () => box.remove(); };
      requestAnimationFrame(step);
    }
    // a small button you haven't been shown yet: the view swoops in on it and back out (once per button).
    // Off since V5n notes (Eman: "looks silly"): the tip nudges toward the spot instead. window.KT2_QUEST_ZOOM = the swoop.
    const key = (o && o.tip) || (Math.round(a.x / 40) + "," + Math.round(a.y / 40));
    if (o && o.soft && window.KT2_QUEST_ZOOM && !window.KT2_QUEST_NO_ZOOM && !zoomOn && a.r.width < 140 && a.r.height < 70 && !zoomSeen.has(key)) {
      zoomSeen.add(key); zoomOn = true;
      setTimeout(() => {
        const root = document.body;
        root.style.transformOrigin = a.x + "px " + a.y + "px";
        const an = root.animate([{ transform: "scale(1)" }, { transform: "scale(1.9)", offset: 0.38 }, { transform: "scale(1.9)", offset: 0.62 }, { transform: "scale(1)" }], { duration: 1500, easing: "cubic-bezier(.45,0,.25,1)" });
        an.onfinish = an.oncancel = () => { root.style.transformOrigin = ""; zoomOn = false; };
      }, 750);
    }
  }
  let demoAt = 0, lastAct = Date.now(), held = false;
  addEventListener("pointerdown", () => { held = true; }, true);
  addEventListener("pointerup", () => { held = false; }, true);
  addEventListener("keydown", () => { lastAct = Date.now(); }, true);
  // a wrong move: show the move again soon (a second and a half after the red word)
  // V5p: only the third miss in a row brings the move back (the first two: just the red word, try again)
  const idleGap = () => window.KT2_QUEST_IDLE || (window.KT2_QUEST_SHOW_FIRST || window.KT2_QUEST_R2_LOOK ? 5000 : 15000);
  let misses = 0;
  const demoSoon = () => {
    if (!window.KT2_QUEST_SHOW_FIRST && !window.KT2_QUEST_R2_LOOK && ++misses < 3) { lastAct = Date.now(); return; }
    misses = 0; lastAct = Date.now() - idleGap() + 1600; demoAt = 0;
  };
  // a press of your own while the move is being shown: the shown move goes at once (you keep the mouse)
  let ghostCut = 0;
  function cutGhost() { ghostCut++; document.querySelectorAll(".kq-ghost, .kq-trail, .kq-fake").forEach((n) => n.remove()); }
  function stopDemo() { demoGo++; clearTimeout(demoTimer); document.querySelectorAll(".kq-ghost, .kq-trail, .kq-fake").forEach((n) => n.remove()); }
  function unpoint() {
    ringFor = null; stopDemo(); allowFns = []; ptrOpts = {};
    const keepDim = shadeAlways() && gateOn && active;
    for (const n of [ring, curEl, dimEl, keepDim ? null : dim2]) if (n) n.remove();
    tipEls.forEach((t) => t.el.remove()); tipEls = [];
    ring = curEl = dimEl = null; if (!keepDim) dim2 = null; else placeDim();
  }
  // the things you may press right now, on screen (a tip never sits on one of them)
  function clickRects() {
    const out = [], add = (g) => { let v; try { v = getT(g); } catch (e) { v = null; } for (const one of (Array.isArray(v) ? v : [v])) { const r = one && screenRect(resolve(one)); if (r && r.width && r.width * r.height < innerWidth * innerHeight * 0.2) out.push(r); } };
    if (ringFor) add(ringFor);
    tipEls.forEach((t) => add(t.get));
    allowFns.forEach(add);
    document.querySelectorAll(".k2-keypick button, #pop:not([hidden]) button.item").forEach((b) => { const r = b.getBoundingClientRect(); if (r.width) out.push({ left: r.left, top: r.top, width: r.width, height: r.height }); });
    return out;
  }
  function placeTip(el, sr, side) {
    if (!sr) { el.style.opacity = 0; return; }
    el.style.opacity = "";
    const w = el.offsetWidth || 120, h = el.offsetHeight || 26, hw = w / 2 + 8;
    // the spot the arrow points at: the middle of the target (for a small target that's exactly where to press)
    const ax = sr.left + sr.width / 2, ay = sr.top + sr.height / 2;
    const cx = Math.max(hw, Math.min(innerWidth - hw, ax));
    const cand = [];
    const below = { k: "below", left: cx - w / 2, top: sr.top + sr.height + 14 }, above = { k: "above", left: cx - w / 2, top: sr.top - h - 14 };
    if (side === "up") cand.push(above, below); else cand.push(below, above);
    cand.push({ k: "right", left: sr.left + sr.width + 14, top: ay - h / 2 }, { k: "left", left: sr.left - w - 14, top: ay - h / 2 });
    const fitsIn = (c) => c.left >= 4 && c.top >= 4 && c.left + w <= innerWidth - 4 && c.top + h <= innerHeight - 4;
    const avoid = window.KT2_QUEST_R2_LOOK ? [] : clickRects().filter((r) => !(Math.abs(r.left - sr.left) < 1 && Math.abs(r.top - sr.top) < 1));
    const clear = (c) => !avoid.some((r) => hit2(r, { left: c.left, top: c.top, width: w, height: h }));
    const pick = cand.find((c) => fitsIn(c) && clear(c)) || cand.find(fitsIn) || cand[0];
    const sideways = pick.k === "right" || pick.k === "left";
    el.classList.toggle("up", pick.k === "above");
    el.classList.toggle("side", sideways);
    el.classList.toggle("lft", pick.k === "left");
    el.dataset.dir = pick.k;
    Object.assign(el.style, { left: pick.left + w / 2 + "px", top: pick.top + "px" });
    if (!sideways) el.style.setProperty("--ax", Math.max(8, Math.min(w - 8, ax - pick.left)) + "px"); else el.style.removeProperty("--ax");
  }
  // the 15% shade with holes where the buttons to press are (an SVG mask, so holes may overlap)
  function placeDim() {
    if (!dim2) return;
    const rs = [];
    const add = (g) => { let v; try { v = getT(g); } catch (e) { v = null; } for (const one of (Array.isArray(v) ? v : [v])) { const r = screenRect(resolve(one)); if (r && r.width) rs.push(r); } };
    if (ringFor) add(ringFor);
    tipEls.forEach((t) => add(t.get));
    (ptrOpts.holes || []).forEach(add);
    if (shadeAlways()) slotEls.forEach((e) => { if (e.style.opacity !== "0") { const r = e.getBoundingClientRect(); if (r.width) rs.push({ left: r.left, top: r.top, width: r.width, height: r.height }); } });
    // a menu that drops down from what you pressed is never under the shade (Eman, 7 Nov 15:26)
    document.querySelectorAll(".k2-keypick, #pop:not([hidden]), .ctx-menu, .k2-dd-menu").forEach((m) => { const r = m.getBoundingClientRect(); if (r.width && r.height) rs.push({ left: r.left, top: r.top, width: r.width, height: r.height }); });
    const on = (rs.length > 0 || (shadeAlways() && gateOn && active)) && !document.querySelector(".k2-renpop") && !shadeOff;
    dim2.classList.toggle("on", on);
    if (!on) return;
    const g = dim2.querySelector("mask g"), p = 6;
    g.innerHTML = rs.map((r) => `<rect x="${r.left - p}" y="${r.top - p}" width="${r.width + p * 2}" height="${r.height + p * 2}" rx="8" fill="#000"/>`).join("");
  }
  function placeRing() {
    tipEls.forEach((t) => placeTip(t.el, t.at ? t.at() : screenRect(resolve(getT(t.get))), t.side));
    placeDim();
    if (!ringFor) return;
    const t = resolve(getT(ringFor));
    for (const n of [ring, curEl]) if (n) n.style.opacity = t ? 1 : 0;
    if (dimEl) dimEl.classList.toggle("on", !!t);
    if (!t) return;
    const sr = screenRect(t);
    if (dimEl) { const p = 8; Object.assign(dimEl.style, { left: sr.left - p + "px", top: sr.top - p + "px", width: sr.width + p * 2 + "px", height: sr.height + p * 2 + "px" }); }
    const pad = 5;
    if (ring) { putIn(ring, t.host); Object.assign(ring.style, { left: t.left - pad + "px", top: t.top - pad + "px", width: t.width + pad * 2 + "px", height: t.height + pad * 2 + "px" }); }
    if (curEl) {
      putIn(curEl, t.host);
      const at = ptrOpts.at || "center";
      const x = at === "left" ? t.left + Math.min(14, t.width / 2) : t.left + t.width / 2, y = t.top + t.height / 2;
      Object.assign(curEl.style, { left: x + "px", top: y + "px" });
    }
  }
  setInterval(() => { if (shadeAlways() && gateOn && active && !dim2) makeDim2(); placeRing(); placeSlots(); dodge(); }, 200);
  // her speech bubble never sits on the thing to press or paint: it moves up under the quest bar
  const hit2 = (a, b) => a && b && a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
  function dodge() {
    if (!bub || html.classList.contains("kc-cat")) return;   // the quest cat places the bubble itself
    const w = bub.offsetWidth, h = bub.offsetHeight;
    const low = { left: innerWidth - 170 - w, top: innerHeight - 120 - h, width: w, height: h };
    const ts = [];
    if (ringFor) { const t = resolve(getT(ringFor)); if (t) ts.push(screenRect(t)); }
    slotEls.forEach((e) => { if (e.style.opacity !== "0") { const r = e.getBoundingClientRect(); ts.push({ left: r.left, top: r.top, width: r.width, height: r.height }); } });
    bub.classList.toggle("kq-hi", ts.some((r) => hit2(r, low)));
  }
  // many glowing slots at once (the notes still to paint, the buttons to pick)
  function slots(get, cls) { slotFor = get; slotCls = cls || ""; slotEls.forEach((s) => s.remove()); slotEls = []; placeSlots(); }
  function unslots() { slotFor = null; slotEls.forEach((s) => s.remove()); slotEls = []; }
  function placeSlots() {
    if (!slotFor) return;
    const list = (slotFor() || []).map(resolve);
    while (slotEls.length < list.length) slotEls.push(H("div", "kq-slot" + (slotCls ? " " + slotCls : "")));
    while (slotEls.length > list.length) slotEls.pop().remove();
    list.forEach((t, i) => {
      const s = slotEls[i];
      if (!t) { s.style.opacity = 0; return; }
      putIn(s, t.host);
      Object.assign(s.style, { opacity: 1, left: t.left + "px", top: t.top + "px", width: t.width + "px", height: t.height + "px" });
    });
  }
  // resolves on a real click on the element get() returns (a tab, a button)
  function untilClick(get) {
    return new Promise((resolve, reject) => {
      if (halt) return reject(new Error("quest stopped"));
      const on = (e) => { const el = get(); if (el && e.target && el.contains(e.target)) { document.removeEventListener("click", on, true); setTimeout(resolve, 0); } };
      document.addEventListener("click", on, true);
      const prev = cancel;
      cancel = () => { document.removeEventListener("click", on, true); reject(new Error("quest stopped")); if (prev) prev(); };
    });
  }

  // ---------------------------------------------------------------- only the quest's step can be pressed
  // (Eman, 7 Nov: "you can't do anything else than what you are supposed to do"). A press anywhere else does
  // nothing, gives a small "not now" and the glowing thing shakes. Keys: only SPACE, ENTER, ESC (and typing in a box).
  let allowFns = [], gateOn = false, nopeAt = 0, selfClick = false;
  // V6 (Eman, 8 Nov 03:12): while the finished song plays back the last time, no shade at all. KT2_QUEST_SHADE_LISTEN = old.
  let shadeOff = false;
  const inBox = (r, x, y, p) => r && x >= r.left - p && x <= r.left + r.width + p && y >= r.top - p && y <= r.top + r.height + p;
  function allowedAt(e) {
    if (!gateOn || !active) return true;
    if (selfClick && !e.isTrusted) return true;   // the quest itself pressing a tab
    const tg = e.target;
    if (tg && tg.closest && tg.closest(".kq-layer, .kq-modal, .kc-unlock, .kj-unlock, .k2-renpop, .kcr")) return true;
    if (html.classList.contains("k2-dragging-out")) return true;
    // a second press in a row counts as a double-click (the playground acts on the second mousedown, not on dblclick)
    const dbl = e.type === "dblclick" || (e.detail >= 2 && /down$|^click$/.test(e.type));
    if (ptrOpts.noDbl && dbl && !window.KT2_QUEST_LOOSE) return false;
    // no quest step uses the right mouse button (a menu on a pattern could delete it)
    if ((e.type === "contextmenu" || e.type === "auxclick" || (e.button != null && e.button > 0 && /down$/.test(e.type))) && !window.KT2_QUEST_LOOSE) return false;
    // a double-click on a pattern opens its synth window: only on a step that asks for it (V5p, Eman 20:57)
    if (dbl && !window.KT2_QUEST_LOOSE && !ptrOpts.dblClip && tg && tg.closest && tg.closest(".clip")) return false;
    // V5p (Eman, friend test: other notes could be pressed into the chords): on a step that fills boxes, a press on the
    // note grid only works inside a box still to fill; anywhere else on the grid is NOT NOW. KT2_QUEST_FREE_GRID = old.
    // 10 Nov quest-safe (Eman 10 Nov, playtest: "pressed a note so it became deactivated in the midi and you couldn't turn it on
    // again"): the lock at the right end of each piano key sits 0-3 px left of beat 0, inside the box's own 3 px
    // margin, so a press just left of the first chord locked the row: its notes went quiet and it took no new ones.
    // In a quest the keys strip, Ctrl/Cmd/Alt/Shift presses and a canvas that's only there to listen to never pass.
    // window.KT2_QUEST_SAFE_OFF = old.
    if (safeOn() && tg && tg.closest && tg.closest("#tmm-canvas") && e.type !== "click") {
      if (onKeysStrip(e)) return false;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
      if (!ptrOpts.cells && ringFor === canvasEl) return false;
    }
    if (ptrOpts.cells && !window.KT2_QUEST_FREE_GRID && tg && tg.closest && tg.closest("#tmm-canvas") && e.type !== "click") {
      if (e.button != null && e.button !== 0 && e.type !== "dblclick") return false;
      return !!ptrOpts.cells(e.clientX, e.clientY);
    }
    // a step that draws a box on the empty grid: the patterns themselves can't be grabbed or moved
    if (ptrOpts.noClips && tg && tg.closest && tg.closest(".clip")) return false;
    for (const f of allowFns) {
      let v; try { v = getT(f); } catch (er) { v = null; }
      for (const one of (Array.isArray(v) ? v : [v])) {
        if (!one) continue;
        // a pattern you may click: only the pattern itself, not its own buttons (mute, menu, volume, fades, edges)
        if (!window.KT2_QUEST_LOOSE && one.classList && one.classList.contains("clip") && tg && tg !== one && one.contains(tg) && tg.closest && tg.closest("button, input, .k2-vol, .edge, .fade, .k2-fade, [data-act]") && !allowFns.some((g) => { let w; try { w = getT(g); } catch (er) { w = null; } return w && w !== one && !Array.isArray(w) && w.contains && w.contains(tg); })) continue;
        if (one.contains && tg && one.contains(tg)) return true;
        if (inBox(screenRect(resolve(one)), e.clientX, e.clientY, 4)) return true;
      }
    }
    return false;
  }
  const safeOn = () => !window.KT2_QUEST_SAFE_OFF && !window.KT2_QUEST_LOOSE;
  // the piano keys (and their locks) on the left of the note grid: KEYS css px wide
  function onKeysStrip(e) {
    const c = canvasEl(); if (!c || !("clientX" in e)) return false;
    const r = c.getBoundingClientRect(), k = c.offsetWidth ? r.width / c.offsetWidth : 1, kw = (window.TmMidi && TmMidi._keysW) || 66;
    return e.clientX - r.left < (kw + 1) * k;
  }
  // 10 Nov quest-safe: whatever a press got past the gate, nothing may leave the quest unfinishable. Before every step and
  // every second while one runs: rows locked by hand open again, notes gone quiet in the quest's own patterns
  // play again. KT2_QUEST_SAFE_OFF = old.
  let healT = 0, healing = false;
  async function healSong() {
    if (!safeOn() || !active || healing || held) return;
    healing = true;
    try {
      const st = S(); if (!st) return;
      const mine = () => true;   // the quest song is the quest's own: every lane in it
      try {
        const STORE = "killtoy.tmMidi", all = JSON.parse(localStorage.getItem(STORE) || "{}"); let ch = false;
        for (const t of st.tracks) if (mine(t) && all[t.id] && (all[t.id].flip || []).length) { all[t.id] = { ...all[t.id], flip: [] }; ch = true; }
        if (ch) localStorage.setItem(STORE, JSON.stringify(all));
      } catch (e) { /* fine */ }
      const v = window.TmMidi && TmMidi._s && TmMidi._s();
      if (v && v.sc && (v.sc.flip || []).length && true) {
        v.sc = { ...v.sc, flip: [] }; v.rekey = true;
        try { TmMidi._commit(); TmMidi.draw(); } catch (e) { /* fine */ }
        await rawWait(250);
      }
      for (const t of S().tracks) {
        if (!mine(t)) continue;
        for (const c of t.clips || []) {
          if (!(c.notes || []).some((n) => n.muted)) continue;
          healed++;
          await writeNotes(c.id, c.notes.map((n) => { const o = { ...n }; delete o.muted; return o; }));
        }
      }
    } catch (e) { /* fine */ } finally { healing = false; }
  }
  let healed = 0;
  function nope(e) {
    if (Date.now() - nopeAt < 500) return;
    nopeAt = Date.now();
    snd("nope");
    if (layer) {
      const n = H("div", "kq-nope", "NOT NOW");
      n.style.left = e.clientX + "px"; n.style.top = e.clientY + "px";
      layer.append(n); setTimeout(() => n.remove(), 900);
    }
    busy(false);
    demoSoon();
    if (ring) ring.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 260 });
  }
  // the KILLTOY logo always works in a quest: it pauses (the step is kept) and goes to the QUESTS menu (Eman, 17:44).
  // CONTINUE picks up at that step. window.KT2_QUEST_LOGO_LOCKED = the logo locked like the rest.
  // V5w (Eman 22:44: "wherever I am in a quest, if I'm inside a chord, or whatever I'm in, I should always be able to
  // press the Kill Toy logo"): an open pattern window (#iw) lies over the whole page, logo included, so the press is
  // matched by where it lands, not by what it lands on. window.KT2_QUEST_LOGO_TARGET = only a press right on the logo.
  const onLogoSpot = (e) => {
    if (window.KT2_QUEST_LOGO_TARGET || !("clientX" in e)) return false;
    const l = document.getElementById("logo"); if (!l || !l.offsetWidth) return false;
    const r = l.getBoundingClientRect(); return inBox(r, e.clientX, e.clientY, 0);
  };
  const onLogo = (e) => !window.KT2_QUEST_LOGO_LOCKED && ((e.target && e.target.closest && e.target.closest("#logo")) || onLogoSpot(e));
  // careless-player test (8 Nov): a drag that only ENDS on the logo is not a logo press. The press has to start on it
  // too (pointerdown on the logo, then the click within 2 s), or a drag from the tools leaves the quest.
  let logoDownAt = 0;
  const isLogo = (e) => {
    if (e.type === "pointerdown") { logoDownAt = onLogo(e) ? Date.now() : 0; return !!logoDownAt; }
    if (e.type === "mousedown") return !!logoDownAt && onLogo(e);
    return onLogo(e) && Date.now() - logoDownAt < 2000;
  };
  function logoOut() {
    stop(true);
    try { if (typeof closeLaneWindow === "function") closeLaneWindow(); } catch (er) { /* fine */ }
    try { if (window.KT2Quest.showQuests) KT2Quest.showQuests(); else if (typeof showHome === "function") showHome(true); } catch (er) { /* fine */ }
  }
  // pressing the guide (the cat, or the old head) goes back one step so you can make it again (Eman, 20:44).
  // window.KT2_QUEST_GUIDE_LOCKED = the guide locked like the rest.
  const isGuide = (e) => !window.KT2_QUEST_GUIDE_LOCKED && e.target && e.target.closest && e.target.closest(".kc-hit, .kt-av");
  // V5p (careless-player test): the gate must hear every press and key BEFORE anything else on the page, or a shortcut
  // of another part (C = scissors, Q+1 = cue) slips through. app2.html's first script makes window.__qEarly, run before
  // every other listener; without it (older page) the gate listens as before.
  const onEarly = (type, fn) => { const q = window.__qEarly; if (q && q[type]) q[type].push(fn); else addEventListener(type, fn, true); };
  ["pointerdown", "mousedown", "click", "dblclick", "contextmenu", "auxclick"].forEach((type) => onEarly(type, (e) => {
    if (!active) return;
    if (isLogo(e)) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (type === "click") logoOut();
      return;
    }
    if (gateOn && isGuide(e)) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (type === "click") goBack();
      return;
    }
    if (!gateOn) return;
    if (allowedAt(e)) {
      if (type === "pointerdown") { if (e.isTrusted && !window.KT2_QUEST_SHOW_FIRST) cutGhost(); lastAct = Date.now(); const tg = e.target; if (!(tg.closest && tg.closest(".kq-layer, .kq-modal"))) busy(true); }
      return;
    }
    e.preventDefault(); e.stopImmediatePropagation();
    if (type === "pointerdown") nope(e);
  }));
  // V5p (Eman: "VERY IMPORTANT", nothing but the set-out notes or buttons): on a step that only asks for a click, a
  // pressed-and-moved mouse moves nothing (a pattern, a slider or a knob can't be dragged by mistake). Steps that ask
  // for a drag say drag: true. window.KT2_QUEST_LOOSE = the old, looser gate.
  let downOk = false;
  addEventListener("pointerdown", (e) => { downOk = !gateOn || !active || !!ptrOpts.drag || !!window.KT2_QUEST_LOOSE || !!(e.target && e.target.closest && e.target.closest(".kq-layer, .kq-modal, .kc-unlock, .kj-unlock, .k2-renpop, .kcr")); }, true);
  ["pointermove", "mousemove"].forEach((type) => onEarly(type, (e) => {
    if (!gateOn || !active || downOk || !e.buttons || html.classList.contains("k2-dragging-out")) return;
    e.stopImmediatePropagation();
  }));
  // a key held down whose press was stopped: its letting go is stopped too (Q held + 1 made a cue)
  const keysStopped = new Set();
  onEarly("keyup", (e) => { if (keysStopped.has(e.code)) { keysStopped.delete(e.code); if (gateOn && active) { e.preventDefault(); e.stopImmediatePropagation(); } } });
  onEarly("keypress", (e) => { if (gateOn && active && keysStopped.has(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); } });
  onEarly("keydown", (e) => {
    if (!gateOn || !active) return;
    const tg = e.target;
    if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
    if (html.classList.contains("k2-dragging-out")) return;
    // V5p: ENTER and ESC only in a box or a menu (ESC closed the pattern window and the step got stuck). KT2_QUEST_LOOSE = old.
    const menuUp = !!document.querySelector(".k2-renpop, .ctx-menu, .k2-keypick, #pop:not([hidden])");
    if (e.key === " " && !e.metaKey && !e.ctrlKey && !e.altKey) { lastAct = Date.now(); return; }
    if ((e.key === "Enter" || e.key === "Escape") && !e.metaKey && !e.ctrlKey && !e.altKey && (menuUp || window.KT2_QUEST_LOOSE)) { lastAct = Date.now(); return; }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && /^[=+\-_0]$/.test(e.key)) { lastAct = Date.now(); return; }   // zoom
    // Cmd+D only on a step that asks for it (V5a: nothing happens that the quest didn't ask for)
    if ((e.metaKey || e.ctrlKey) && !e.altKey && /^[dD]$/.test(e.key) && (ptrOpts.dupOk || window.KT2_QUEST_R2_LOOK)) { lastAct = Date.now(); return; }
    if (keysOk && keysOk.test(e.key)) { lastAct = Date.now(); return; }
    if (/^(Shift|Alt|Control|Meta|CapsLock)$/.test(e.key)) return;
    keysStopped.add(e.code);
    e.preventDefault(); e.stopImmediatePropagation();
  });
  // Out of the way (Eman: "once I pressed pick a key, the overlay and the pick-a-key disappear"): once you press the
  // right thing, the ring, the words, her bubble and the quest bar fade, and come back after a few quiet seconds.
  let busyT = 0;
  function busy(on) {
    clearTimeout(busyT);
    html.classList.toggle("kq-busy", !!on);
    if (on) { const back = () => { if (document.querySelector(".k2-keypick, .ctx-menu, .k2-renpop") || html.classList.contains("k2-dragging-out") || (document.querySelector(":active") && false)) { busyT = setTimeout(back, 600); return; } if (Date.now() - lastAct < 4000) { busyT = setTimeout(back, 600); return; } html.classList.remove("kq-busy"); }; busyT = setTimeout(back, 4000); }
  }
  addEventListener("pointerup", () => { lastAct = Date.now(); }, true);

  // ---------------------------------------------------------------- the demo cursor
  // An acid-yellow arrow, the size of the real one (Eman, 7 Nov 13:00), that does the move once, with sounds, and
  // what it makes looks like the real thing: a pattern being pulled out (the app's own drag-out ghost with its size
  // tag) that turns into a pattern and is then deleted; a note that grows as it's drawn; the app's own selection box.
  // KT2_GHOST_OLD = the purple hand with purple trails.
  const CUR_SVG = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 3l14 8-6 1.6L9.6 19z" fill="#e9dcff" stroke="#9b5cff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const ACID = {
    arrow: ['<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 2v19l4.8-4.4 3.3 7 2.9-1.3-3.2-6.9h6.6z" fill="#E4FF3A" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>', 4, 2],
    resize: ['<svg viewBox="0 0 24 24" width="24" height="24"><path d="M1.5 12l5.5-5.5v3.5h10v-3.5l5.5 5.5-5.5 5.5v-3.5h-10v3.5z" fill="#E4FF3A" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>', 12, 12],
  };
  const acidOn = () => !window.KT2_GHOST_OLD;
  function acidCursor(el, shape) {
    const [svg, hx, hy] = ACID[shape] || ACID.arrow;
    el.classList.add("acid");
    const old = el.querySelector("svg"); if (old) old.remove();
    el.insertAdjacentHTML("beforeend", svg);
    const sv = el.querySelector("svg");
    Object.assign(sv.style, { left: -hx + "px", top: -hy + "px" });
    el.style.setProperty("--hx", hx + "px"); el.style.setProperty("--hy", hy + "px");
  }
  // little sounds for the demo (WebAudio of KT2Juice where it can; a click of our own otherwise)
  let actx = null;
  function blip(f, dur, type, gain, f2, delay) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime + (delay || 0), o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain || 0.05, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* no sound */ }
  }
  // in key (Eman, 7 Nov): ticks, coins and the "made it" lift follow the project key (KT2Key in
  // playground.js); the click, poof and drag sweeps stay. KT2_SFX_KEY_OLD = the old pitches
  const KK = () => (window.KT2Key && window.KT2Key.on() ? window.KT2Key : null);
  const sClick = () => { blip(2200, 0.03, "square", 0.03, 900); blip(1200, 0.05, "sine", 0.04, 600, 0.004); };
  const sTick = (i) => blip(KK() ? KK().degree(523, i || 0) : 520 + (i || 0) * 60, 0.05, "triangle", 0.05, null);
  const sMade = () => { snd("paint"); const f = KK() ? KK().root(880) : 880; blip(f, 0.12, "triangle", 0.04, f * 1.5, 0.02); };
  const sPoof = () => { snd("poof"); blip(500, 0.18, "sine", 0.04, 160); };
  const sDrag = () => blip(300, 0.25, "sawtooth", 0.012, 700);
  const sCoin = (i) => { const f = KK() ? KK().degree(1568, i % 5, KK().minor() ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]) : 1568 + (i % 5) * 70; blip(f, 0.07, "square", 0.025); blip(f * 1.5, 0.16, "square", 0.02, null, 0.06); };
  async function ghostMove(from, to, o) {
    o = o || {};
    if (!layer || !from) return;
    const go = demoGo, cut0 = ghostCut;
    const g = H("div", "kq-ghost"); g.innerHTML = '<i class="kq-tap"></i>' + CUR_SVG; layer.append(g);
    if (acidOn()) acidCursor(g, o.shape);
    const tap = g.firstChild;
    const at = (p) => Object.assign(g.style, { left: p.x + "px", top: p.y + "px" });
    const live = () => go === demoGo && cut0 === ghostCut && g.isConnected;
    const press = async () => { g.classList.add("down"); sClick(); tap.animate([{ opacity: 1, transform: "scale(.4)" }, { opacity: 0, transform: "scale(1.5)" }], { duration: 420 }); await wait(110); g.classList.remove("down"); await wait(90); };
    at({ x: from.x + 60, y: from.y + 50 }); g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    await wait(20); g.style.transition = "left .45s, top .45s"; at(from); await wait(520); g.style.transition = "";
    if (!live()) return g.remove();
    if (o.dbl) { await press(); await wait(40); await press(); await wait(220); } else if (!to) await press();
    let tr = null, made = null;
    if (to && live()) {
      g.classList.add("down");
      if (!o.dbl) { sClick(); tap.animate([{ opacity: 1, transform: "scale(.4)" }, { opacity: 0, transform: "scale(1.5)" }], { duration: 420 }); }
      if (o.trail === "pattern" && acidOn()) {
        tr = H("div", "k2-dragout kq-fake");
        const col = (typeof freshColors === "function" ? freshColors(1)[0] : null) || "#9b5cff";
        tr.style.setProperty("--c", col); tr.style.setProperty("--bar", barPx() + "px"); tr.style.setProperty("--beat", barPx() / 4 + "px");
        tr.append(H("div", "k2-dragout-tag"));
      } else if (o.trail === "note" && acidOn()) tr = H("div", "kq-fakenote kq-fake");
      else if (o.trail === "box" && acidOn()) tr = H("div", "k2-box kq-fake");
      else if (o.trail) { tr = H("div", "kq-trail" + (o.trail === "box" ? " box" : "")); if (o.label) tr.append(H("b")); }
      if (tr) layer.append(tr);
      if (o.trail === "box" || o.trail === "note") sDrag();
      const t0 = performance.now(), dur = o.dur || 1100;
      let lastStep = -1;
      await new Promise((res) => {
        const step = () => {
          if (!live()) return res();
          const k = Math.min(1, (performance.now() - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e;
          at({ x, y });
          if (tr) {
            if (o.trail === "box") Object.assign(tr.style, { left: Math.min(from.x, x) + "px", top: Math.min(from.y, y) + "px", width: Math.abs(x - from.x) + "px", height: Math.abs(y - from.y) + "px" });
            else { const h = o.h || 18, x0 = o.x0 != null ? o.x0 : from.x; Object.assign(tr.style, { left: Math.min(x0, x) + "px", top: (o.y0 != null ? o.y0 : from.y - h / 2) + "px", width: Math.max(4, Math.abs(x - x0)) + "px", height: h + "px" }); }
            const lab = o.label ? o.label(e) : null;
            const tagEl = tr.querySelector(".k2-dragout-tag, b");
            if (lab != null && tagEl) tagEl.textContent = lab;
            if (o.steps) { const s = Math.floor(e * o.steps + 1e-6); if (s !== lastStep) { lastStep = s; sTick(s); } }
          }
          if (k < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
      g.classList.remove("down");
      if (o.click && live()) { await wait(250); await press(); }
      else if (live()) snd("release");
      // what it made: the pattern ghost becomes a pattern, a note stays a note; a moment later it's deleted again
      if (tr && live() && o.trail === "pattern" && acidOn()) {
        const r = tr.getBoundingClientRect(), col = tr.style.getPropertyValue("--c");
        tr.remove(); tr = null;
        made = H("div", "kq-fakeclip kq-fake"); made.style.setProperty("--c", col);
        Object.assign(made.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
        layer.append(made); sMade();
        made.animate([{ transform: "scaleY(.2)", opacity: 0 }, { transform: "scaleY(1.08)", opacity: 1 }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,1.4,.4,1)" });
      } else if (tr && live() && o.trail === "note") { sMade(); made = tr; tr = null; made.classList.add("set"); }
    }
    await wait(made ? 1100 : 600);
    g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" });
    if (made) { sPoof(); made.animate([{ transform: "none", opacity: 1, filter: "none" }, { transform: "scale(.6)", opacity: 0, filter: "blur(3px)" }], { duration: 380, easing: "ease-in", fill: "forwards" }); }
    if (tr) tr.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
    await wait(400);
    [g, tr, made].forEach((n) => n && n.remove());
  }
  const mid = (r) => r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };

  // something done wrong turns red, says what's wrong, and goes away so you can try again (Eman, 7 Nov)
  function wrongAt(t, word) {
    snd("nope");
    const r = resolve(t);
    if (!r || !layer) return;
    const b = H("div", "kq-bad"); putIn(b, r.host);
    Object.assign(b.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    const sr = screenRect(r), w = H("div", "kq-badtip", word);
    layer.append(w); placeTip(w, sr);
    setTimeout(() => { b.remove(); w.remove(); }, /\n/.test(word) ? 2200 : 1400);
    demoSoon();
  }

  // ---------------------------------------------------------------- watching the real commands
  const watchers = new Set();
  function hookRun() {
    if (hookRun.done || typeof window.run !== "function") return;
    hookRun.done = true;
    const orig = window.run;
    window.run = function (cmd, args) {
      const p = orig.apply(this, arguments);
      if (watchers.size) Promise.resolve(p).then((r) => { if (r && r.error) return; watchers.forEach((w) => { try { w(cmd, args || {}, r); } catch (e) { console.warn("[quest]", e); } }); }, () => {});
      return p;
    };
  }
  // resolves when test(cmd, args, result) returns true; onEach runs for every command
  function until(test) {
    return new Promise((resolve, reject) => {
      if (halt) return reject(new Error("quest stopped"));
      const w = (cmd, args, r) => { if (test(cmd, args, r)) { watchers.delete(w); resolve({ cmd, args, r }); } };
      watchers.add(w);
      const prev = cancel;
      cancel = () => { watchers.delete(w); reject(new Error("quest stopped")); if (prev) prev(); };
    });
  }
  function untilState(test, every = 250) {
    return new Promise((resolve, reject) => {
      if (halt) return reject(new Error("quest stopped"));
      const t = setInterval(() => { try { if (test()) { clearInterval(t); resolve(); } } catch (e) { /* not yet */ } }, every);
      const prev = cancel;
      cancel = () => { clearInterval(t); reject(new Error("quest stopped")); if (prev) prev(); };
    });
  }

  // ---------------------------------------------------------------- the song (Eman's notes on V4w, 7 Nov 13:00)
  // A MINOR, every note already laid out as boxes: you press into the boxes and get a song that hits.
  // Am F C G (i VI III VII, the most cried-to loop there is) with a top melody above the chords that
  // climbs to the F and falls back, ending on B so the loop pulls home to A. 4 bars, duplicated to 8 in this
  // quest; quest 2 makes bars 5 to 8 unique and turns them into the answer, so the 4 bars must loop well.
  const SONG = {
    tonic: 9, minor: true,
    chords: [[[57, 60, 64], 0, 4], [[57, 60, 65], 4, 4], [[55, 60, 64], 8, 4], [[55, 59, 62], 12, 4]]
      .flatMap(([ps, start, length]) => ps.map((pitch) => ({ pitch, start, length }))),
    melody: [[69, 0, 1], [72, 1, 1], [76, 2, 2], [77, 4, 1.5], [76, 5.5, 0.5], [72, 6, 2], [76, 8, 1], [74, 9, 1], [72, 10, 1], [76, 11, 1], [74, 12, 3], [71, 15, 1]]
      .map(([pitch, start, length]) => ({ pitch, start, length })),
  };
  const S = () => (typeof ui !== "undefined" ? ui.state : null);
  const track = (id) => S().tracks.find((t) => t.id === id);
  const clipOf = (id) => S().tracks.flatMap((t) => t.clips).find((c) => c.id === id);
  const clipEl = (id) => $(`.clip[data-clip-id="${id}"]`);
  const ids = {};
  // A fully empty project: the person makes every pattern (Eman, 7 Nov 01:10: "fully empty the first time")
  // the quest's own song (Eman, 7 Nov): not a project in ALL PROJECTS, it lives in its quest, one per quest, and
  // starting the quest again replaces it. Old way (a plain New project) = window.KT2_QUEST_IN_PROJECTS or no questSession.
  const questSongName = (song) => "QUEST " + (QI + 1) + " \u00b7 " + song;
  async function makeStarter(song) {
    song = song || "NIGHT SHIFT";
    let r = null;
    if (!window.KT2_QUEST_IN_PROJECTS && !window.KT2_QUEST_OLD_SET) { try { r = await run("questSession", { quest: QI + 1, name: questSongName(song) }); } catch (e) { r = null; } }
    const viaQuest = !!(r && r.ok);
    if (!viaQuest) r = await run("newSession");
    if (!r || r.error) throw new Error((r && r.error) || "no project");
    if (typeof showHome === "function") showHome(false);
    await wait(300);
    if (!viaQuest) { try { await run("renameSession", { name: song }); } catch (e) { /* keeps New project N */ } }
    await run("setBpm", { bpm: 140 });
    // no "Drop a beat in" card: the empty grid is where the quest starts (and html.kq-on hides it for good)
    try { ui.emptyOff = S().session; ui.selectedClip = null; render(); } catch (e) { /* fine */ }
  }

  // ---------------------------------------------------------------- helpers for the moments
  const notesOf = (cid) => ((clipOf(cid) || {}).notes || []);
  const editorOpen = () => { const c = $("#tmm-canvas"); return !!(c && c.offsetParent); };
  const winOpen = () => { const w = $("#iw"); return !!(w && !w.hidden); };
  const closeWin = async () => { if (typeof closeLaneWindow === "function" && winOpen()) { try { closeLaneWindow(); } catch (e) { /* fine */ } } await wait(300); };
  // the + LOAD button of a pattern; never the whole pattern (V5p: a double-click on the pattern opened another synth).
  // window.KT2_QUEST_LOOSE = the pattern itself when there's no button.
  const pill = (cid) => () => { const c = clipEl(cid); return c && ($(".k2p-clippill", c) || $(".k2p-clipadd", c) || (window.KT2_QUEST_LOOSE ? c : null)); };
  const iwButton = (re) => [...document.querySelectorAll("#iw button")].find((b) => b.offsetParent && re.test((b.textContent || "").trim()));
  // V6 (Eman, 8 Nov 03:11, all quests): a box over patterns starts anywhere on the empty grid, like on a desktop.
  // No little spot, no button, no shade on the playground; the cursor shows it, and every time it shows it a bit
  // differently (another start, a bigger or smaller box) so it's clear there's no exact place to press.
  // window.KT2_QUEST_BOX_SPOT = the old "PRESS HERE" spot.
  const boxFree = () => !window.KT2_QUEST_BOX_SPOT;
  function boxDemo(rFn) {
    let n = 0;
    return () => {
      const r = rFn(); if (!r) return;
      const R = Math.random, rows = $("#rows"), rr = rows && rows.getBoundingClientRect();
      const maxX = Math.min(innerWidth - 24, rr ? rr.right - 8 : 1e9), maxY = rr ? Math.min(innerHeight - 24, rr.bottom - 8) : innerHeight - 24;
      const low = (n++ % 2 === 0) ? R() < 0.75 : R() < 0.35;   // mostly from below-right, sometimes from the right at the top
      const x0 = Math.min(maxX, r.left + r.width + 24 + R() * 150);
      const y0 = low ? Math.min(maxY, r.top + r.height + 10 + R() * 70) : r.top + 4 + R() * 10;
      const x1 = r.left + 6 + R() * Math.max(4, r.width * 0.3);
      const y1 = low ? r.top + 4 + R() * 10 : r.top + r.height - 4 - R() * 10;
      return ghostMove({ x: x0, y: y0 }, { x: x1, y: y1 }, { trail: "box", dur: 1100 + R() * 600 });
    };
  }
  const BOX_HELP = "Stuck? Press anywhere on the empty grid, keep holding, and drag a box over the patterns. Where you start doesn't matter.";
  function unionRect(els) {
    const rs = els.filter(Boolean).map((e) => e.getBoundingClientRect()).filter((r) => r.width);
    if (!rs.length) return null;
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
    return { left: l, top: t, width: Math.max(...rs.map((r) => r.right)) - l, height: Math.max(...rs.map((r) => r.bottom)) - t };
  }
  // the other patterns' notes, faint behind the grid (the MIDI editor's own "Reference" switch)
  function ghostOn() { const g = $("#tmm-ghost"); if (g && !g.checked) { g.checked = true; g.dispatchEvent(new Event("change")); } }
  // the grid scrolls so all the boxes are on screen (V4w: the slots sat above the visible rows, so nothing showed)
  async function centreGrid(notes) { try { if (window.TmMidi && TmMidi.centre) TmMidi.centre(notes); } catch (e) { /* fine */ } await wait(120); }
  // a spot on the MIDI grid, drawn inside the pattern window: beats from the clip start, from pitch lo up to hi
  function gridRect(start, length, lo, hi) {
    if (!window.TmMidi || !TmMidi._loc) return null;
    const a = TmMidi._loc({ pitch: hi == null ? lo : hi, start, length }), b = TmMidi._loc({ pitch: lo, start, length });
    if (!a || !b) return null;
    const host = a.cv.closest("#iw-card"), o = host && offsetIn(a.cv, host);
    if (!o) return null;
    return { host, left: o.x + a.x0, top: o.y + a.y + 1, width: Math.max(6, a.x1 - a.x0), height: b.y - a.y + a.h - 2 };
  }
  const canvasEl = () => $("#tmm-canvas");
  // SPACE in the pattern window plays the whole song (FULL), so the chords play under the melody (Eman, 7 Nov)
  let playModeWas;
  function playFull() { try { if (playModeWas === undefined) playModeWas = localStorage.getItem("killtoy.playMode"); localStorage.setItem("killtoy.playMode", "full"); } catch (e) { /* fine */ } }
  function playModeBack() { try { if (playModeWas === undefined) return; if (playModeWas == null) localStorage.removeItem("killtoy.playMode"); else localStorage.setItem("killtoy.playMode", playModeWas); playModeWas = undefined; } catch (e) { /* fine */ } }
  // our own note writes are not the person's moves
  let writing = 0;
  async function writeNotes(cid, notes) {
    writing++;
    try { await run("setMidiNotes", { clipId: cid, notes }); } finally { setTimeout(() => writing--, 150); }
    // nothing stays picked, so the compound menu doesn't pop up over the next box
    setTimeout(() => { try { if (window.TmMidi) { TmMidi.hide(); TmMidi.draw(); } } catch (e) { /* fine */ } }, 60);
  }
  // the song's key as pitch classes
  function keyNow() {
    const k = (S() && S().key) || {}, SC = window.KT_SCALES || {};
    const tonic = k.tonic != null ? k.tonic : 6;
    const name = k.scale && SC[k.scale] ? k.scale : k.minor === false ? "major" : "minor";
    return { tonic, name, minor: name !== "major" && name !== "lydian" && name !== "mixolydian", steps: (SC[name] || { steps: name === "major" ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10] }).steps };
  }
  const isAminor = () => { const k = keyNow(); return k.tonic === SONG.tonic && k.name === "minor"; };

  // TOY MACHINE sounds for the quest: up to 10 chord-friendly ones (pads, keys, chord synths), then
  // up to 10 melody ones that match the chord sound (same song family first, Eman, 7 Nov)
  let tmIndex = null;
  async function presetIndex() { if (!tmIndex) { try { const r = await run("toyMachinePresets"); tmIndex = (r && r.presets) || []; } catch (e) { tmIndex = []; } } return tmIndex; }
  const fam = (n) => (/ - /.test(n || "") ? n.split(" - ")[0].trim().toLowerCase() : null);
  const CHORDY = (p) => p.category === "Pads" || p.category === "Keys" || (p.category === "Synths" && /chord|string/i.test(p.name));
  // V4x (Eman, 7 Nov 14:10): the chord sounds were muddy. Now electric pianos, Rhodes-style keys: clean and clear first,
  // two a bit dirtier at the end. KT2_QUEST_OLD_CHORD_SOUNDS = the old pads and keys.
  const EP_CHORDS = ["Electric piano Keys", "SO FS1 Keys - Electric Piano", "Soft", "Piano 2", "Magic", "Cave", "Glide", "Votrix", "Farallon", "Creep Electric Piano"];
  const EPISH = (p) => p.category === "Keys" && ((p.tags || []).includes("electric piano") || /electric piano|rhodes|\bep\b/i.test(p.name + " " + (p.tags || []).join(" ")));
  // TOY KEYS sounds for quest 1: clear keys for the chords (one a bit dusty), brighter ones for the melody on top
  const TK_CHORDS = ["Classic EP", "Studio Grand", "Silk EP", "Wurli", "Soft Felt", "Night Keys", "Dusty EP"];
  // melody picks sit above the chords (Eman, 7 Nov: "you can't pick the wrong choice"): bells and the three LEAD presets
  // are levelled as a top line; Night Keys / Silk EP / Classic EP were 1 to 3 dB under the chords. KT2_QUEST_OLD_SOUNDS = old.
  const TK_MELODY = window.KT2_QUEST_OLD_SOUNDS ? ["Glass Bells", "Music Box", "Night Keys", "Wurli", "Silk EP", "Clav", "Classic EP"]
    : ["Glass Bells", "Music Box", "Piano Lead", "EP Lead", "Wurli Lead", "Clav", "Wurli"];
  const MELODIC = (p) => p.category === "Plucks" || p.category === "Leads";
  async function chordSounds() {
    const all = await presetIndex(), withMel = new Set(all.filter(MELODIC).map((p) => fam(p.name)).filter(Boolean));
    const out = [], seen = new Set();
    if (!window.KT2_QUEST_OLD_CHORD_SOUNDS) {
      for (const nm of EP_CHORDS) { const p = all.find((x) => x.name === nm && x.category === "Keys"); if (p) out.push(p); }
      for (const p of all) { if (out.length >= 10) break; if (EPISH(p) && !out.includes(p)) out.push(p); }
      if (out.length >= 6) return out.slice(0, 10);
    }
    const want = ["Blue Hour - Keys 1", "Atlas - Pad", "Air Maxes - Chords"];
    for (const nm of want) { const p = all.find((x) => x.name === nm); if (p) { out.push(p); seen.add(fam(p.name)); } }
    for (const p of all) { if (out.length >= 10) break; const f = fam(p.name); if (CHORDY(p) && f && withMel.has(f) && !seen.has(f)) { out.push(p); seen.add(f); } }
    for (const p of all) { if (out.length >= 10) break; if (CHORDY(p) && !out.includes(p)) out.push(p); }
    return out;
  }
  async function melodySounds(chordPreset) {
    const all = await presetIndex(), f = chordPreset && fam(chordPreset.name), tags = new Set((chordPreset && chordPreset.tags) || []);
    const out = window.KT2_QUEST_OLD_SOUNDS ? all.filter((p) => MELODIC(p) && f && fam(p.name) === f).slice(0, 4)
      : all.filter((p) => MELODIC(p) && fam(p.name) === "night shift").slice(0, 10);   // the NIGHT SHIFT top lines fit any chord pick
    const score = (p) => (p.tags || []).filter((t) => tags.has(t)).length;
    for (const p of all.filter((p) => MELODIC(p) && !out.includes(p)).sort((a, b) => score(b) - score(a))) { if (out.length >= 10) break; out.push(p); }
    return out;
  }
  // TOY KEYS (Eman, 7 Nov 14:17): quest 1 plays on the simple keys plugin, TOY MACHINE is what you win.
  // Until TOY KEYS is in the build, quest 1 borrows TOY MACHINE with its electric pianos.
  const hasToyKeys = () => !window.KT2_QUEST_NO_TOYKEYS && !!(window.KT2Pick && (KT2Pick.SYNTHS || []).some((x) => (x.key || x) === "builtin:toykeys"));
  const q1Synth = () => window.KT2_QUEST_Q1_SYNTH || (hasToyKeys() ? "builtin:toykeys" : "builtin:toymachine");
  const instOf = (tid) => { const t = track(tid); return t && [...(t.plugins || []), ...t.clips.flatMap((c) => c.plugins || [])].find((p) => p.instrument); };
  async function loadSound(tid, p) {
    const plug = instOf(tid);
    if (!plug || !p) return;
    const got = await run("toyMachineLoadPreset", { id: p.id || p.file, file: p.file });
    if (got && got.preset) await run("toyMachineSetPreset", { pluginId: plug.id, preset: got.preset });
  }

  // the size tag of a pattern being pulled out: red until it says 4 BARS, then green (Eman, 7 Nov)
  const BARS = 4;
  let tagTimer = 0;
  function wantBars(on) {
    html.classList.toggle("kq-wantbars", on);
    clearInterval(tagTimer);
    if (on) tagTimer = setInterval(() => document.querySelectorAll(".k2-dragout-tag").forEach((t) => t.classList.toggle("kq-ok", t.textContent.trim() === BARS + " BARS")), 50);
  }
  const barsOf = (cid) => { const c = clipOf(cid); return c && typeof secPerBar === "function" ? c.length / secPerBar() : 0; };
  const barsOk = (cid) => Math.abs(barsOf(cid) - BARS) < 0.05;
  const barPx = () => (typeof secPerBar === "function" && typeof ui !== "undefined" && ui.pxPerSec ? secPerBar() * ui.pxPerSec : 60);
  const firstEmptyRow = () => $("#rows .row.k2-ghost:not(.k2-gap) .lane");
  const tab = (w) => () => iwButton(new RegExp("^" + w + "\\b", "i"));
  const viewNow = () => (typeof iw !== "undefined" && iw ? iw.view : null);

  // MAKE A PATTERN (Eman, 7 Nov 13:00): the acid cursor shows it ONCE at the very start of the row: double-click,
  // the app's own drag-out ghost grows to 4 BARS, click, it becomes a pattern, and it's deleted again. Then
  // "now you try" with two tags: DOUBLE-CLICK HERE at the start, PULL TO 4 BARS, CLICK at the end. A pattern
  // that isn't 4 bars turns red, says so and is removed, and you try again.
  // the view glides in to what matters (Eman, V4x: "like we're zooming in the software"); 7 bars on screen to make a
  // pattern (V4w had 10: too far out)
  const visW = () => { const sc = $("#scroll"); return sc ? sc.clientWidth - (typeof HEAD_W === "number" ? HEAD_W : 0) : innerWidth; };
  async function glide(pps, left, ms) {
    const sc = $("#scroll"); if (!sc || typeof ui === "undefined") return;
    const p0 = ui.pxPerSec, l0 = sc.scrollLeft, t0 = performance.now(), dur = ms || 450;
    pps = Math.max(3, Math.min(typeof zoomMax === "function" ? zoomMax() : 4000, pps));
    ui.fitted = false;
    await new Promise((res) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        ui.pxPerSec = p0 * Math.pow(pps / p0, e);
        if (typeof relayoutTimeline === "function") relayoutTimeline();
        sc.scrollLeft = l0 + ((left || 0) - l0) * e;
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    ui.laneSig = ""; render();
  }
  function questZoom(bars) {
    try { if (typeof secPerBar !== "function") return; return glide((visW() - 24) / ((bars || 7) * secPerBar()), 0); } catch (e) { /* fine */ }
  }
  // close on one pattern: it fills about half the screen
  function focusOn(cid) {
    const c = clipOf(cid); if (!c) return;
    const pps = (visW() * 0.55) / c.length;
    return glide(pps, Math.max(0, c.start * pps - visW() * 0.12));
  }
  // while you pull a pattern out: a plain line where 4 bars ends and STOP HERE, CLICK under it (V4x: no outline on the
  // row, no red or green on the size tag, it looks exactly like it does without the quest)
  function stopMarker(spot) {
    let m = null, tp = null, at = null;
    const t = setInterval(() => {
      const on = html.classList.contains("k2-dragging-out");
      if (on && !at) at = spot();
      if (!on) { at = null; if (m) { m.remove(); tp.remove(); m = tp = null; } return; }
      if (!at || !layer) return;
      if (!m) { m = H("div", "kq-mark"); tp = H("div", "kq-tip kq-keep", "STOP HERE, CLICK"); layer.append(m, tp); snd("tick", 4); }
      const x = at.left + at.width / 2;
      Object.assign(m.style, { left: x + "px", top: at.top - 4 + "px", height: at.height + 8 + "px" });
      placeTip(tp, { left: x - 1, top: at.top - 4, width: 2, height: at.height + 8 });
    }, 40);
    return () => { clearInterval(t); if (m) { m.remove(); tp.remove(); } };
  }
  let atBar = 0;   // where the pattern starts (quest 2's bassline starts at bar 5)
  function rowStart() { const g = firstEmptyRow(); if (!g) return null; const r = g.getBoundingClientRect(); return { left: r.left + atBar * barPx(), top: r.top, height: r.height, y: r.top + r.height / 2 }; }
  function demoPattern() {
    const r = rowStart(); if (!r) return;
    return ghostMove({ x: r.left + 4, y: r.y }, { x: r.left + BARS * barPx(), y: r.y }, { dbl: true, trail: "pattern", x0: r.left + 1, y0: r.top + 2, h: r.height - 4, click: true, dur: 1700, steps: BARS,
      label: (e) => { const b = Math.max(1, Math.ceil(e * BARS - 0.15)); return b + (b > 1 ? " BARS" : " BAR"); } });
  }
  async function dropPattern(tid, cid) {
    try { await run("deleteClip", { clipIds: [cid] }); } catch (e) { /* fine */ }
    try { const t = track(tid); if (t && !t.clips.length) await run("deleteTrack", { trackId: tid }); } catch (e) { /* fine */ }
    await wait(250);
  }
  // o: { bar: start bar (0 = bar 1), synth: tile key, sounds: () => list, label, line, soundLine }
  const startOk = (cid) => { const c = clipOf(cid); return c && typeof secPerBar === "function" && Math.abs(c.start / secPerBar() - atBar) < 0.13; };
  function patternMoment(key, first, o) {
    o = o || {};
    return { id: "new-" + key, label: o.label || (first ? "MAKE A PATTERN" : "ONE MORE PATTERN"), async run() {
      atBar = o.bar || 0;
      await closeWin();
      await questZoom(atBar ? atBar + 6 : 7); await wait(150);
      // a pattern from before that isn't 4 bars goes, and is made again
      if (ids[key] && clipOf(ids[key].c) && !(barsOk(ids[key].c) && startOk(ids[key].c))) { await dropPattern(ids[key].t, ids[key].c); delete ids[key]; }
      if (!(ids[key] && clipOf(ids[key].c))) {
        if (first && showFirst()) {
          say("Watch first. Double-click at the start of the row, pull it out to 4 BARS, click.");
          await wait(500);
          demoGo++; await demoPattern();
        }
        let tries = 0;
        for (;;) {
          const startSpot = () => { const r = rowStart(); return r && { left: r.left, top: r.top, width: 26, height: r.height }; };
          const endSpot = () => { const r = rowStart(); return r && { left: r.left + BARS * barPx() - 13, top: r.top, width: 26, height: r.height }; };
          // V5p: the move shows once while you can already do it; a press of yours stops it
          point(startSpot, { ring: false, tip: "DOUBLE-CLICK HERE", allow: window.KT2_QUEST_LOOSE ? [() => firstEmptyRow()] : [], drag: true, demo: demoPattern, every: 25000, demoNow: first && !tries && !showFirst() });
          say(tries ? "Try again: double-click " + (atBar ? "at bar " + (atBar + 1) : "at the start") + ", then click when it says 4 BARS."
            : o.line || (first ? (showFirst() ? "Now you try. Double-click at the start of the row." : "Double-click at the start of the row, pull it out to 4 BARS, click.") : "Now a pattern for the melody, on the empty row under CHORDS. Same move: double-click at the start."));
          const unmark = stopMarker(endSpot);
          let made;
          try { made = await until((cmd, a) => cmd === "setNoInstrument" && a.on); } finally { unmark(); }
          const tid = made.args.trackId;
          await untilState(() => track(tid) && track(tid).clips.length, 100);
          const cid = track(tid).clips[0].id;
          unslots(); unpoint();
          if (barsOk(cid) && startOk(cid)) { ids[key] = { t: tid, c: cid }; break; }
          const n = Math.round(barsOf(cid) * 4) / 4;
          await wait(80);
          const off = (clipOf(cid).start / secPerBar()) - atBar;
          wrongAt(clipEl(cid), !startOk(cid) ? (off > 0 ? "TOO LATE \u00b7 START AT BAR " : "TOO EARLY \u00b7 START AT BAR ") + (atBar + 1)
            : n < BARS ? "TOO SHORT \u00b7 " + n + (n === 1 ? " BAR" : " BARS") + ", PULL TO 4" : "TOO LONG \u00b7 " + n + " BARS, STOP AT 4");
          await wait(1200);
          await dropPattern(tid, cid);
          tries++;
        }
        writeSave({ ids: Object.assign({}, ids) });
        pop(25);
      }
      const { t: tid, c: cid } = ids[key];
      const synthKey = o.synth || q1Synth(), synthName = /toykeys/.test(synthKey) ? "TOY KEYS" : /toydrums/.test(synthKey) ? "KILLDRUM" : "TOY MACHINE";
      if (track(tid).noInst) {
        const tileEl = () => { const tile = $('.k2p-tile[data-key="' + synthKey + '"]'); return tile && tile.offsetParent ? tile : null; };
        const sayLoad = (onTile) => onTile
          ? point(tileEl, { tip: "DOUBLE-CLICK " + synthName, allow: [pill(cid)], dim: true, soft: true })
          : point(pill(cid), { tip: "+ LOAD", allow: [tileEl], dim: true, soft: true });
        sayLoad(false);
        say(o.loadLine || (first
          ? "An empty pattern has no sound yet. Press + LOAD, then double-click " + synthName + "."
          : "Press + LOAD and double-click " + synthName + " again."));
        let was = false;
        const tileUp = setInterval(() => { const on = !!tileEl(); if (on !== was) { was = on; sayLoad(on); } }, 200);
        // only the synth this step asks for counts; any other that got in anyway is taken off again (V5p)
        try {
          await until((cmd, a) => {
            if (cmd !== "setInstrument" || a.trackId !== tid) return false;
            if (a.key && a.key !== synthKey && !window.KT2_QUEST_LOOSE) {
              setTimeout(async () => { try { await run("setNoInstrument", { trackId: tid, on: true }); await closeWin(); } catch (e) { /* fine */ } wrongAt(clipEl(cid), "NOT THAT ONE \u00b7 DOUBLE-CLICK " + synthName); }, 50);
              return false;
            }
            return true;
          });
        } finally { clearInterval(tileUp); }
        unpoint(); pop(25);
        await untilState(() => instOf(tid), 100);
      }
      if (o.drums) { unpoint(); return; }   // KILLDRUM: its own step picks the beat (quest 3)
      // the sound: in TOY MACHINE's own bar, only the quest's 10
      // TOY KEYS (7 Nov): its window shows sound tiles, no arrows. The quest keeps 7 tiles: clear keys
      // for chords, brighter ones for the melody. The list must be set before the window draws its tiles.
      const tkMode = /toykeys/.test(synthKey);
      if (tkMode) {
        window.TK_ONLY_PRESETS = (first ? TK_CHORDS : TK_MELODY).slice();
        const tiles = document.querySelectorAll("#iw .tk-tile");
        if (tiles.length && tiles.length !== window.TK_ONLY_PRESETS.length && typeof closeLaneWindow === "function") { try { closeLaneWindow(); } catch (e) { /* fine */ } }
      }
      if (!winOpen() || viewNow() !== "inst") {
        if (typeof openLaneWindow === "function") { try { openLaneWindow({ t: track(tid), clip: clipOf(cid), view: "inst" }); } catch (e) { /* fine */ } }
      }
      if (tkMode) {
        await untilState(() => { const r = $("#iw .tk-root"); return r && r.getBoundingClientRect().width > 0; }, 120);
        const tname = () => (($("#iw .tk-name") || {}).textContent || "").trim();
        const name0 = tname();
        let flips = 0;
        const seen = (cmd, a) => { if (cmd === "toyMachineSetPreset" && a.preset) flips++; };
        watchers.add(seen);
        try {
          // first a glow on one tile (the next one along), the rest under the light shade
          const tileList = () => [...document.querySelectorAll("#iw .tk-tile")];
          const tryTile = () => { const ts = tileList(); const i = ts.findIndex((t) => t.classList.contains("on")); return ts[(i + 1) % Math.max(1, ts.length)]; };
          const firstTile = tryTile();
          point(() => (firstTile && firstTile.isConnected ? firstTile : tryTile()), { soft: true, tip: "CLICK TO HEAR IT", dim: true, allow: [() => $("#iw .tk-tiles")] });
          say(o.soundLine || (first
            ? "This is TOY KEYS. Click a sound to hear it. These are clear pianos and keys, made for chords."
            : "Click a sound to hear it. These are brighter keys and bells, made for a melody."));
          await untilState(() => flips > 0 || (tname() && tname() !== name0), 150);
          point(() => $("#iw .tk-tiles"), { soft: true, dim: true });
          await happy("Keep clicking sounds until one feels right. Then press I'M HAPPY or DONE.", "I'M HAPPY WITH THIS SOUND", true);
        } finally { watchers.delete(seen); delete window.TK_ONLY_PRESETS; }
        if (first && tname()) ids.chordSound = { name: tname(), tags: [] };
        unpoint(); pop(50);
      } else {
      await untilState(() => $("#iw .tm-nav") && $("#iw .tm-nav").offsetParent, 120);
      const list = o.sounds ? await o.sounds() : first ? await chordSounds() : await melodySounds(ids.chordSound);
      window.TM_ONLY_PRESETS = list.map((p) => p.id);
      const pname = () => (($("#iw .tm-presetname") || {}).textContent || "").trim();
      const name0 = pname();
      let last = null, flips = 0;
      const seen = (cmd, a) => { if (cmd === "toyMachineSetPreset" && a.preset) { try { last = typeof a.preset === "string" ? JSON.parse(a.preset) : a.preset; } catch (e) { /* fine */ } flips++; } };
      watchers.add(seen);
      const unloopTM = await pickLoop(tid, cid);
      try {
        // BACK on the left arrow, NEXT on the right one (V4w: one tag in the middle was confusing)
        // V4x: first only NEXT glows (a light shade on the rest); once pressed the shade goes and BACK shows too
        const nextBtn = () => $("#iw .tm-next");
        point(nextBtn, { soft: true, tip: "NEXT >", dim: true });
        say(o.soundLine || (first
          ? "This is " + synthName + ". Press NEXT to hear the next sound. These 10 are pianos and keys, made for chords."
          : "Press NEXT to hear melody sounds. These 10 go with your chords."));
        // the TM window sets presets on its own path, so watch the name too
        await untilState(() => flips > 0 || (pname() && pname() !== name0), 150);
        point(() => $("#iw .tm-nav"), { ring: false, tips: [[() => $("#iw .tm-prev"), "< BACK"], [nextBtn, "NEXT >"]] });
        await happy("Keep flipping, back and forth, until one feels right. Then press I'M HAPPY or DONE.", "I'M HAPPY WITH THIS SOUND", true);
      } finally { watchers.delete(seen); delete window.TM_ONLY_PRESETS; await unloopTM(); }
      const picked = list.find((p) => pname() && (pname() === p.name || pname().endsWith(p.name) || p.name.endsWith(pname())));
      if (picked) last = picked;
      if (first && last) ids.chordSound = { name: last.name, tags: last.tags || [] };
      unpoint(); pop(50);
      }
      // the three views (V4w: VST is already on, so she just names it, then SPLIT, then MIDI)
      const press = async (w, tip, line) => {
        point(tab(w), { tip, dim: true, soft: true });
        say(line);
        await untilClick(tab(w)); pop(10);
        await wait(250);
      };
      if (first) {
        point(tab("VST"), { tip: "VST = THE SOUND", dim: true, soft: true });
        say("This window has three views. You're on VST: the sound.");
        await wait(2400);
        await press("SPLIT", "PRESS SPLIT", "SPLIT: the sound and the notes side by side.");
        await press("MIDI", "PRESS MIDI", "MIDI: just the notes. This is where you write.");
      } else {
        await press("MIDI", "PRESS MIDI", "Now press MIDI to write the notes.");
      }
      await untilState(editorOpen);
      unpoint();
    } };
  }
  // name a pattern: double-click its name, a big name box opens (V4w)
  async function zoomLesson(cid) {
    const z0 = ui.pxPerSec, zin = () => $('.k2-zoom button[data-zoom="in"]');
    if (!zin()) return focusOn(cid);
    point(zin, { tip: "PRESS +", dim: true, soft: true, allow: window.KT2_QUEST_LOOSE ? [() => $(".k2-zoom")] : [] });
    say("Zoom in on your pattern. Press +, or hold CMD and scroll, or pinch the trackpad. Pick the way you like.");
    await untilState(() => ui.pxPerSec >= z0 * 1.6, 120);
    unpoint(); pop(25);
    await wait(500);
    const c = clipOf(cid), sc = $("#scroll");
    if (c && sc) await glide(ui.pxPerSec, Math.max(0, c.start * ui.pxPerSec - 40), 350);
  }
  async function nameIt(key, name, first) {
    const { t: tid, c: cid } = ids[key];
    if (first) await zoomLesson(cid); else await focusOn(cid);
    const popOpen = () => !!$(".k2-renpop");
    const nm = () => { if (popOpen()) return null; const c = clipEl(cid); return c && ($(".clip-label .nm", c) || c); };
    const box = () => { const i = $(".k2-renpop input"); return i && i.closest(".box") || i; };
    point(nm, { tip: "DOUBLE-CLICK THE NAME", dim: true, soft: true, dblClip: true, tips: [[box, "TYPE " + name + ", PRESS ENTER", null, "kq-keep"]] });
    say(first ? "Now give it a name. Double-click its name and type " + name + "." : "Name this one " + name + ".");
    const rn = await until((cmd, a) => (cmd === "renameClip" && a.clipId === cid) || (cmd === "renameTrack" && a.trackId === tid));
    const nmv = String(rn.args.name || "").trim() || name;
    await run("renameTrack", { trackId: tid, name: nmv }).catch(() => {});
    await run("renameClip", { clipId: cid, name: nmv }).catch(() => {});
    unpoint(); pop(100, null, true);
    await wait(400);
  }
  // V5p (Eman, 20:51: "if someone naturally presses DONE it works"): while you pick a sound, the window's DONE works the
  // same as I'M HAPPY. keepOpen: the window stays open, the next step happens in it. KT2_QUEST_DONE_LOCKED = old.
  function happy(text, label, keepOpen) {
    const done = () => iwButton(/^Done$/);
    if (window.KT2_QUEST_DONE_LOCKED) return say(text, [[label, true, false, true]]);
    allowFns.push(done);
    return new Promise((resolve) => {
      let over = false;
      const fin = () => { if (over) return; over = true; removeEventListener("click", onDone, true); resolve(true); };
      const onDone = (e) => {
        const b = done(); if (!b || !e.target || !b.contains(e.target)) return;
        if (keepOpen) { e.preventDefault(); e.stopImmediatePropagation(); }
        quiet(); fin();
      };
      addEventListener("click", onDone, true);
      say(text, [[label, true, false, true]]).then(fin);
    });
  }
  // while a sound or beat is picked, its pattern plays on loop by itself, only that pattern (Eman, recorder note V5c
  // 16:31). Returns the stop. Nothing to loop (no notes yet) = nothing plays. window.KT2_QUEST_NO_PICKLOOP = silent.
  async function pickLoop(tid, cid) {
    if (window.KT2_QUEST_NO_PICKLOOP || !cid || !(notesOf(cid) || []).length) return async () => {};
    try { if (ui.transport && ui.transport.playing) await run("togglePlay"); await run("laneSolo", { trackId: tid, clipId: cid }); } catch (e) { return async () => {}; }
    return async () => { try { await run("laneSolo", { on: false }); if (ui.transport && ui.transport.playing) await run("togglePlay"); } catch (e) { /* fine */ } };
  }
  async function pressDone() {
    if (ui.transport && ui.transport.playing) await run("togglePlay");
    point(() => iwButton(/^Done$/), { tip: "DONE", dim: true, soft: true });
    say("Press Done to close the window.");
    await untilState(() => !winOpen());
    unpoint(); pop(10);
  }
  // a painted note fits a box: same row, starts there, ends there (a sixteenth either way is too long / too short)
  const fits = (n, t) => n.pitch === t.pitch && Math.abs(n.start - t.start) < 0.13 && Math.abs(n.start + n.length - (t.start + t.length)) < 0.13;
  function whyWrong(n, targets, used) {
    const same = targets.find((t) => t.pitch === n.pitch && Math.abs(n.start - t.start) < 0.13);
    if (same) { if (targets.some((t, k) => used.has(k) && fits(n, t))) return "ALREADY THERE"; if (window.KT2_QUEST_HINT_OLD) return n.length > same.length ? "TOO LONG \u00b7 LET GO AT THE END OF THE BOX" : "TOO SHORT \u00b7 DRAG TO THE END OF THE BOX";
      // Eman, 8 Nov 03:15: say "click once, then drag" very clearly, not longer
      return n.length > same.length ? "TOO LONG\nLET GO AT THE END OF THE BOX" : "TOO SHORT\nCLICK ONCE, THEN DRAG TO THE END"; }
    // on a box's row but not at its start: too early or too late
    const row = targets.filter((t) => t.pitch === n.pitch && n.start < t.start + t.length && n.start + n.length > t.start);
    if (row.length) { const t = row[0]; return n.start < t.start ? "TOO EARLY \u00b7 START AT THE BOX" : "TOO LATE \u00b7 START AT THE BOX"; }
    if (targets.some((t) => Math.abs(n.start - t.start) < 0.13)) return "WRONG ROW \u00b7 TRY AGAIN";
    return "NOT IN A BOX";
  }
  // the demo note: the acid cursor presses at the start of a box, drags to its end, lets go, the note is there
  function demoNote(t) {
    const r = screenRect(gridRect(t.start, t.length, t.pitch)); if (!r) return;
    const y = r.top + r.height / 2;
    return ghostMove({ x: r.left + 3, y }, { x: r.left + r.width - 1, y }, { trail: "note", x0: r.left, y0: r.top, h: r.height, dur: 1000, steps: Math.max(1, Math.round(t.length * 2)) });
  }
  // press into the boxes: every note of the part is a glowing box; a note that doesn't fit one turns red, says why
  // and goes; a full set ends it
  async function paintBoxes(cid, targets, o) {
    await centreGrid(o.centre || targets);
    const used = () => { const u = new Set(); for (const n of notesOf(cid)) { const i = targets.findIndex((t, k) => !u.has(k) && fits(n, t)); if (i >= 0) u.add(i); } return u; };
    // o.firstN (V5a): only the first N boxes show; once they're in, the rest show with no more help
    const firstDone = () => { if (!o.firstN) return true; const u = used(); for (let k = 0; k < o.firstN; k++) if (!u.has(k)) return false; return true; };
    const open = () => { const u = used(), fd = firstDone(); return targets.filter((t, k) => !u.has(k) && (fd || k < o.firstN)); };
    slots(() => open().map((t) => gridRect(t.start, t.length, t.pitch)), "note");
    const showNow = o.demo && open().length === targets.length && !showFirst();
    if (o.demo && open().length === targets.length && showFirst()) {
      say(o.watch);
      await wait(600);
      demoGo++; await demoNote(targets[0]);
    }
    const first = () => open()[0];
    const cells = (x, y) => open().some((t) => inBox(screenRect(gridRect(t.start, t.length, t.pitch)), x, y, 3));
    slots(() => open().map((t) => gridRect(t.start, t.length, t.pitch)), "note");
    point(() => { const t = first(); return t && gridRect(t.start, t.length, t.pitch); }, { ring: false, tip: window.KT2_QUEST_HINT_OLD ? "PRESS, DRAG, LET GO" : "CLICK ONCE, DRAG, LET GO", allow: [canvasEl], cells, drag: true,
      demo: () => { const t = first(); return t && demoNote(t); }, every: 25000, demoNow: showNow });
    say(showNow && o.try ? o.try : o.now);
    let solo = false;
    // 10 Nov quest-safe (Eman 10 Nov: "if you are struggling a few times it will show you"): the boxes after the first ones get the
    // same help (3 misses or a quiet while = the move is shown on the next box). KT2_QUEST_SAFE_OFF = none, like before.
    const soloHelp = safeOn() ? { demo: () => { const t = first(); return t && demoNote(t); }, every: 25000, help: "Stuck? Click once at the start of a glowing box, hold, drag to its end, let go." } : {};
    const goSolo = () => { if (solo || !o.firstN || !firstDone()) return; solo = true; point(null, { ring: false, allow: [canvasEl], dim: false, cells, drag: true, ...soloHelp }); if (o.rest) say(o.rest); };
    goSolo();
    let had = used().size;
    stepEl.textContent = o.label + " " + had + "/" + targets.length;
    if (had < targets.length) await until((cmd, a) => {
      if (cmd !== "setMidiNotes" || a.clipId !== cid || writing) return false;
      const u = new Set(), good = [], bad = [];
      for (const n of a.notes || []) { const i = targets.findIndex((t, k) => !u.has(k) && fits(n, t)); if (i >= 0) { u.add(i); good.push(n); } else bad.push(n); }
      if (bad.length) {
        bad.forEach((n) => wrongAt(gridRect(n.start, n.length, n.pitch), whyWrong(n, targets, u)));
        setTimeout(() => writeNotes(cid, good), 700);
      }
      if (u.size > had) { for (let k = had + 1; k <= u.size; k++) pop(10, null, k === targets.length, k + "/" + targets.length); had = u.size; stepEl.textContent = o.label + " " + had + "/" + targets.length; }
      if (o.firstN && !solo) setTimeout(goSolo, 120);
      return u.size >= targets.length && !bad.length;
    });
    unslots(); unpoint();
  }
  // V5p (Eman, 20:46): before anything plays, the work is checked; if a note isn't exactly right you're asked to fix it
  async function checkNotes(cid, targets, label) {
    for (let k = 0; k < 4 && !window.KT2_QUEST_NO_CHECK; k++) {
      const u = new Set(), good = [];
      for (const n of notesOf(cid)) { const i = targets.findIndex((t, j) => !u.has(j) && fits(n, t)); if (i >= 0) { u.add(i); good.push(n); } }
      if (good.length === notesOf(cid).length && u.size === targets.length) return;
      say("Almost. Something isn't exactly right yet. Fix the glowing boxes.");
      await writeNotes(cid, good); await wait(900);
      await paintBoxes(cid, targets, { label, now: "Fill the glowing boxes: press at the start, drag to the end, let go." });
    }
  }
  async function playIt(line) {
    point(canvasEl, { ring: false, tip: "SPACE = PLAY / STOP" });
    say(line);
    await untilState(() => ui.transport && ui.transport.playing, 120);
    unpoint(); pop(25);
  }
  async function openEditor(key) {
    if (!editorOpen() && typeof openLaneWindow === "function") { openLaneWindow({ t: track(ids[key].t), clip: clipOf(ids[key].c), view: "midi" }); await untilState(editorOpen); }
    ghostOn(); playFull();
    await wait(200);
  }
  // the keys light up one by one from the bottom, white for the notes in the key, yellow for A (V4w)
  async function keysGlow() {
    const c = canvasEl(), host = c && c.closest("#iw-card"), o = host && offsetIn(c, host);
    if (!o || !window.TmMidi || !TmMidi._loc) return [];
    if (!window.KT2_QUEST_KEYS_OLD) return keysLightUp(host, o);
    const { tonic, steps } = keyNow(), out = [];
    const rows = [];
    for (let p = 24; p <= 108; p++) { const pc = ((p - tonic) % 12 + 12) % 12; if (!steps.includes(pc)) continue; const l = TmMidi._loc({ pitch: p, start: 0, length: 1 }); if (l) rows.push({ p, l, root: pc === 0 }); }
    for (const { l, root } of rows) {
      const d = H("div", "kq-keyrow" + (root ? " root" : ""));
      Object.assign(d.style, { left: o.x + 2 + "px", top: o.y + l.y + 1 + "px", width: "60px", height: Math.max(3, l.h - 2) + "px" });
      host.append(d); out.push(d);
      blip(root ? 880 : 520 + out.length * 25, 0.07, "triangle", root ? 0.05 : 0.035);
      await wait(root ? 140 : 75);
    }
    return out;
  }

  // V6 (Eman, 8 Nov 03:05): every key starts dark, then the keys of the song's key light up one by one from the
  // bottom, each with its own note (do do do...), so the eye follows which ones work. The rest stay dark until the
  // step ends. window.KT2_QUEST_KEYS_OLD = the old glow over keys that were already lit.
  async function keysLightUp(host, o) {
    const { tonic, steps } = keyNow(), out = [], rows = [];
    for (let p = 24; p <= 108; p++) { const l = TmMidi._loc({ pitch: p, start: 0, length: 1 }); if (l) rows.push({ p, l, pc: ((p - tonic) % 12 + 12) % 12 }); }
    const box = (l, cls) => { const d = H("div", cls); Object.assign(d.style, { left: o.x + "px", top: o.y + l.y + "px", width: Math.max(40, l.x0) + "px", height: l.h + "px" }); host.append(d); return d; };
    const dark = new Map();
    for (const r of rows) { const d = box(r.l, "kq-keydark"); dark.set(r.p, d); out.push(d); }
    await wait(window.__qfast ? 50 : 600);
    for (const r of rows) {
      if (!steps.includes(r.pc) || !active) continue;
      const root = r.pc === 0, d = dark.get(r.p);
      if (d) { d.classList.add("off"); }
      const g = box(r.l, "kq-keyrow kq-keyrow2" + (root ? " root" : ""));
      g.style.left = o.x + 2 + "px"; g.style.top = o.y + r.l.y + 1 + "px"; g.style.height = Math.max(3, r.l.h - 2) + "px"; g.style.width = Math.max(40, r.l.x0) - 4 + "px";
      out.push(g);
      blip(Math.min(1400, 440 * Math.pow(2, (r.p - 69) / 12)), root ? 0.12 : 0.09, "triangle", root ? 0.05 : 0.035);
      await wait(window.__qfast ? 10 : root ? 220 : 150);
    }
    return out;
  }

  // PLAYGROUND show-reel (Eman, 7 Nov 15:45): before you do anything, the acid cursor shows what the playground
  // is: patterns go anywhere, any row, any bar, any length. Nothing is made; it's only shown. KT2_QUEST_NO_REEL = off.
  async function showReel() {
    const rowsAt = () => [...document.querySelectorAll("#rows .row .lane")].filter((l) => l.getBoundingClientRect().height > 10);
    const shots = [[0, 0, 4], [2, 2, 2], [1, 5, 3], [3, 1, 1]];
    for (let k = 0; k < shots.length && active; k++) {
      const [ri, bar, len] = shots[k], rows = rowsAt(), first = rows[0];
      if (!first) return;
      const fr = first.getBoundingClientRect(), rh = fr.height + 2;
      const lane = rows[ri], lr = lane ? lane.getBoundingClientRect() : { left: fr.left, top: fr.top + ri * rh, height: fr.height };
      const x0 = lr.left + bar * barPx(), y = lr.top + lr.height / 2;
      demoGo++;
      await ghostMove({ x: x0 + 4, y }, { x: x0 + len * barPx(), y }, { dbl: true, trail: "pattern", x0: x0 + 1, y0: lr.top + 2, h: lr.height - 4, click: true, dur: 1100 + len * 180, steps: len,
        label: (e) => { const b = Math.max(1, Math.ceil(e * len - 0.15)); return b + (b > 1 ? " BARS" : " BAR"); } });
      await wait(250);
    }
    await wait(400);
    document.querySelectorAll(".kq-fake, .kq-trail").forEach((n) => n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" }));
    await wait(420);
    document.querySelectorAll(".kq-fake, .kq-trail, .kq-ghost").forEach((n) => n.remove());
  }
  const Q1_MOMENTS = [
    { id: "reel", label: "THE PLAYGROUND", async run() {
      // V5p (Eman, 20:46: "in the beginning of Q1 it's confusing"): no show-reel at the start; you go straight to making.
      // window.KT2_QUEST_REEL = the reel back.
      if (window.KT2_QUEST_NO_REEL || !window.KT2_QUEST_REEL) return;
      await questZoom(8); await wait(200);
      say("This is the playground. A pattern can go anywhere: any row, any bar, short or long. Watch.");
      await wait(900);
      await showReel();
      await say("Nothing is stuck in place. Now let's make your first song here.", [["LET'S GO", true, false, true]]);
    } },
    { id: "key", label: "PICK THE KEY", async run() {
      const kb = (sel) => () => { const b = $(".k2-keypick " + sel); return b && b.offsetParent ? b : null; };
      const A = kb('button[data-tonic="9"]'), MIN = kb('button[data-scale="minor"]');
      // V4x: nothing looks picked before you pick it (the picker shows A minor lit by default), the glow and the words
      // always sit on the next thing to press
      html.classList.add("kq-kf-t", "kq-kf-s");
      let aDone = false, minDone = false, stage = -1;
      const under = (b) => () => { const e = b(), k = $(".k2-keypick"); if (!e || !k) return null; const r = e.getBoundingClientRect(), q = k.getBoundingClientRect(); return { left: r.left, width: r.width, top: q.top, height: q.height }; };
      const onClick = (e) => { const a = A(), m = MIN(); if (a && a.contains(e.target)) aDone = true; if (m && m.contains(e.target) && aDone) minDone = true; };
      addEventListener("click", onClick, true);
      say((window.KT2_QUEST_REEL ? "" : "Let's make your first song, one step at a time. ") + "Every song has a key: the notes that sound right together. This one is in A minor, dark and emotional.");
      try {
        await untilState(() => {
          if (aDone) html.classList.remove("kq-kf-t");
          if (minDone) html.classList.remove("kq-kf-s");
          if (minDone && isAminor()) return true;
          const st = !$(".k2-keypick") ? 0 : !aDone ? 1 : 2;
          if (st !== stage) {
            stage = st;
            if (st === 0) point("#key-chip", { tip: "PRESS HERE", soft: true, dim: true, allow: [A, MIN] });
            else if (st === 1) { point(A, { tip: "PICK A", tipAt: under(A), soft: true, dim: true, allow: ["#key-chip"] }); say("Pick A."); }
            else { point(MIN, { tip: "NOW PRESS MINOR", tipAt: under(MIN), soft: true, dim: true, allow: ["#key-chip", A] }); say("Now press MINOR."); }
          }
          return false;
        }, 100);
      } finally { removeEventListener("click", onClick, true); html.classList.remove("kq-kf-t", "kq-kf-s"); }
      unpoint(); pop(100, null, true);
      await wait(900);
      const kp = $(".k2-keypick"); if (kp) kp.remove();
    } },
    patternMoment("chords", true),
    { id: "keys", label: "THE KEYS", async run() {
      await openEditor("chords");
      await centreGrid(SONG.chords);
      point(null, { ring: false });
      const ask = say("These are the keys. The lit ones are in A minor, the yellow one is A, home base.", [["GOT IT", true]]);
      const lit = await keysGlow();
      await ask;
      lit.forEach((d) => d.animate({ opacity: 0 }, { duration: 300, fill: "forwards" }));
      setTimeout(() => lit.forEach((d) => d.remove()), 320);
      const only = () => $("#tmm-all");
      if (only() && !only().classList.contains("on")) only().click();
      point(only, { tip: "ONLY KEY IS ON", allow: [], look: true, dim: true, soft: true });
      await say("ONLY KEY is on, so only the notes of A minor show. You can't hit a wrong one.", [["NICE", true]]);
      unpoint(); pop(50);
    } },
    { id: "chords", label: "CHORDS", async run() {
      const cid = ids.chords.c;
      await openEditor("chords");
      await paintBoxes(cid, SONG.chords, { label: "CHORDS", demo: true, firstN: window.KT2_QUEST_R2_LOOK ? 0 : 3,
        watch: "A chord is three notes at once. Watch: press at the start of a box, drag to its end, let go.",
        now: "Now you. Fill the three boxes: that's your first chord.",
        try: "A chord is three notes at once. Press at the start of a box, drag to its end, let go. Fill the three boxes.",
        rest: "That's a chord! Here are the other three. You know how now: fill them on your own." });
      await checkNotes(cid, SONG.chords, "CHORDS");
      await playIt("4 bars of chords, your first sound. Press SPACE to hear them, SPACE again stops.");
      await say("That's the mood of your song.", [["KEEP THEM", true]]);
      pop(100, null, true);
      await pressDone();
      await nameIt("chords", "CHORDS", true);
    } },
    patternMoment("melody", false),
    { id: "melody", label: "MELODY", async run() {
      const cid = ids.melody.c;
      await openEditor("melody");
      // your chords glow softly behind the grid until you've seen them (V4w)
      const cc = clipOf(ids.chords.c), mc = clipOf(cid), spbt = typeof secPerBeat === "function" ? secPerBeat() : 60 / 140;
      const shift = cc && mc ? (cc.start - mc.start) / spbt : 0;
      await centreGrid(SONG.melody.concat(SONG.chords));
      slots(() => notesOf(ids.chords.c).map((n) => gridRect(n.start + shift, n.length, n.pitch)), "lit");
      point(null, { ring: false });
      await say("See the faint notes? Those are ghost notes: your chords, playing at the same time. They're not in this pattern, they just show you where the melody fits.", [["OK", true]]);
      unslots();
      await paintBoxes(cid, SONG.melody, { label: "MELODY", centre: SONG.melody.concat(SONG.chords), demo: false,
        now: "Now the melody, above the chords. Same as before: press ONCE at the start of a box, drag to its end, let go. Not a double-click." });
      await checkNotes(cid, SONG.melody, "MELODY");
      await playIt("Press SPACE. Your chords play under the melody. SPACE again stops.");
      await say("That's a melody. You made that.", [["KEEP IT", true]]);
      pop(100, null, true);
      await pressDone();
      await nameIt("melody", "MELODY", false);
    } },
    // select both patterns with a box, DUPLICATE (V4w: the acid cursor drags the box on the empty grid first,
    // no outline around the patterns)
    { id: "fill", label: "MAKE IT LONGER", async run() {
      await closeWin();
      if (ui.transport && ui.transport.playing) await run("togglePlay");
      try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
      await wait(300);
      const all = ["chords", "melody"].map((k) => ids[k] && ids[k].c).filter(Boolean);
      const dupBtn = () => $('.kt-tool[data-tool="dup"]');
      const picked = () => { const s = typeof selectedIds === "function" ? selectedIds() : [ui.selectedClip]; return all.every((id) => s.includes(id)); };
      const from = () => { const r = unionRect(all.map(clipEl)); return r && { x: r.left + r.width + 40, y: r.top + r.height + 18 }; };
      const fromSpot = () => { const p = from(); return p && { left: p.x - 12, top: p.y - 12, width: 24, height: 24 }; };
      const demo = boxFree() ? boxDemo(() => unionRect(all.map(clipEl))) : () => { const r = unionRect(all.map(clipEl)), p = from(); if (!r) return; return ghostMove(p, { x: r.left + 8, y: r.top + 6 }, { trail: "box", dur: 1300 }); };
      try { if (typeof selectClip === "function") selectClip(null); else { ui.selectedClip = null; ui.extraClips = []; render(); } } catch (e) { /* fine */ }
      const lanes = () => [...document.querySelectorAll("#rows .lane")];
      if (boxFree()) {
        const free = { ring: false, allow: [() => $("#rows")], holes: [() => $("#rows")], drag: true, noDbl: true, demo, every: 25000, noClips: true, help: BOX_HELP };
        point(null, free);   // free to go even while the cursor is still showing it
        say("Let's make the song longer. Watch: press anywhere on the empty grid and drag a box over both patterns.");
        await wait(500);
        await demo();
        if (!picked()) say("Now you. Start anywhere on the empty grid.");
      } else if (showFirst()) {
        say("Let's make the song longer. Watch: press on the empty grid right of your patterns and drag a box over both.");
        await wait(500);
        demoGo++; await demo();
        point(fromSpot, { ring: false, tip: "PRESS HERE, DRAG OVER BOTH", allow: window.KT2_QUEST_LOOSE ? [lanes] : [], drag: true, noDbl: true, demo, every: 25000, noClips: true });
        say("Now you.");
      } else {
        point(fromSpot, { ring: false, tip: "PRESS HERE, DRAG OVER BOTH", allow: window.KT2_QUEST_LOOSE ? [lanes] : [], drag: true, noDbl: true, demo, every: 25000, noClips: true, demoNow: true });
        say("Let's make the song longer. Press on the empty grid right of your patterns and drag a box over both.");
      }
      await untilState(picked, 150);
      point(dupBtn, { tip: "DUPLICATE  \u00b7  \u2318D", allow: window.KT2_QUEST_LOOSE ? [lanes] : [], dim: true, soft: true, noClips: true, dupOk: true });
      say("Both picked. Now press DUPLICATE, or press CMD+D.");
      await until((cmd, a) => cmd === "duplicateClips" && (a.clipIds || []).length >= all.length);
      unpoint(); pop(100, null, true, BARS * 2 + " BARS");
      await wait(300);
      try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
      await say(BARS * 2 + " bars. The copies stay linked: change one and they all change.");
      await wait(2200);
    } },
    { id: "listen", label: "PLAY IT BACK", async run() {
      if (ui.transport && ui.transport.playing) await run("togglePlay");
      await run("setLooping", { on: false }).catch(() => {});
      await run("setPosition", { time: 0 }).catch(() => {});
      await wait(300);
      point(() => $("#rows"), { ring: false, tip: "SPACE = PLAY" });
      say("Last one. Press SPACE and just listen to what you made.");
      await untilState(() => ui.transport && ui.transport.playing, 120);
      unpoint(); quiet(); if (!window.KT2_QUEST_SHADE_LISTEN) { shadeOff = true; placeDim(); }
      const end = Math.max(8, ...S().tracks.flatMap((t) => t.clips).map((c) => c.start + c.length));
      await wait(Math.min(40000, Math.round(end * 1000)));
      pop(100, null, true);
    } },
  ];

  // ================================================================ QUEST 2 "BUILD IT UP" (Eman, 7 Nov 14:17)
  // Starts from the quest 1 song (CHORDS + MELODY, 4 bars, copied to 8). The chords swap to TOY MACHINE (won in
  // quest 1), the intro chords are made unique, the melody leaves the intro, a TOY MACHINE bassline comes in at bar 5,
  // and the intro chords' cutoff opens up over bars 1 to 4, so everything lands on bar 5.
  const BASS = [[33, 0], [33, 1.5], [33, 3], [29, 4], [29, 5.5], [29, 7], [36, 8], [36, 9.5], [36, 11], [31, 12], [31, 13.5], [31, 15]]
    .map(([pitch, start]) => ({ pitch, start, length: start % 4 === 3 ? 1 : 1.5 }));
  // NIGHT SHIFT quest set (Eman, 7 Nov): clean, made for this song, every one on the loudness standard and built to
  // open up with the cutoff (a clean sine under every bass). KT2_QUEST_OLD_SOUNDS = the old library picks.
  const NS = (xs) => xs.map((x) => "Night Shift - " + x);
  const BASS_SOUNDS = window.KT2_QUEST_OLD_SOUNDS ? ["808 - Sub", "808 - Deep", "Deep", "808 - Glue", "808 - Kites", "Aware", "Deep Fog Bass", "808 - Deep Analogue", "Electric Pickup nice", "808 - Sundial"]
    : NS(["Round 808", "Clean Sub", "Saw Bass", "Ladder Bass", "Square Bass", "Pluck Bass", "Rubber Bass", "Soft Reese", "Pulse Bass", "Glide 808"]);
  const TM_CHORD_SOUNDS = window.KT2_QUEST_OLD_SOUNDS ? ["Blue Hour - Keys 1", "Atlas - Pad", "Air Maxes - Chords", "Glass FM Keys", "Cybercity key ocean drive", "Aurora", "Lacassine", "Tranquil"]
    : NS(["Velvet Saw", "Talk Box Keys", "Glass Square", "Soft Poly", "Pluck Chords", "Night Brass", "Hollow Pulse", "Bell Saw", "Air Strings", "Dream Organ"]);
  async function bassSounds() {
    const all = await presetIndex(), out = [];
    for (const nm of BASS_SOUNDS) { const p = all.find((x) => x.name === nm && x.category === "Bass"); if (p) out.push(p); }
    for (const p of all) { if (out.length >= 10) break; if (p.category === "Bass" && !out.includes(p)) out.push(p); }
    return out;
  }
  // TOY MACHINE sounds for the chords: pads and keys from the big library (not the electric pianos of quest 1)
  async function tmChordSounds() {
    const all = await presetIndex(), out = [];
    for (const nm of TM_CHORD_SOUNDS) { const p = all.find((x) => x.name === nm); if (p) out.push(p); }
    for (const p of all) { if (out.length >= 10) break; if ((p.category === "Pads" || p.category === "Keys") && !out.includes(p) && !EPISH(p)) out.push(p); }
    return out;
  }
  const byStart = (t) => (t ? t.clips.slice().sort((a, b) => a.start - b.start) : []);
  const songTrack = (re) => S().tracks.find((t) => t.kind === "inst" && re.test(t.name || "") && t.clips.length);
  function findSong() {
    if (ids.chordsT && track(ids.chordsT) && ids.melT && track(ids.melT)) return true;
    const ct = songTrack(/^CHORDS$/i) || songTrack(/^CHORDS/i), mt = songTrack(/^MELODY/i);
    if (!ct || !mt) return false;
    ids.chordsT = ct.id; ids.melT = mt.id;
    return true;
  }
  // a fresh quest 1 song when the old one isn't there any more (a new browser, or the project was deleted)
  async function buildQ1Song() {
    await makeStarter();
    await run("setKey", { tonic: SONG.tonic, minor: true });
    const mk = async (name, notes, color) => {
      const r = await run("newInstrumentLane", { key: q1Synth() }); const tid = r && (r.trackId || r.id);
      const m = await run("newMidiClip", { trackId: tid, start: 0, bars: 4 });
      await writeNotes(m.clipId, notes);
      if (color) await run("setClipColor", { clipIds: [m.clipId], color }).catch(() => {});
      await run("renameTrack", { trackId: tid, name }); await run("renameClip", { clipId: m.clipId, name });
      return m.clipId;
    };
    const cols = typeof freshColors === "function" ? freshColors(2) : [null, null];
    const a = await mk("CHORDS", SONG.chords, cols[0]), b = await mk("MELODY", SONG.melody, cols[1]);
    await run("duplicateClips", { clipIds: [a, b] });
    await wait(300);
  }
  async function q2Setup() {
    const q1 = loadSave(0);
    let ok = false;
    if (q1 && q1.session) {
      try {
        if (typeof openProject === "function") openProject(q1.session);
        await Promise.race([untilState(() => S() && S().session === q1.session, 200), wait(4000)]);
        if (typeof showHome === "function") showHome(false);
        await wait(400);
        ok = S() && S().session === q1.session && findSong() && byStart(track(ids.chordsT)).length >= 2;
      } catch (e) { ok = false; }
    }
    if (!ok) { await buildQ1Song(); findSong(); }
    try { await run("renameSession", { name: "NIGHT SHIFT 2" }); } catch (e) { /* fine */ }
    await run("setPosition", { time: 0 }).catch(() => {});
  }
  const selIds = () => (typeof selectedIds === "function" ? selectedIds() : [ui.selectedClip]);
  const popItem = (re) => () => { const pop = $("#pop"); if (!pop || pop.hidden || !pop.getBoundingClientRect().width) return null; return [...pop.querySelectorAll("button.item")].find((b) => re.test((b.textContent || "").trim())) || null; };
  let keysOk = null;   // extra keys a step lets through (DELETE for removing a pattern)

  const Q2_MOMENTS = [
    { id: "q2-hello", label: "YOUR SONG", async run() {
      if (!ids.chordsT || !track(ids.chordsT)) await q2Setup();
      try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
      await say("Here's your song from quest 1. Now it's going to build up: a new sound, a bassline, and an intro that opens up.", [["LET'S GO", true, false, true]]);
    } },
    // 1. the chords get TOY MACHINE: pick the chords, INST tab, swap the synth, double-click TOY MACHINE
    { id: "q2-sound", label: "NEW SOUND", async run() {
      findSong();
      const tid = ids.chordsT, first = () => byStart(track(tid))[0];
      const chordEl = () => first() && clipEl(first().id);
      const isTM = () => { const p = instOf(tid); return p && /toy ?machine/i.test(p.name || p.type || "") && !/keys/i.test(p.name || ""); };
      if (!isTM()) {
        const instTab = () => { const e = $('.k2-tab[data-tab="inst"]'); return e && e.offsetParent ? e : null; };
        const swap = () => { const e = $(".k2w-rep:not(.k2w-x)"); return e && e.offsetParent ? e : null; };
        const tile = () => { const e = $('.k2p-tile[data-key="builtin:toymachine"]'); return e && e.offsetParent ? e : null; };
        let stage = -1;
        say("You won TOY MACHINE. Let's put it on your chords.");
        await untilState(() => {
          if (isTM()) return true;
          const picked = first() && selIds().includes(first().id);
          const st = tile() ? 3 : !picked ? 0 : swap() ? 2 : 1;
          if (st !== stage) {
            stage = st;
            if (st === 0) { point(chordEl, { tip: "CLICK THE CHORDS", dim: true, soft: true }); }
            else if (st === 1) { point(instTab, { tip: "INST", dim: true, soft: true, allow: [chordEl] }); say("Open the INST tab: it shows the sound playing these chords."); }
            else if (st === 2) { point(swap, { tip: "SWAP THE SYNTH", dim: true, soft: true, allow: [chordEl, instTab] }); say("Press the swap button: same notes, a new synth."); }
            else { point(tile, { tip: "DOUBLE-CLICK TOY MACHINE", dim: true, soft: true }); say("Double-click TOY MACHINE."); }
          }
          return false;
        }, 120);
        unpoint(); pop(50);
        await run("renameTrack", { trackId: tid, name: "CHORDS" }).catch(() => {});   // the swap names the row after the synth
      }
      // the sound: same flow as quest 1 (NEXT first, then BACK too, then the pulsing button)
      if (!winOpen() || viewNow() !== "inst") { try { openLaneWindow({ t: track(tid), clip: first(), view: "inst" }); } catch (e) { /* fine */ } }
      await untilState(() => $("#iw .tm-nav") && $("#iw .tm-nav").offsetParent, 120);
      const list = await tmChordSounds();
      window.TM_ONLY_PRESETS = list.map((p) => p.id);
      const pname = () => (($("#iw .tm-presetname") || {}).textContent || "").trim(), name0 = pname();
      let flips = 0; const seen = (cmd, a) => { if (cmd === "toyMachineSetPreset" && a.preset) flips++; };
      watchers.add(seen);
      // Eman (recorder note, V5c 16:31): while you pick, the chords play on loop by themselves, and only the chords,
      // so you hear each sound on your notes. Stops when the step ends. window.KT2_QUEST_NO_PICKLOOP = silent like before.
      const unloop = await pickLoop(tid, first() && first().id);
      try {
        const nextBtn = () => $("#iw .tm-next");
        point(nextBtn, { soft: true, tip: "NEXT >", dim: true });
        say("Same notes, a bigger synth. Press NEXT to hear the next sound.");
        await untilState(() => flips > 0 || (pname() && pname() !== name0), 150);
        point(() => $("#iw .tm-nav"), { ring: false, tips: [[() => $("#iw .tm-prev"), "< BACK"], [nextBtn, "NEXT >"]] });
        await happy("Keep flipping until your chords sound new. Then press I'M HAPPY or DONE.", "I'M HAPPY WITH THIS SOUND", false);
      } finally {
        watchers.delete(seen); delete window.TM_ONLY_PRESETS;
        await unloop();
      }
      unpoint(); pop(50);
      await pressDone();
    } },
    // 2. MAKE UNIQUE on the intro chords: they get their own row, so the intro can change on its own
    { id: "q2-unique", label: "MAKE UNIQUE", async run() {
      findSong();
      const first = () => byStart(track(ids.chordsT))[0];
      if (byStart(track(ids.chordsT)).length < 2) { const u = S().tracks.find((t) => /^CHORDS \d/.test(t.name) && t.clips.length); if (u) { ids.introT = u.id; ids.introC = u.clips[0].id; return; } }
      const dd = () => { const c = first(); const n = c && clipEl(c.id); return n && $(".k2-dd", n); };
      const item = popItem(/^Make unique/i);
      await focusOn(first().id);
      say("The two CHORDS patterns are linked: change one and both change. The intro should be its own thing. Open the menu on the first one.");
      let stage = -1, got = null;
      const done = until((cmd, a) => cmd === "makeUniqueLane" || cmd === "makeUnique").then((x) => { got = x; });
      await untilState(() => {
        if (got) return true;
        const st = item() ? 1 : 0;
        if (st !== stage) {
          stage = st;
          if (st === 0) point(dd, { tip: "CLICK \u25be", dim: true, soft: true, allow: [() => clipEl(first().id)] });
          else { point(item, { tip: "MAKE UNIQUE", dim: true, soft: true, allow: [dd] }); say("Make unique."); }
        }
        return false;
      }, 120);
      await done;
      unpoint();
      await wait(400);
      const nt = got.r && got.r.trackId ? track(got.r.trackId) : S().tracks.find((t) => /^CHORDS \d/.test(t.name) && t.clips.length);
      if (nt) { ids.introT = nt.id; ids.introC = (got.r && got.r.clipId) || nt.clips[0].id; }
      try { await run("renameTrack", { trackId: ids.introT, name: "INTRO CHORDS" }); await run("renameClip", { clipId: ids.introC, name: "INTRO CHORDS" }); } catch (e) { /* fine */ }
      pop(100, null, true);
      await say("INTRO CHORDS is its own row now: same notes and sound, but what you do to it stays in the intro.", [["OK", true]]);
    } },
    // 3. the melody leaves the intro: pick the first MELODY, press DELETE
    { id: "q2-room", label: "MAKE ROOM", async run() {
      findSong();
      const mt = track(ids.melT), first = () => byStart(track(ids.melT))[0];
      if (!mt || byStart(mt).length < 2 || first().start > 0.01) return;
      const mEl = () => first() && clipEl(first().id), cid = first().id;
      try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
      await wait(300);
      keysOk = /^(Delete|Backspace)$/;
      let stage = -1;
      say("A song that builds starts small. Take the melody out of the intro: click the first MELODY, then press DELETE.");
      const del = until((cmd, a) => cmd === "deleteClip" && (a.clipIds || []).includes(cid));
      let gone = false; del.then(() => { gone = true; });
      try {
        await untilState(() => {
          if (gone || !clipOf(cid)) return true;
          const st = selIds().includes(cid) ? 1 : 0;
          if (st !== stage) { stage = st; point(mEl, st ? { tip: "PRESS DELETE", soft: true, dim: true } : { tip: "CLICK THE FIRST MELODY", soft: true, dim: true }); }
          return false;
        }, 120);
      } finally { keysOk = null; }
      unpoint(); pop(50);
      await say("Now bars 1 to 4 are just the chords.", [["OK", true]]);
    } },
    // 4. the bassline: a new pattern at bar 5, TOY MACHINE, a bass sound, the boxes
    patternMoment("bass", false, { bar: 4, label: "BASSLINE", synth: "builtin:toymachine", sounds: bassSounds,
      line: "Now a bassline that comes in with the melody at bar 5. Double-click on the empty row at bar 5, then click when it says 4 BARS.",
      loadLine: "Press + LOAD, then double-click TOY MACHINE.",
      soundLine: "These 10 are basses and 808s. Press NEXT to hear the next one." }),
    { id: "q2-bassnotes", label: "BASS NOTES", async run() {
      const cid = ids.bass.c;
      await openEditor("bass");
      await paintBoxes(cid, BASS, { label: "BASS", demo: showFirst() && !window.KT2_QUEST_R2_LOOK, firstN: window.KT2_QUEST_R2_LOOK ? 0 : 3,
        watch: "Bass notes are low and long. Watch: press at the start of the box, drag to its end, let go.",
        now: "Now you. Fill the first bar: three boxes on one row.",
        rest: "That's bar 1. Here's the rest of the bassline: fill it on your own." });
      await checkNotes(cid, BASS, "BASS");
      await playIt("Press SPACE: chords, melody and bass together.");
      await say("That's low end.", [["KEEP IT", true]]);
      pop(100, null, true);
      await pressDone();
      await nameIt("bass", "BASS", false);
    } },
    // 5. the cutoff opens up over the intro: the A next to Cutoff makes a line, two clicks shape it
    { id: "q2-cutoff", label: "OPEN IT UP", async run() {
      const tid = ids.introT, t = () => track(tid);
      if (!t()) return;
      const lane = () => (t().automation || []).find((a) => a.target && a.target.type === "synth" && a.target.param === "filter.cutoff");
      if (!lane()) {
        try { openLaneWindow({ t: t(), clip: t().clips[0], view: "inst" }); } catch (e) { /* fine */ }
        if (!window.KT2_QUEST_OLD_SET) await synthPage();
        await untilState(() => $('#iw .tm-rel[data-param="filter.cutoff"] .tm-abtn'), 120);
        // V5p (Eman, friend test: two lines got made): the A takes one press, then nothing more can be pressed
        let aHit = false;
        const aBtn0 = () => $('#iw .tm-rel[data-param="filter.cutoff"] .tm-abtn');
        const aBtn = () => (aHit && !window.KT2_QUEST_AUTO_FREE ? null : aBtn0());
        const onA = (e) => { const b = aBtn0(); if (b && e.target && b.contains(e.target)) aHit = true; };
        addEventListener("click", onA, true);
        point(aBtn, { tip: "PRESS A", dim: true, soft: true });
        say("Cutoff makes the sound dark or bright. Press the A next to it: you'll draw how it moves over time.");
        try { await untilState(() => !!lane(), 120); } finally { removeEventListener("click", onA, true); }
        unpoint(); pop(25);
        await closeWin();
      }
      if (ui.transport && ui.transport.playing) await run("togglePlay");
      // only one line on this lane: any other automation that got made here goes (V5p; KT2_QUEST_AUTO_FREE keeps them)
      if (!window.KT2_QUEST_AUTO_FREE) {
        const keep = lane();
        for (const a of (t().automation || []).slice()) if (a !== keep && keep) await run("removeAutomation", { trackId: tid, laneId: a.id }).catch(() => {});
      }
      await run("setPosition", { time: 0 }).catch(() => {});
      if (!t().autoOpen) await run("showAutomation", { trackId: tid, show: true }).catch(() => {});
      html.classList.add("kq-autoshow"); ui.laneSig = ""; render();
      await wait(300);
      await questZoom(9);
      await wait(400);
      // the cutoff lane itself (V5p: with two lines the spots sat on the wrong one)
      const autoLane = () => { const a = lane(), row = a && $(`#rows .row[data-lane-id="${a.id}"] .auto-lane`); if (row && row.offsetParent) return row; const rows = [...document.querySelectorAll("#rows .auto-lane")]; return rows.find((r) => r.offsetParent) || null; };
      const end = (typeof secPerBar === "function" ? secPerBar() : 2) * 4;
      const spot = (sec, hi) => () => { const l = autoLane(); if (!l) return null; const r = l.getBoundingClientRect(); const x = r.left + sec * ui.pxPerSec; return { left: x - 9, top: hi ? r.top + 2 : r.bottom - 20, width: 18, height: 18 }; };
      const low = spot(0.02, false), high = spot(end - 0.02, true);
      const good = () => { const a = lane(); if (!a || !window.KillToyAuto) return false; return KillToyAuto.valueAt(a, 0.05) < 0.3 && KillToyAuto.valueAt(a, end - 0.05) > 0.7; };
      const demo = async () => { const a = low(), b = high(); if (!a || !b) return; await ghostMove(mid(a), null, {}); await ghostMove(mid(b), null, {}); };
      if (showFirst()) {
        say("Here's the cutoff line for the " + (/INTRO/i.test((t().name || "")) ? "intro chords" : "chords") + ". Watch: click low at bar 1, click high at bar 5.");
        await wait(500); demoGo++; await demo();
      }
      // only the two spots take a press, and the quest writes the point itself, so a press there always counts
      // (Eman, V5m notes: presses weren't noticed, and other spots could be pressed). KT2_QUEST_AUTO_FREE = the old free lane.
      // V5p (Eman, 20:49: "it's chaos, make one per time"): one point at a time. First only the dot at bar 1 can be
      // pressed, then only the dot at bar 5; the words say what each does; the move shows only when nothing happens.
      // KT2_QUEST_AUTO_BOTH = both dots at once with CLICK LOW / HIGH HERE.
      const free = !!window.KT2_QUEST_AUTO_FREE, both = free || !!window.KT2_QUEST_AUTO_BOTH, mine = {};
      let stage = "lo";
      const onSpot = (e) => {
        let k = inBox(screenRect(low()), e.clientX, e.clientY, 8) ? "lo" : inBox(screenRect(high()), e.clientX, e.clientY, 8) ? "hi" : null;
        if (!k || (!both && k !== stage)) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.type !== "pointerdown") return;   // (a stopped pointerdown never sends its mousedown)
        mine[k] = k === "lo" ? { t: 0, v: 0.02 } : { t: end, v: 1 };
        const a = lane(); if (!a) return;
        const pts = Object.values(mine).sort((x, y) => x.t - y.t);
        run("setAutomation", { trackId: tid, laneId: a.id, points: pts.length > 1 ? pts : (k === "lo" ? [pts[0], { t: end, v: 0.02 }] : [{ t: 0, v: 1 }, pts[0]]) });
        snd("tick", 2);
        if (!both && k === "lo") stage = "hi";
      };
      if (!free) ["pointerdown", "mousedown", "click", "dblclick"].forEach((ty) => addEventListener(ty, onSpot, true));
      const what = /INTRO/i.test((t().name || "")) ? "intro chords" : "chords";
      try {
        if (both) {
          point(null, { ring: false, tips: [[low, "CLICK LOW HERE"], [high, "CLICK HIGH HERE", "up"]], allow: free ? [autoLane] : [low, high], demo, every: 25000 });
          say(showFirst() ? "Now you. Dark at bar 1, bright at bar 5." : "Here's the cutoff line for the " + what + ". Click low at bar 1 (dark), then high at bar 5 (bright).");
          await untilState(good, 150);
        } else {
          const demoLo = async () => { const a = low(); if (a) await ghostMove(mid(a), null, {}); };
          const demoHi = async () => { const b = high(); if (b) await ghostMove(mid(b), null, {}); };
          point(low, { soft: true, tip: "1 \u00b7 PRESS THE DOT", allow: [], demo: demoLo, every: 25000 });
          say("This line is how bright the " + what + " sound. Step 1 of 2: press the dot at the start. That makes the sound dark there.");
          await untilState(() => stage === "hi", 120);
          pop(25);
          point(high, { soft: true, tip: "2 \u00b7 PRESS THE DOT", tipSide: "up", allow: [], demo: demoHi, every: 25000 });
          say("Step 2 of 2: press the dot up at bar 5. There the sound opens all the way up to bright.");
          await untilState(good, 150);
        }
      } finally { ["pointerdown", "mousedown", "click", "dblclick"].forEach((ty) => removeEventListener(ty, onSpot, true)); }
      unpoint(); pop(100, null, true);
      setTimeout(() => { html.classList.remove("kq-autoshow"); try { ui.laneSig = ""; render(); } catch (e) { /* fine */ } }, 6000);
      await run("setPosition", { time: 0 }).catch(() => {});
      await playIt("Press SPACE. The " + (/INTRO/i.test((t().name || "")) ? "intro chords open" : "chords open") + " up, and everything hits at bar 5.");
      await wait(Math.min(20000, Math.round((end + secPerBar()) * 1000)));
      if (ui.transport && ui.transport.playing) await run("togglePlay");
    } },
    { id: "q2-listen", label: "PLAY IT BACK", async run() {
      if (ui.transport && ui.transport.playing) await run("togglePlay");
      await run("setLooping", { on: false }).catch(() => {});
      await run("setPosition", { time: 0 }).catch(() => {});
      try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
      await wait(300);
      point(() => $("#rows"), { ring: false, tip: "SPACE = PLAY" });
      say("Last one. Press SPACE and hear it build.");
      await untilState(() => ui.transport && ui.transport.playing, 120);
      unpoint(); quiet(); if (!window.KT2_QUEST_SHADE_LISTEN) { shadeOff = true; placeDim(); }
      const end = Math.max(8, ...S().tracks.flatMap((x) => x.clips).map((c) => c.start + c.length));
      await wait(Math.min(40000, Math.round(end * 1000)));
      pop(100, null, true);
    } },
  ];

  // ================================================================ QUEST 3 "DROP IT" (7 Nov): builds on the quest 2 song.
  // KILLDRUM drums come in at bar 5 (ROLL until a beat hits), the intro chords stop a beat early so there's a gap
  // right before the drop, the drop is doubled to bar 12 with one box + CMD+D, then the whole song plays.
  function findSong3() {
    findSong();
    const it = S().tracks.find((t) => /^INTRO CHORDS/i.test(t.name || "") && t.clips.length);
    if (it) { ids.introT = it.id; ids.introC = byStart(it)[0].id; }
    else if (ids.chordsT && track(ids.chordsT)) { const c = byStart(track(ids.chordsT))[0]; if (c && c.start < 0.01) { ids.introT = ids.chordsT; ids.introC = c.id; } }
    const bt = songTrack(/^BASS/i); if (bt) ids.bassT = bt.id;
    return !!(ids.introC && ids.chordsT && ids.melT);
  }
  // a quick quest 2 song when the real one isn't there: quest 1's song, the melody out of the intro, a bass at bar 5
  async function buildQ2Song() {
    await buildQ1Song(); findSong();
    const m0 = byStart(track(ids.melT))[0];
    if (m0 && m0.start < 0.01) await run("deleteClip", { clipIds: [m0.id] });
    const r = await run("newInstrumentLane", { key: "builtin:toymachine" }); const tid = r && (r.trackId || r.id);
    const m = await run("newMidiClip", { trackId: tid, start: 4 * secPerBar(), bars: 4 });
    await writeNotes(m.clipId, BASS.map((n) => ({ ...n, velocity: 100 })));
    await wait(300);
    await run("renameTrack", { trackId: tid, name: "BASS" }); await run("renameClip", { clipId: m.clipId, name: "BASS" });
    await wait(300);
  }
  async function q3Setup() {
    const q2 = loadSave(1);
    let ok = false;
    if (q2 && q2.session) {
      try {
        if (typeof openProject === "function") openProject(q2.session);
        await Promise.race([untilState(() => S() && S().session === q2.session, 200), wait(4000)]);
        if (typeof showHome === "function") showHome(false);
        await wait(400);
        ok = S() && S().session === q2.session && findSong3();
      } catch (e) { ok = false; }
    }
    if (!ok) { await buildQ2Song(); findSong3(); }
    try { await run("renameSession", { name: "NIGHT SHIFT 3" }); } catch (e) { /* fine */ }
    await run("setPosition", { time: 0 }).catch(() => {});
  }
  const atBarSec = (b) => b * secPerBar();
  const Q3_MOMENTS = [
    { id: "q3-hello", label: "YOUR SONG", async run() {
      if (!ids.introC || !clipOf(ids.introC)) await q3Setup();
      try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
      await say("Your song builds up. Now we make it drop: drums at bar 5, a short gap right before, and a longer song.", [["LET'S GO", true, false, true]]);
    } },
    // 1. a 4-bar pattern at bar 5 that plays KILLDRUM
    patternMoment("drums", false, { bar: 4, label: "DRUMS", synth: "builtin:toydrums", drums: true,
      line: "Drums hit at bar 5, with everything else. Double-click on the empty row at bar 5, then click when it says 4 BARS.",
      loadLine: "Press + LOAD, then double-click KILLDRUM." }),
    // 2. ROLL until a beat hits, then the pulsing button
    { id: "q3-beat", label: "PICK A BEAT", async run() {
      const { t: tid, c: cid } = ids.drums;
      if (!winOpen()) { try { openLaneWindow({ t: track(tid), clip: clipOf(cid), view: "inst" }); } catch (e) { /* fine */ } }
      const roll = () => { const b = $("#iw .kd-roll"); return b && b.getBoundingClientRect().width ? b : null; };
      await untilState(roll, 150);
      let rolls = 0, unloopKD = async () => {};
      const seen = (cmd) => { if (cmd === "killDrumBeatSet") rolls++; };
      watchers.add(seen);
      try {
        point(roll, { tip: "PRESS ROLL", dim: true, soft: true });
        say("This is KILLDRUM. Press ROLL: it makes a whole new beat, every time.");
        // KILLDRUM writes through booth(), not run(), so watch the notes change too
        const sig = () => JSON.stringify(notesOf(cid).map((n) => [n.pitch, n.start])), sig0 = sig();
        let clicked = false; const onRoll = (e) => { if (e.target.closest && e.target.closest("#iw .kd-roll")) clicked = true; };
        document.addEventListener("click", onRoll, true);
        try { await untilState(() => (rolls > 0 || clicked || sig() !== sig0) && notesOf(cid).length > 0, 150); } finally { document.removeEventListener("click", onRoll, true); }
        point(roll, { tip: "ROLL AGAIN?", soft: true });
        unloopKD = await pickLoop(tid, cid);   // the beat plays on loop while you roll (each roll changes what plays)
        await happy("Keep rolling until the beat hits right. Then press I'M HAPPY or DONE.", "I'M HAPPY WITH THIS BEAT", false);
      } finally { watchers.delete(seen); await unloopKD(); }
      unpoint(); pop(50);
      await pressDone();
      try { await run("renameTrack", { trackId: tid, name: "DRUMS" }); await run("renameClip", { clipId: cid, name: "DRUMS" }); } catch (e) { /* fine */ }
    } },
    // 3. the gap: the intro chords stop a beat (or two) before bar 5, so the drop hits out of silence
    { id: "q3-gap", label: "THE GAP", async run() {
      await closeWin();
      if (ui.transport && ui.transport.playing) await run("togglePlay");
      const cid = ids.introC;
      if (!clipOf(cid)) return;
      await questZoom(7); await wait(300);
      const spb = secPerBar() / 4, bar5 = atBarSec(4);
      const endOf = () => { const c = clipOf(cid); return c ? c.start + c.length : 0; };
      const good = () => { const e = endOf(); return e <= bar5 - spb * 0.75 && e >= bar5 - spb * 2.25; };
      if (!good()) {
        const edge = () => { const n = clipEl(cid); return n && $(".edge.r", n); };
        const target = () => { const n = clipEl(cid), sc = n && n.getBoundingClientRect(); if (!sc) return null; const x = sc.left + (bar5 - spb - clipOf(cid).start) * ui.pxPerSec; return { left: x - 13, top: sc.top, width: 26, height: sc.height }; };
        const demo = async () => { const a = edge(), b = target(); if (!a || !b) return; const r = a.getBoundingClientRect(); await ghostMove({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, mid(b), { dur: 1100 }); };
        if (showFirst()) {
          say("Big drops come out of silence. Watch: grab the end of INTRO CHORDS and pull it in by one beat.");
          await wait(500); demoGo++; await demo();
        }
        point(edge, { soft: true, tip: "DRAG THIS END LEFT", tips: [[target, "STOP HERE", "up"]], dim: true, demo, every: 25000, drag: true, onlyGet: true });
        say(showFirst() ? "Now you. Pull the end in by one beat." : "Big drops come out of silence. Grab the end of INTRO CHORDS and pull it in by one beat.");
        let shown = -1;
        await untilState(() => {
          if (good()) return true;
          const e = endOf();
          if (e < bar5 - spb * 2.25 && Math.abs(e - shown) > 1e-6) { shown = e; wrongAt(clipEl(cid), "TOO FAR \u00b7 ONE BEAT IS ENOUGH"); }
          return false;
        }, 150);
        unpoint(); pop(50);
      }
      await run("setPosition", { time: atBarSec(3) }).catch(() => {});
      await playIt("Press SPACE: the chords stop, a breath, then everything drops.");
      await wait(Math.min(9000, Math.round(secPerBar() * 2.2 * 1000)));
      if (ui.transport && ui.transport.playing) await run("togglePlay");
      pop(100, null, true);
    } },
    // 4. the drop twice: a box over the four bar-5 patterns, CMD+D
    { id: "q3-double", label: "DOUBLE THE DROP", async run() {
      await closeWin();
      if (ui.transport && ui.transport.playing) await run("togglePlay");
      try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
      await wait(300);
      const atDrop = (tid) => tid && track(tid) && byStart(track(tid)).find((c) => Math.abs(c.start - atBarSec(4)) < 0.05);
      const all = () => [ids.chordsT, ids.melT, ids.bassT, ids.drums && ids.drums.t].map(atDrop).filter(Boolean).map((c) => c.id);
      const doubled = () => [ids.chordsT, ids.melT, ids.bassT, ids.drums && ids.drums.t].filter((t) => t && track(t)).every((t) => byStart(track(t)).some((c) => Math.abs(c.start - atBarSec(8)) < 0.05));
      if (doubled()) return;
      const dupBtn = () => $('.kt-tool[data-tool="dup"]');
      const picked = () => { const s = selIds(), a = all(); return a.length && a.every((id) => s.includes(id)); };
      const from = () => { const r = unionRect(all().map(clipEl)); return r && { x: r.left + r.width + 40, y: r.top + r.height + 18 }; };
      const fromSpot = () => { const p = from(); return p && { left: p.x - 12, top: p.y - 12, width: 24, height: 24 }; };
      const demo = boxFree() ? boxDemo(() => unionRect(all().map(clipEl))) : () => { const r = unionRect(all().map(clipEl)), p = from(); if (!r) return; return ghostMove(p, { x: r.left + 8, y: r.top + 6 }, { trail: "box", dur: 1300 }); };
      try { if (typeof selectClip === "function") selectClip(null); } catch (e) { /* fine */ }
      if (boxFree()) {
        point(null, { ring: false, allow: [() => $("#rows")], holes: [() => $("#rows")], drag: true, noDbl: true, demo, every: 25000, noClips: true, help: BOX_HELP });
        say("The drop is 4 bars. Let's hear it twice. Watch: press anywhere on the empty grid and drag a box over everything from bar 5.");
        await wait(500);
        await demo();
        if (!picked()) say("Now you. Start anywhere on the empty grid, just keep INTRO CHORDS out of the box.");
      } else if (showFirst()) {
        say("The drop is 4 bars. Let's hear it twice. Watch: drag a box over everything from bar 5.");
        await wait(500);
        demoGo++; await demo();
      }
      const lanes = () => [...document.querySelectorAll("#rows .lane")];
      if (!boxFree()) {
      point(fromSpot, { ring: false, tip: "PRESS HERE, DRAG OVER THE DROP", allow: window.KT2_QUEST_LOOSE ? [lanes] : [], drag: true, noDbl: true, demo, every: 25000, noClips: true });
      say(showFirst() ? "Now you. Keep the box right of bar 5, so INTRO CHORDS stays out." : "The drop is 4 bars. Let's hear it twice: drag a box over everything from bar 5. Keep INTRO CHORDS out.");
      }
      await untilState(picked, 150);
      point(dupBtn, { tip: "DUPLICATE  \u00b7  \u2318D", allow: window.KT2_QUEST_LOOSE ? [lanes] : [], dim: true, soft: true, noClips: true, dupOk: true });
      say("All four picked. Press CMD+D.");
      await untilState(doubled, 150);
      unpoint(); pop(100, null, true, "12 BARS");
      await wait(300);
      try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
      await say("12 bars: an intro, and the drop twice.");
      await wait(2000);
    } },
    { id: "q3-listen", label: "PLAY IT BACK", async run() {
      if (ui.transport && ui.transport.playing) await run("togglePlay");
      await run("setLooping", { on: false }).catch(() => {});
      await run("setPosition", { time: 0 }).catch(() => {});
      try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
      await wait(300);
      point(() => $("#rows"), { ring: false, tip: "SPACE = PLAY" });
      say("Last one. Press SPACE and wait for the drop.");
      await untilState(() => ui.transport && ui.transport.playing, 120);
      unpoint(); quiet(); if (!window.KT2_QUEST_SHADE_LISTEN) { shadeOff = true; placeDim(); }
      const end = Math.max(8, ...S().tracks.flatMap((x) => x.clips).map((c) => c.start + c.length));
      await wait(Math.min(45000, Math.round(end * 1000)));
      pop(100, null, true);
    } },
  ];

  // ================================================================ QUEST 2 "MAKE IT MOVE" (game plan, 7 Nov 16:21)
  // A new song, NEON RUN (124, F minor), with drums already playing: soft hats in bars 1-4, the full beat from bar 5.
  // Part 1, the sound: a pattern, a TOY MACHINE sound (the Night Shift chord set), the first chord guided, the rest
  // on your own, copied to bar 5. Part 2, the movement: Release makes it a pluck, the cutoff opens over bars 1-4.
  const NEON = { bpm: 124, slow: 112, tonic: 5, minor: true,
    chords: [[[53, 56, 60], 0, 4], [[53, 56, 61], 4, 4], [[51, 56, 60], 8, 4], [[51, 55, 58], 12, 4]]
      .flatMap(([ps, start, length]) => ps.map((pitch) => ({ pitch, start, length }))) };
  const drumBar = (b, full) => {
    const n = [], o = b * 4;
    for (let i = 0; i < 8; i++) n.push({ pitch: 42, start: o + i * 0.5, length: 0.25, velocity: i % 2 ? 70 : 96 });
    if (full) { n.push({ pitch: 36, start: o, length: 0.5, velocity: 115 }, { pitch: 36, start: o + 2.5, length: 0.5, velocity: 105 }, { pitch: 38, start: o + 1, length: 0.5, velocity: 112 }, { pitch: 38, start: o + 3, length: 0.5, velocity: 112 }); }
    else if (b === 0 || b === 2) n.push({ pitch: 36, start: o, length: 0.5, velocity: 100 });
    return n;
  };
  async function drumLane(name, clips) {
    const r = await run("newInstrumentLane", { key: "builtin:toydrums" }); const tid = r && (r.trackId || r.id);
    await wait(500);
    const t0 = track(tid);
    for (const c of (t0 && t0.clips) || []) await run("deleteClip", { clipIds: [c.id] }).catch(() => {});
    const out = [];
    for (const [startBar, notes, cname] of clips) {
      const m = await run("newMidiClip", { trackId: tid, start: startBar * secPerBar(), bars: 4 });
      await wait(400);   // KILLDRUM writes its own starter beat into a new pattern; ours goes on top of it
      await writeNotes(m.clipId, notes);
      await run("renameClip", { clipId: m.clipId, name: cname }).catch(() => {});
      out.push(m.clipId);
    }
    await run("renameTrack", { trackId: tid, name }).catch(() => {});
    return { tid, clips: out };
  }
  async function neonSetup() {
    await makeStarter("NEON RUN");
    await run("setBpm", { bpm: window.KT2_QUEST_NO_BPM ? NEON.bpm : NEON.slow });
    await run("setKey", { tonic: NEON.tonic, minor: true });
    const d = await drumLane("DRUMS", [[0, [0, 1, 2, 3].flatMap((b) => drumBar(b, false)), "INTRO HATS"], [4, [0, 1, 2, 3].flatMap((b) => drumBar(b, true)), "BEAT"]]);
    ids.drumsT = d.tid;
    await run("setPosition", { time: 0 }).catch(() => {});
    try { ui.selectedClip = null; render(); if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
    await wait(300);
  }
  const neonFind = () => { if (ids.chords && track(ids.chords.t)) { ids.introT = ids.chords.t; return true; } return false; };
  // the chords to bar 5: click the pattern, CMD+D
  const dupMoment = (key, label) => ({ id: "dup-" + key, label: label || "COPY IT", async run() {
    await closeWin();
    if (ui.transport && ui.transport.playing) await run("togglePlay");
    const tid = ids[key].t, cid = ids[key].c;
    if (byStart(track(tid)).length >= 2) return;
    try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
    await wait(300);
    const dupBtn = () => $('.kt-tool[data-tool="dup"]');
    let stage = -1;
    say("Copy the chords to bar 5, under the beat. Click the pattern, then press CMD+D.");
    await untilState(() => {
      if (byStart(track(tid)).length >= 2) return true;
      const st = selIds().includes(cid) ? 1 : 0;
      if (st !== stage) { stage = st; point(st ? dupBtn : () => clipEl(cid), st ? { tip: "DUPLICATE  \u00b7  \u2318D", soft: true, allow: window.KT2_QUEST_LOOSE ? [() => clipEl(cid)] : [], dupOk: true } : { tip: "CLICK THE CHORDS", soft: true }); }
      return false;
    }, 150);
    unpoint(); pop(50, null, true, "8 BARS");
    await wait(300);
    try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
  } });
  const partBreak = (n, of, line) => ({ id: "part" + n, label: "PART " + n + " DONE", part: n, async run() {
    await closeWin();
    if (ui.transport && ui.transport.playing) await run("togglePlay");
    pop(100, null, true, "PART " + n + "/" + of);
    await say(line, [["NEXT PART", true, false, true]]);
  } });
  // the lane window may open on MIDI or SPLIT (it remembers): go to the synth page
  async function synthPage() {
    await untilState(() => $("#iw"), 120);
    const vb = () => $("#iw-tab-inst");
    for (let i = 0; i < 20 && !vb(); i++) await wait(100);
    if (vb() && !vb().classList.contains("on")) { selfClick = true; try { vb().click(); } finally { selfClick = false; } }
    await wait(300);
  }
  // Release: drag it left and the chords turn into a pluck
  const releaseMoment = (key) => ({ id: "release-" + key, label: "RELEASE", part: 2, async run() {
    const tid = ids[key].t;
    try { openLaneWindow({ t: track(tid), clip: clipOf(ids[key].c), view: "inst" }); } catch (e) { /* fine */ }
    await synthPage();
    const relEl = () => $('#iw .tm-rel[data-param="ampEnv.r"]');
    await untilState(() => relEl() && relEl().getBoundingClientRect().width, 150);
    const secs = () => { const t = (($("#iw .tm-rel[data-param=\"ampEnv.r\"] .tm-rel-val") || {}).textContent || "").trim(); const m = t.match(/([\d.]+)\s*(ms|s)/); return m ? +m[1] / (m[2] === "ms" ? 1000 : 1) : null; };
    const v0 = secs();
    const track_ = () => $('#iw .tm-rel[data-param="ampEnv.r"] .tm-rel-track');
    // a sound that is already short goes the other way: drag right until it rings like a pad
    const ring = v0 != null && v0 <= 0.25;
    const goal = () => { const v = secs(); return v != null && v0 != null && v !== v0 && (ring ? v >= 0.8 : v <= 0.2); };
    const demo = async () => { const t = track_(); if (!t) return; const r = t.getBoundingClientRect(); const th = $('#iw .tm-rel[data-param="ampEnv.r"] .tm-rel-thumb'); const tr = th ? th.getBoundingClientRect() : r; const from = { x: tr.left + tr.width / 2, y: r.top + r.height / 2 }; await ghostMove(from, { x: ring ? Math.min(r.right - 6, from.x + r.width * 0.45) : r.left + 6, y: from.y }, { dur: 1000 }); };
    point(track_, { tip: ring ? "DRAG IT RIGHT" : "DRAG IT LEFT", soft: true, demo, every: 25000, drag: true });
    say(ring ? "Release is how long a note rings after it stops. Yours is short. Drag it right, over 1 second: the chords ring out and melt together, a pad."
      : "Release is how long a note rings after it stops. Drag it left, under 200 ms: the chords turn short and bouncy, a pluck.");
    await untilState(goal, 150);
    unpoint(); pop(50);
    await playIt(ring ? "Press SPACE. Same notes, now they ring out." : "Press SPACE. Same notes, now they bounce.");
    await wait(4000);
    if (ui.transport && ui.transport.playing) await run("togglePlay");
    await closeWin();
  } });
  // the beat plays for you first, then you bring the tempo up to a set BPM (Eman, V5l notes). KT2_QUEST_NO_BPM = old start.
  async function playFor(secs) {
    if (ui.transport && ui.transport.playing) await run("togglePlay");
    await run("setLooping", { on: false }).catch(() => {});
    await run("setPosition", { time: 0 }).catch(() => {});
    await run("togglePlay");
    await wait(secs * 1000);
    if (ui.transport && ui.transport.playing) await run("togglePlay");
    await run("setPosition", { time: 0 }).catch(() => {});
  }
  const bpmNow = () => Math.round(((ui.state && ui.state.bpm) || 0) * 10) / 10;
  const NR_MOMENTS = [
    { id: "nr-hello", label: "NEON RUN", part: 1, async run() {
      try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
      if (window.KT2_QUEST_NO_BPM) {
        point(() => $("#rows"), { ring: false, dim: false });
        await say("A new song: NEON RUN. The drums are already here, soft hats first, the full beat from bar 5. Part 1: you add the chords and pick their sound.", [["LET'S GO", true, false, true]]);
        unpoint();
        return;
      }
      point(() => $("#rows"), { ring: false, dim: false });
      say("A new song: NEON RUN. The drums are already here. Listen: soft hats first, then the full beat from bar 5.");
      await playFor(secPerBar() * 8 + 0.3);   // the whole drum part once: 4 bars of hats, 4 of the full beat (Eman, 17:43)
      unpoint();
    } },
    { id: "nr-bpm", label: "TEMPO", part: 1, async run() {
      if (window.KT2_QUEST_NO_BPM || Math.round(bpmNow()) === NEON.bpm) return;
      const inp = () => $("#bpm");
      const demo = async () => { const e = inp(); if (!e) return; const r = e.getBoundingClientRect(); const a = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; await ghostMove(a, { x: a.x, y: a.y - 40 }, { dur: 900 }); };
      point(inp, { tip: "DRAG UP TO " + NEON.bpm, soft: true, demo, every: 25000, drag: true });
      say("It's a bit slow at " + NEON.slow + ". Bring the tempo up to " + NEON.bpm + ": press on the BPM and drag up until it says " + NEON.bpm + ". (Or double-click it and type " + NEON.bpm + ".)");
      let told = 0;
      await untilState(() => {
        const v = bpmNow();
        if (Math.round(v) === NEON.bpm && Math.abs(v - NEON.bpm) < 0.5) return true;
        const typing = document.activeElement === inp() || document.body.classList.contains("k2-bpmdrag");
        if (!typing && v !== NEON.slow && v !== told) { told = v; say(v > NEON.bpm ? "A bit too fast: it says " + v + ". Drag it down to " + NEON.bpm + "." : "Not there yet: it says " + v + ". Keep going up to " + NEON.bpm + "."); demoSoon && demoSoon(); }
        return false;
      }, 150);
      if (Math.abs(bpmNow() - NEON.bpm) > 1e-6) await run("setBpm", { bpm: NEON.bpm });
      unpoint(); pop(50, null, true, NEON.bpm + " BPM");
      say("Hear the difference: same beat, more drive.");
      await playFor(Math.min(10, secPerBar() * 5));
      point(() => $("#rows"), { ring: false, dim: false });
      await say("That's the tempo of NEON RUN. Part 1: you add the chords and pick their sound.", [["LET'S GO", true, false, true]]);
      unpoint();
    } },
    patternMoment("chords", false, { bar: 0, label: "CHORDS", synth: "builtin:toymachine", sounds: () => tmChordSounds(),
      line: "Make a 4-bar pattern for the chords on the empty row: double-click at the start, click when it says 4 BARS.",
      loadLine: "Press + LOAD, then double-click TOY MACHINE.",
      soundLine: "Pick the chord sound. Press NEXT to hear the next one, BACK to go back." }),
    { id: "nr-chords", label: "CHORDS", part: 1, async run() {
      const cid = ids.chords.c;
      await openEditor("chords");
      await paintBoxes(cid, NEON.chords, { label: "CHORDS", demo: showFirst(), firstN: window.KT2_QUEST_R2_LOOK ? 0 : 3,
        watch: "First chord, three notes. Watch: press at the start of a box, drag to its end, let go.",
        now: "Now you: fill the three boxes.",
        rest: "Nice. The other three chords are yours: fill them on your own." });
      await playIt("Press SPACE: your chords over the hats.");
      await say("That's the song's mood.", [["KEEP THEM", true]]);
      pop(100, null, true);
      await pressDone();
      await nameIt("chords", "CHORDS", false);
      neonFind();
    } },
    dupMoment("chords", "TO BAR 5"),
    partBreak(1, 2, "Part 1 done: your chords on your sound. Part 2 is about movement: the sound changes while it plays."),
    releaseMoment("chords"),
    { id: "nr-cutoff-wrap", label: "OPEN IT UP", part: 2, async run() { neonFind(); const m = Q2_MOMENTS.find((x) => x.id === "q2-cutoff"); if (m) await m.run(); } },
    { id: "nr-listen", label: "PLAY IT BACK", part: 2, async run() { const m = Q2_MOMENTS.find((x) => x.id === "q2-listen"); if (m) await m.run(); } },
  ];

  // ================================================================ QUEST 3 "YOUR OWN BEAT" (game plan): song VILLAIN (142, F# minor)
  // is ready: intro chords in bars 1-4, chords + melody + bass from bar 5, no drums. Part 1: a KILLDRUM pattern at bar 5,
  // ROLL a beat. Part 2: the gap before the drop, the drop twice, play it all.
  const VIL = { bpm: 142, tonic: 6,
    chords: [[[54, 57, 61], 0, 4], [[54, 57, 62], 4, 4], [[52, 57, 61], 8, 4], [[52, 56, 59], 12, 4]]
      .flatMap(([ps, start, length]) => ps.map((pitch) => ({ pitch, start, length }))),
    melody: [[73, 0, 0.75], [73, 0.75, 0.75], [69, 1.5, 1], [66, 2.5, 1.5], [74, 4, 0.75], [73, 4.75, 0.75], [69, 5.5, 2.5], [73, 8, 0.75], [76, 8.75, 0.75], [73, 9.5, 1], [69, 10.5, 1.5], [68, 12, 1], [69, 13, 1], [66, 14, 2]]
      .map(([pitch, start, length]) => ({ pitch, start, length, velocity: 100 })),
    bass: [[30, 0], [30, 1.5], [30, 3], [26, 4], [26, 5.5], [26, 7], [33, 8], [33, 9.5], [33, 11], [28, 12], [28, 13.5], [28, 15]]
      .map(([pitch, start]) => ({ pitch, start, length: start % 4 === 3 ? 1 : 1.5, velocity: 100 })) };
  async function tmLane(name, startBar, notes, presetName) {
    const r = await run("newInstrumentLane", { key: "builtin:toymachine" }); const tid = r && (r.trackId || r.id);
    const m = await run("newMidiClip", { trackId: tid, start: startBar * secPerBar(), bars: 4 });
    await writeNotes(m.clipId, notes.map((n) => ({ velocity: 100, ...n })));
    if (presetName) { try { const all = await presetIndex(); const p = all.find((x) => x.name === presetName); if (p) await loadSound(tid, p); } catch (e) { /* fine */ } }
    await wait(250);
    await run("renameTrack", { trackId: tid, name }).catch(() => {}); await run("renameClip", { clipId: m.clipId, name }).catch(() => {});
    return { tid, cid: m.clipId };
  }
  async function villainSetup() {
    await makeStarter("VILLAIN");
    await run("setBpm", { bpm: VIL.bpm });
    await run("setKey", { tonic: VIL.tonic, minor: true });
    const old = window.KT2_QUEST_OLD_SOUNDS, ch = TM_CHORD_SOUNDS[0], ld = old ? null : "Night Shift - Clean Saw Lead", bs = BASS_SOUNDS[0];
    const intro = await tmLane("INTRO CHORDS", 0, VIL.chords, old ? ch : "Night Shift - Air Strings");
    const c = await tmLane("CHORDS", 4, VIL.chords, ch);
    const m = await tmLane("MELODY", 4, VIL.melody, ld);
    const b = await tmLane("BASS", 4, VIL.bass, bs);
    Object.assign(ids, { introT: intro.tid, introC: intro.cid, chordsT: c.tid, melT: m.tid, bassT: b.tid });
    await run("setPosition", { time: 0 }).catch(() => {});
    try { ui.selectedClip = null; render(); if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
    await wait(300);
  }
  const q3m = (id) => { const m = Q3_MOMENTS.find((x) => x.id === id); return m; };
  const VL_MOMENTS = [
    { id: "vl-hello", label: "VILLAIN", part: 1, async run() {
      try { if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
      point(() => $("#rows"), { ring: false, dim: false });
      await say("A new song: VILLAIN. Chords, melody and bass are ready, but there are no drums. Part 1: you make the beat.", [["LET'S GO", true, false, true]]);
      unpoint();
    } },
    Object.assign({}, q3m("new-drums"), { part: 1 }),
    Object.assign({}, q3m("q3-beat"), { part: 1 }),
    partBreak(1, 2, "Part 1 done: that's your beat. Part 2: make it drop."),
    Object.assign({}, q3m("q3-gap"), { part: 2 }),
    Object.assign({}, q3m("q3-double"), { part: 2 }),
    Object.assign({}, q3m("q3-listen"), { part: 2 }),
  ];

  let MOMENTS = Q1_MOMENTS;
  const QDEF = () => window.KT2_QUEST_OLD_SET ? [{ moments: Q1_MOMENTS, prize: "TOY MACHINE", goal: 500, unlock: "TOY MACHINE", end: "TOY MACHINE is yours now.", hud: "FIRST SONG" },
    { moments: Q2_MOMENTS, prize: "BUILD IT UP", goal: 300, unlock: null, end: "Your song builds up now.", hud: "BUILD IT UP", setup: () => q2Setup() },
    { moments: Q3_MOMENTS, prize: "DROP IT", goal: 600, unlock: "KILLDRUM", end: "Your song drops now.", hud: "DROP IT", setup: () => q3Setup() }]
    : [{ moments: Q1_MOMENTS, prize: "TOY MACHINE", goal: 500, unlock: "TOY MACHINE", end: "TOY MACHINE is yours now.", hud: "PLAYGROUND", parts: 1 },
    { moments: NR_MOMENTS, prize: "MAKE IT MOVE", goal: 400, unlock: null, end: "Your sound moves now.", hud: "MAKE IT MOVE", parts: 2, setup: neonSetup, line: "That's a sound that moves. Let's count it up." },
    { moments: VL_MOMENTS, prize: "YOUR OWN BEAT", goal: 600, unlock: "KILLDRUM", end: "Your beat, your drop. KILLDRUM is yours.", hud: "YOUR OWN BEAT", parts: 2, setup: villainSetup, line: "That's your own beat. Let's count it up." }];
  function paintPips(i) {
    pipsEl.innerHTML = "";
    MOMENTS.forEach((m, k) => pipsEl.append(H("i", k < i ? "done" : k === i ? "now" : "")));
    const Qd = QDEF()[QI] || {}, m = MOMENTS[i];
    stepEl.textContent = m ? ((Qd.parts > 1 && m.part ? "PART " + m.part + " \u00b7 " : "") + m.label) : "DONE";
  }

  // ---------------------------------------------------------------- the end (V4w): coins pour out of the patterns you
  // made into a bar at the top right, ding by ding; when it's full the number turns acid yellow, UNLOCKED, the card comes
  async function finale() {
    const Q = QDEF()[QI], GOAL = Q.goal;
    gateOn = false;
    quiet(); unpoint(); busy(false);
    if (ui.transport && ui.transport.playing) await run("togglePlay").catch(() => {});
    await say(Q.line || ["That's your first song. Let's count it up.", "That's a song that builds. Let's count it up.", "That's a drop. Let's count it up."][QI] || "Let's count it up.");
    await wait(1200);
    quiet();
    if (hud) hud.style.display = "none";
    const total = Math.max(GOAL, Math.round(coins));
    const m = H("div", "kq-meter"), top = H("div", "kq-mtop"), num = H("strong"), bar = H("div", "kq-mbar"), fill = H("i");
    top.append(H("b", null, Q.prize), num); bar.append(fill);
    m.append(top, bar, H("div", "kq-unl", Q.unlock ? "UNLOCKED" : "QUEST DONE"));
    layer.append(m);
    let count = 0;
    const show = () => { num.innerHTML = Math.round(count) + "<small>/ " + total + "</small>"; fill.style.width = Math.min(100, (count / total) * 100) + "%"; };
    show();
    await wait(400);
    const clips = S().tracks.flatMap((t) => t.clips).map((c) => clipEl(c.id)).filter(Boolean);
    const n = 36, share = total / n, to = () => { const r = num.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const flights = [];
    for (let i = 0; i < n; i++) {
      const src = clips.length ? clips[i % clips.length].getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 40, height: 20 };
      const x0 = src.left + Math.random() * src.width, y0 = src.top + Math.random() * src.height, t = to();
      const c = H("i", "kq-coin3"); c.style.left = x0 + "px"; c.style.top = y0 + "px"; layer.append(c);
      const mx = (x0 + t.x) / 2 + (Math.random() - 0.5) * 260, my = Math.min(y0, t.y) - 80 - Math.random() * 140;
      const a = c.animate([{ transform: "translate(0,0) scale(.6)" }, { transform: `translate(${mx - x0}px,${my - y0}px) scale(1.25)`, offset: 0.5 }, { transform: `translate(${t.x - x0}px,${t.y - y0}px) scale(.7)` }],
        { duration: 750, easing: "cubic-bezier(.45,0,.3,1)", fill: "forwards" });
      flights.push(new Promise((res) => { a.onfinish = () => {
        c.remove(); sCoin(i);
        count = Math.min(total, count + share); show();
        num.animate([{ transform: "scale(1.15)" }, { transform: "none" }], { duration: 120 });
        try { window.KT2_CARDS_POINTS && KT2_CARDS_POINTS(share); } catch (e) { /* fine */ }
        if (count >= total - 1e-6 && !m.classList.contains("full")) { m.classList.add("full"); snd("chime"); }
        res();
      }; }));
      await wait(55);
    }
    await Promise.all(flights);
    count = total; show(); m.classList.add("full");
    setCoins(0);
    await wait(1300);
    writeSave({ done: new Date().toISOString(), step: MOMENTS.length, coins: 0, won: total });
    if (Q.unlock && window.KT2Juice && KT2Juice.unlock) KT2Juice.unlock(Q.unlock);
    await wait(600);
    m.remove();
    // V4m: from the card, straight on to the next quest or back to the projects page
    const go = (where) => {
      const c = $(".kc-unlock .kc-go") || $(".kj-unlock .kj-go"); if (c) c.click();
      stop(false);
      if (where === "next" && QUESTS[QI + 1] && QUESTS[QI + 1].built) { const nq = QI + 1; setTimeout(() => start(false, nq), 400); return; }
      if (where === "next") {
        if (window.KT2Quest.showQuests) KT2Quest.showQuests();
        setTimeout(() => { const r = $(".kq-qmain .kq-row.next"); if (r) { r.scrollIntoView({ block: "center", behavior: "smooth" }); r.animate([{ boxShadow: "0 0 0 0 rgba(155,92,255,0)" }, { boxShadow: "0 0 0 3px #c9a8ff, 0 0 30px rgba(155,92,255,.8)" }, { boxShadow: "0 0 0 0 rgba(155,92,255,0)" }], { duration: 1400, iterations: 2 }); } }, 500);
      }
      else if (where === "home" && typeof showHome === "function") showHome(true);
    };
    // the end (Eman, 7 Nov 14:16: "bigger buttons on the center right side, not by the avatar"): one panel, NEXT QUEST first
    quiet();
    const panel = H("div", "kq-end"), btns = H("div", "kq-endrow");
    panel.append(H("small", null, Q.unlock ? Q.unlock + " UNLOCKED" : "QUEST " + (QI + 1) + " DONE"), H("h3", null, Q.end));
    const nx = H("button", "kq-endgo", "NEXT QUEST"), hm = H("button", "kq-endq", "BACK TO PROJECTS"), st = H("button", "kq-endstay", "STAY HERE");
    btns.append(nx, hm); panel.append(btns, st);
    if (!window.KT2_QUEST_END_OLD) {
      // let the card be seen on its own first, then the small panel comes in from the right, beside the card
      // Eman, 8 Nov 03:12: the card first, all the way, text written; then 1-2 s later the buttons, small, right of it
      { const t0 = Date.now(); while (!window.__qfast && Date.now() - t0 < 9000) { const u = $(".kc-unlock"); if (!u || u.classList.contains("hud-done")) break; await wait(150); } }
      await wait(window.__qfast ? 300 : 1500);
      panel.classList.add("kq-end2");
      const W = 220, card = $(".kc-unlock .kc-card") || $(".kj-unlock .kj-art") || $(".kj-unlock .kj-card");
      const cr = card && card.offsetWidth ? card.getBoundingClientRect() : { right: innerWidth / 2 + 180, top: innerHeight / 2, height: 0 };
      const free = innerWidth - 16 - (cr.right + 24);
      let left = cr.right + 24 + Math.max(0, (free - W) / 2);
      left = Math.min(left, innerWidth - 16 - W);
      panel.style.left = Math.max(16, left) + "px";
      if (free < W) { panel.style.top = "auto"; panel.style.bottom = "24px"; panel.style.transform = "none"; panel.style.animationName = "kq-in"; }
    }
    layer.append(panel);
    snd("whoosh");
    const where = await new Promise((res) => { nx.onclick = () => res("next"); hm.onclick = () => res("home"); st.onclick = () => res("stay"); });
    panel.remove();
    go(where);
  }

  // ---------------------------------------------------------------- level question
  function askLevel() {
    return new Promise((resolve) => {
      const m = H("div", "kq-modal"), box = H("div", "kq-pick");
      box.append(H("h2", null, "HOW DEEP ARE YOU IN?"));
      const row = H("div", "kq-cards");
      const lv = (name, line, tag, val, off) => {
        const b = H("button", "kq-lv"); b.append(H("em", null, tag), H("b", null, name), H("span", null, line));
        if (off) b.disabled = true; else b.onclick = () => { m.remove(); resolve(val); };
        b.onmouseenter = () => snd("tick", 4);
        return b;
      };
      row.append(lv("N00B", "Never made a song", "START HERE", "noob"), lv("BEATMAKER", "I know a DAW", "SOON", "mid", true), lv("PRO", "Just give me the tools", "SOON", "pro", true));
      const free = H("button", "kq-free", "SKIP / PLAY FREE");
      free.onclick = () => { m.remove(); resolve(null); };
      box.append(row, free);
      m.append(box);
      layer.append(m);
      say("Hey. Before we start: how deep are you in music?");
    });
  }

  // ---------------------------------------------------------------- start / stop
  async function start(resume, qi) {
    if (active) return;
    QI = qi || 0; MOMENTS = QDEF()[QI].moments; atBar = 0; keysOk = null;
    html.classList.toggle("kq-r2", !!window.KT2_QUEST_R2_LOOK); lastAim = null; zoomSeen = new Set();
    Object.keys(ids).forEach((k) => delete ids[k]);
    const saved = loadSave();
    if (resume && !(saved && saved.ids && saved.session && !saved.done)) resume = false;
    hookRun();
    active = true;
    window.TMM_AFTER_DRAW = () => { if (active) { placeSlots(); placeRing(); } };
    html.classList.add("kq-on");
    html.classList.toggle("kq-safe", safeOn());
    clearInterval(healT); if (safeOn()) healT = setInterval(() => { if (gateOn) healSong(); }, 1000);
    try { localStorage.setItem("killtoy.tour.seen", "1"); } catch (e) { /* fine */ }
    document.querySelectorAll(".kt-invite").forEach((e) => e.remove());
    buildLayer(); setCoins(0); paintPips(0);
    hud.style.display = "none";
    try {
      let from = 0;
      if (resume) {
        if (typeof openProject === "function") openProject(saved.session); else if (typeof showHome === "function") showHome(false);
        await untilState(() => S() && S().session === saved.session, 200);
        Object.assign(ids, saved.ids); setCoins(saved.coins || 0); from = Math.min(saved.step || 0, MOMENTS.length - 1);
        try { if (typeof showHome === "function") showHome(false); if (typeof fitSong === "function") fitSong(); } catch (e) { /* fine */ }
        say("Welcome back. Let's pick up where you left off.");
        await wait(1800);
      } else if (QI >= 1) {
        say("Quest " + (QI + 1) + ". Give me a second to open your song.");
        await QDEF()[QI].setup();
        writeSave({ ids: Object.assign({}, ids), session: S().session, step: 0, coins: 0, done: null, started: new Date().toISOString() });
      } else {
        // first: everyone makes their own guide creature (kt2-creator.js); later starts skip it. KT2_QUEST_NO_CREATOR = old.
        if (window.KT2Creator && window.KT2Creature && !window.KT2_QUEST_NO_CREATOR && !window.KT2Creature.load()) {
          if (layer) layer.style.visibility = "hidden";
          const me = await window.KT2Creator.open({ first: true });
          if (layer) layer.style.visibility = "";
          if (me && me.name) { say("I'm " + me.name + ". I'll be your guide."); await wait(1600); }
        }
        const level = await askLevel();
        if (!level) return stop(true);
        say("Perfect. We'll make your first song together. Give me a second to set it up.");
        await makeStarter();
        writeSave({ ids: Object.assign({}, ids), session: S().session, step: 0, coins: 0, done: null, started: new Date().toISOString() });
      }
      hud.style.display = "";
      gateOn = true;
      marks = {}; snags = {};
      for (let i = from; i < MOMENTS.length; i++) {
        paintPips(i);
        // a copy of the song as this step starts, for going back (V5p)
        try { await run("questSnap", { key: QI + ":" + i }); } catch (e) { /* no going back here */ }
        marks[i] = { ids: JSON.parse(JSON.stringify(ids)), coins, t0: Date.now() };
        stepNow = i; backWant = null;
        await healSong();
        const back = await new Promise((resolve, reject) => {
          backGo = resolve;
          Promise.resolve().then(() => MOMENTS[i].run()).then(() => resolve(null), (e) => {
            if (backWant) return resolve(backWant);
            // 10 Nov quest-safe: a step that hits a snag starts over from its own copy of the song instead of ending the quest
            // (twice at most; the third time it stops like before). KT2_QUEST_SAFE_OFF = old (ended at once).
            if (safeOn() && !/quest stopped/.test((e && e.message) || "") && (snags[i] = (snags[i] || 0) + 1) <= 2) {
              console.warn("[quest] step snag, again:", MOMENTS[i].id, e);
              return resolve({ to: i, snag: true });
            }
            reject(e);
          });
        });
        backGo = null;
        if (back) {
          const j = back.to;
          try { await closeWin(); } catch (e) { /* fine */ }
          try { if (ui.transport && ui.transport.playing) await run("togglePlay"); } catch (e) { /* fine */ }
          const r = await run("questRestore", { key: QI + ":" + j }).catch(() => null);
          Object.keys(ids).forEach((k) => delete ids[k]); Object.assign(ids, marks[j].ids);
          setCoins(marks[j].coins || 0);
          writeSave({ step: j, coins: Math.round(coins), ids: Object.assign({}, ids) });
          try { render(); } catch (e) { /* fine */ }
          await rawWait(600);   // anything of the old step still waiting runs into the halt and stops
          halt = false; backWant = null; cancel = null;
          if (!r || r.error) console.warn("[quest] back: no copy of step", j);
          say(back.snag ? "Oops, that one slipped. Let's do " + (MOMENTS[j].label || "it").toLowerCase() + " again." : "Back one step. Let's do " + (MOMENTS[j].label || "it").toLowerCase() + " again.");
          await rawWait(1400);
          i = j - 1;
          continue;
        }
        cancel = null;
        snd("chime");
        writeSave({ step: i + 1, coins: Math.round(coins), ids: Object.assign({}, ids) });
      }
      paintPips(MOMENTS.length);
      await finale();
    } catch (e) {
      if (!/quest stopped/.test(e.message)) { console.warn("[quest]", e); if (typeof toast === "function") toast("The quest hit a snag: " + e.message); stop(true); }
    }
  }
  // ---------------------------------------------------------------- back one step (V5p)
  let snags = {};
  let marks = {}, stepNow = 0, backWant = null, backGo = null;
  function goBack() {
    if (!active || halt || !backGo) return;
    // the step before this one that you actually did something in (steps that pass by themselves are skipped)
    let j = stepNow - 1;
    while (j > 0 && marks[j] && marks[j + 1] && marks[j + 1].t0 - marks[j].t0 < 1500) j--;
    if (j < 0 || !marks[j]) j = stepNow;
    halt = true; backWant = { to: j };
    const go = backGo; backGo = null;
    try { quiet(); unpoint(); unslots(); stopDemo(); } catch (e) { /* fine */ }
    keysOk = null; busy(false);
    go(backWant);
    if (cancel) { const c = cancel; cancel = null; try { c(); } catch (e) { /* fine */ } }
    watchers.clear();
    snd("tick", 3);
  }
  function stop(early) {
    halt = false;
    if (cancel) { const c = cancel; cancel = null; try { c(); } catch (e) { /* fine */ } }
    watchers.clear();
    gateOn = false; busy(false);
    clearInterval(typing);
    playModeBack();
    unslots(); wantBars(false); delete window.TM_ONLY_PRESETS; keysOk = null; atBar = 0;
    unpoint();
    if (layer) layer.remove();
    layer = hud = bub = null;
    active = false;
    html.classList.remove("kq-on", "kq-talk", "kq-busy", "kq-autoshow", "kq-shade", "kq-help2", "kq-safe");
    clearInterval(healT);
    if (early && coins) writeSave({ coins: Math.round(coins) });
    if (early && typeof toast === "function") toast("Quest paused. Your song stays. CONTINUE it from QUESTS on the projects page.");
  }
  // for the tests: would a press here do anything right now? (the same check the gate makes)
  function canPress(x, y, type) {
    const target = document.elementFromPoint(x, y);
    if (!target) return false;
    return allowedAt({ type: type || "pointerdown", clientX: x, clientY: y, target, isTrusted: true, button: 0 });
  }
  window.KT2Quest = { start, stop, back: goBack, get active() { return active; }, _ids: ids, _canPress: canPress, get _help() { return helpLv; } };

  // ---------------------------------------------------------------- the ways in
  // 1. the CARDS tab gets a PLAY QUEST button
  if (window.KT2Tabs && KT2Tabs.cards) {
    const orig = KT2Tabs.cards;
    KT2Tabs.cards = (pane) => {
      orig(pane);
      const root = $(".k2c", pane) || pane;
      const b = H("button", "kq-start", "PLAY QUEST: FIRST SONG");
      b.onclick = (e) => { e.stopPropagation(); start(); };
      root.style.position = root.style.position || "relative";
      root.append(b);
    };
  }
  // 2. a QUESTS tab on the projects page (Eman, 7 Nov 00:20): one banner row per quest
  const QUESTS = [
    { name: "PLAYGROUND", card: "TOY MACHINE", kind: "SYNTH", img: "cards/C2_tm.jpg", make: "NIGHT SHIFT \u00b7 what the playground does, then chords and a melody", min: 15, coins: 500, built: true, parts: 1 },
    { name: "MAKE IT MOVE", card: "COINS", kind: "400", make: "NEON RUN \u00b7 a TOY MACHINE sound, a pluck, a cutoff that opens", min: 14, coins: 400, built: true, parts: 2 },
    { name: "YOUR OWN BEAT", card: "KILLDRUM", kind: "DRUMS", img: "cards/C2_kd.jpg", make: "VILLAIN \u00b7 your beat with KILLDRUM, a gap, the drop twice", min: 12, coins: 600, built: true, parts: 2 },
    { name: "LOW END", card: "VOID 808", kind: "808 + BASS", make: "VILLAIN \u00b7 an 808 that follows the chords, sidechain", min: 12, coins: 700, parts: 1 },
    { name: "BALANCE IT", card: "MIX DESK", kind: "MIXER", make: "RAINY TAPE \u00b7 volume, pan, mute and solo", min: 10, coins: 700, parts: 1 },
    { name: "ADD DEPTH", card: "HAUNT FX", kind: "FX PACK", make: "RAINY TAPE \u00b7 space, echo and grit", min: 15, coins: 800, parts: 1 },
    { name: "YOUR VOICE", card: "TUNR", kind: "VOCALS", make: "RAGE ROOM \u00b7 one line of vocals, in key", min: 15, coins: 1000, parts: 1 },
    { name: "YOUR SONG", card: "FINISHER", kind: "LOUD + BOUNCE", make: "Pick a song start, then make the whole song yourself", min: 60, coins: 2000, parts: 6 },
  ];
  if (window.KT2_QUEST_OLD_SET) { QUESTS[0].name = "FIRST SONG"; Object.assign(QUESTS[1], { name: "BUILD IT UP", kind: "300", coins: 300, parts: 1 }); Object.assign(QUESTS[2], { name: "DROP IT", parts: 1 }); }
  const qcss = H("style");
  qcss.textContent = `
  .kq-tabs { display: flex; gap: 22px; align-items: center; }
  .kq-tabs button { background: none; border: 0; padding: 6px 0; font: 600 12px Inter, sans-serif; letter-spacing: .22em; text-transform: uppercase; color: #6b6b78; cursor: pointer; border-bottom: 2px solid transparent; }
  .kq-tabs button.on { color: #fff; border-bottom-color: #9b5cff; }
  .kq-tabs button:hover { color: #fff; }
  .kq-tabs .kq-new { font-size: 9px; letter-spacing: .14em; color: #c9a8ff; margin-left: 6px; }
  .k2h-shell.kq-show > .k2h-main { display: none !important; }
  .kq-qmain { display: none; overflow: auto; padding: 26px 30px 60px; flex: 1; min-width: 0; }
  .k2h-shell.kq-show > .kq-qmain { display: block; }
  .kq-qhead { display: flex; align-items: baseline; gap: 14px; margin-bottom: 14px; font: 700 12px "Martian Mono", monospace; letter-spacing: .22em; color: #8a8a96; }
  .kq-qhead b { color: #E4FF3A; }
  .kq-qhead .kq-tot { margin-left: auto; color: #8a8a96; }
  .kq-row { position: relative; display: grid; grid-template-columns: 132px minmax(0,1fr) 200px; gap: 26px; align-items: center; background: #232327; padding: 18px 22px; margin-bottom: 12px; overflow: hidden; }
  .kq-row.next, .kq-row.going { background: radial-gradient(120% 140% at 30% 120%, rgba(155,92,255,.55), rgba(155,92,255,0) 60%), #232327; }
  .kq-row.locked { opacity: .55; }
  .kq-row.done { background: linear-gradient(90deg, rgba(155,92,255,.18), rgba(155,92,255,0) 60%), #232327; }
  .kq-cardart { position: relative; width: 132px; aspect-ratio: 700/938; background: #18181c; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,.5); }
  .kq-cardart img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .kq-cardart.mystery img { filter: blur(9px) grayscale(1) brightness(.6); transform: scale(1.15); }
  .kq-cardart .kq-q { position: absolute; inset: 0; display: grid; place-items: center; font: 900 64px "UnifrakturMaguntia", Georgia, serif; color: #fff; text-shadow: 0 0 18px rgba(0,0,0,.8); }
  .kq-cardart .kq-tag { position: absolute; left: 6px; top: 6px; font: 800 8px Inter, sans-serif; letter-spacing: .16em; padding: 3px 5px; background: #9b5cff; color: #fff; }
  .kq-cardart .kq-tag.won { background: #fff; color: #111; }
  .kq-mid { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .kq-title { display: flex; align-items: baseline; gap: 12px; }
  .kq-title em { font: 700 11px "Martian Mono", monospace; color: #8a8a96; font-style: normal; letter-spacing: .1em; }
  .kq-title b { font: 800 24px Inter, sans-serif; letter-spacing: .04em; color: #fff; }
  .kq-win { font: 600 11px Inter, sans-serif; letter-spacing: .18em; color: #c9a8ff; text-transform: uppercase; }
  .kq-info { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; }
  .kq-info div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .kq-info span { font: 600 10px Inter, sans-serif; letter-spacing: .16em; color: #8a8a96; text-transform: uppercase; }
  .kq-info strong { font: 500 17px Inter, sans-serif; color: #fff; white-space: nowrap; }
  .kq-make { font: 400 13px Inter, sans-serif; color: #9a9aa6; }
  .kq-bar { height: 6px; background: #34343b; position: relative; }
  .kq-bar i { position: absolute; left: 0; top: 0; bottom: 0; background: #9b5cff; box-shadow: 0 0 10px rgba(155,92,255,.8); }
  .kq-side { display: flex; flex-direction: column; align-items: stretch; gap: 10px; }
  .kq-go { border: 0; padding: 14px 18px; font: 800 12px Inter, sans-serif; letter-spacing: .2em; cursor: pointer; }
  .kq-go.start { background: #E4FF3A; color: #111; }
  .kq-go.cont { background: #E4FF3A; color: #111; }
  .kq-go.again { background: #9b5cff; color: #fff; }
  .kq-go.lock { background: #2c2c33; color: #6b6b78; cursor: default; }
  .kq-go.lock::before { content: ""; display: inline-block; width: 8px; height: 6px; border: 1.5px solid currentColor; border-top-width: 0; margin-right: 8px; vertical-align: 0; box-shadow: 0 -4px 0 -1.5px transparent; }
  .kq-restart { background: none; border: 0; color: #6b6b78; font: 600 10px Inter, sans-serif; letter-spacing: .16em; cursor: pointer; }
  .kq-restart:hover { color: #fff; }
  .kq-parts { display: inline-flex; align-items: center; margin-left: 12px; vertical-align: middle; }
  .kq-parts i { width: 18px; height: 18px; border: 2px solid #9b5cff; display: grid; place-items: center; font: 800 9px Inter, sans-serif; font-style: normal; color: #c9a8ff; }
  .kq-parts i.on { background: #9b5cff; color: #fff; }
  .kq-parts b { width: 14px; height: 3px; background: #3a3a44; }
  .kq-parts b.on { background: #9b5cff; }
  .kq-parts span { margin-left: 8px; font: 700 9px Inter, sans-serif; letter-spacing: .16em; color: #8a8a96; }
  `;
  document.head.append(qcss);
  function questState(i) {
    const sv = loadSave(0);   // quest 1 own save (was the open quest: quest 1 showed WON after winning quest 2)
    // every built quest is open to play, done or not (Eman, 7 Nov); window.KT2_QUEST_CHAIN_LOCK = old "win the one before first"
    let old = null; try { old = JSON.parse(localStorage.getItem("kt2.quest.firstSong.v4") || "null"); } catch (e) { /* fine */ }
    const done1 = !!((sv && sv.done) || (!sv && old && old.done)), going1 = !!(sv && sv.ids && !sv.done);
    if (i === 0) return done1 ? { st: "done", p: 1 } : going1 ? { st: "going", p: (sv.step || 0) / Q1_MOMENTS.length } : { st: "next", p: 0 };
    const s2 = loadSave(1), done2 = !!(s2 && s2.done), going2 = !!(s2 && s2.ids && !s2.done);
    const n2 = QDEF()[1].moments.length, n3 = QDEF()[2].moments.length;
    if (i === 1) return !done1 && window.KT2_QUEST_CHAIN_LOCK ? { st: "locked", p: 0 } : done2 ? { st: "done", p: 1 } : going2 ? { st: "going", p: (s2.step || 0) / n2 } : { st: "next", p: 0 };
    const s3 = loadSave(2), done3 = !!(s3 && s3.done), going3 = !!(s3 && s3.ids && !s3.done);
    if (i === 2) return !done2 && window.KT2_QUEST_CHAIN_LOCK ? { st: "locked", p: 0 } : done3 ? { st: "done", p: 1 } : going3 ? { st: "going", p: (s3.step || 0) / n3 } : { st: "next", p: 0 };
    if (i === 3 && done3) return { st: "next", p: 0 };
    return { st: "locked", p: 0 };
  }
  function questRow(q, i) {
    const { st, p } = questState(i), row = H("div", "kq-row " + st);
    const art = H("div", "kq-cardart" + (st === "done" || st === "going" ? "" : " mystery"));
    const img = H("img"); img.src = q.img || ("cards/kc-lock" + ((i % 6) + 1) + ".jpg"); img.alt = ""; img.draggable = false; art.append(img);
    if (st === "done") art.append(H("i", "kq-tag won", "WON"));
    else if (st === "going") art.append(H("i", "kq-tag", "TRIAL"));
    else art.append(H("i", "kq-q", "?"));
    const mid = H("div", "kq-mid");
    const title = H("div", "kq-title"); title.append(H("em", null, "QUEST " + String(i + 1).padStart(2, "0")), H("b", null, q.name));
    const win = H("div", "kq-win", st === "done" || st === "going" ? "WIN: " + q.card + " / " + q.kind : "WIN: ? ? ?");
    const info = H("div", "kq-info");
    const cell = (k, v) => { const d = H("div"); d.append(H("span", null, k), H("strong", null, v)); info.append(d); };
    const sv = loadSave(i);
    cell("Time", "~" + q.min + " min");
    cell("Coins", (st === "done" && sv && sv.won ? sv.won : q.coins).toLocaleString("en-US").replace(/,/g, " "));
    cell("Done", Math.round(p * 100) + "%");
    cell("Status", st === "done" ? "Won" : st === "going" ? "In progress" : st === "next" ? "Ready" : !q.built && !window.KT2_QUEST_SOON_OFF ? "Coming soon" : "Locked");
    const bar = H("div", "kq-bar"), fill = H("i"); fill.style.width = p * 100 + "%"; bar.append(fill);
    // the parts of a quest, joined by a line (game plan): filled as you get through them
    if (q.parts > 1) {
      const pl = H("div", "kq-parts"), done = st === "done" ? q.parts : Math.floor(p * q.parts + 1e-6);
      for (let k = 0; k < q.parts; k++) { if (k) pl.append(H("b", k <= done ? "on" : "")); pl.append(H("i", k < done ? "on" : "", String(k + 1))); }
      pl.append(H("span", null, q.parts + " PARTS"));
      title.append(pl);
    }
    mid.append(title, win, H("div", "kq-make", q.make), info, bar);
    const side = H("div", "kq-side");
    let go;
    if (st === "going") { go = H("button", "kq-go cont", "CONTINUE"); go.onclick = () => start(true, i); }
    else if (st === "next") { go = H("button", "kq-go start", "START QUEST"); go.onclick = () => { if (!q.built) { snd("nope"); if (typeof toast === "function") toast("Quest " + (i + 1) + " is being built. Quest 1 is ready to play."); return; } start(false, i); }; }
    else if (st === "done" && !window.KT2_QUEST_PLAY_AGAIN) {
      // a won quest: OPEN its song to listen (it lives here, not in ALL PROJECTS), or START OVER (Eman, 7 Nov)
      const ses = sv && sv.session, there = !!(ses && ui.state && (ui.state.sessions || []).includes(ses));
      go = H("button", "kq-go again", "OPEN");
      go.onclick = () => { if (!there) { snd("nope"); if (typeof toast === "function") toast("This quest's song isn't in this browser any more. START OVER makes it again."); return; } if (typeof openProject === "function") openProject(ses); };
    }
    else if (st === "done") { go = H("button", "kq-go again", "PLAY AGAIN"); go.onclick = () => { writeSave({ ids: null, done: null, step: 0, coins: 0 }, i); start(false, i); }; }
    // V5p (Eman, 21:02 "LOW END doesn't work"): quests 4-10 aren't made yet, and now say so. KT2_QUEST_SOON_OFF = old LOCKED.
    else { go = H("button", "kq-go lock", !q.built && !window.KT2_QUEST_SOON_OFF ? "COMING SOON" : "LOCKED"); go.onclick = () => { snd("nope"); if (!q.built && !window.KT2_QUEST_SOON_OFF && typeof toast === "function") toast("Quest " + (i + 1) + " " + q.name + " isn't made yet. Listen to how it will sound in the Quest Listening Room."); row.animate([{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }], { duration: 220 }); }; }
    go.onmouseenter = () => snd("tick", 4);
    side.append(go);
    if (st === "going" || (st === "done" && !window.KT2_QUEST_PLAY_AGAIN)) { const r = H("button", "kq-restart", "START OVER"); r.onclick = () => { try { localStorage.removeItem(SAVE_KEYS[i]); } catch (e) { /* fine */ } start(false, i); }; side.append(r); }
    row.append(art, mid, side);
    return row;
  }
  function paintQuests(box) {
    box.innerHTML = "";
    const head = H("div", "kq-qhead");
    const nDone = QUESTS.filter((q, i) => questState(i).st === "done").length;
    head.append(H("span", null, "QUESTS"), H("span", null, String(QUESTS.length)), H("b", null, nDone + " WON"), H("span", "kq-tot", QUESTS.reduce((a, q) => a + q.coins, 0).toLocaleString("en-US").replace(/,/g, " ") + " COINS IN ALL"));
    box.append(head, ...QUESTS.map(questRow));
  }
  function mountHomeTab() {
    const bar = $(".home-bar"), shell = $(".k2h-shell"), crumb = bar && $(".home-crumb", bar);
    if (!bar || !shell || !crumb || $(".kq-tabs", bar)) return !!(bar && $(".kq-tabs", bar));
    const tabs = H("div", "kq-tabs");
    const all = H("button", "on", "All projects"), qs = H("button");
    qs.append("Quests"); const nw = H("span", "kq-new", "NEW"); qs.append(nw);
    tabs.append(all, qs);
    crumb.replaceWith(tabs);
    const box = H("div", "kq-qmain");
    shell.append(box);
    const show = (q) => { const was = shell.classList.contains("kq-show"); shell.classList.toggle("kq-show", q); all.classList.toggle("on", !q); qs.classList.toggle("on", q); if (q) { paintQuests(box); if (window.KT2_QUEST_TAB_SND_OLD) snd("whoosh"); else if (!was) snd("fanfare"); } };
    all.onclick = () => show(false);
    qs.onclick = () => show(true);
    window.KT2Quest.showQuests = () => { if (typeof showHome === "function") showHome(true); show(true); };
    return true;
  }
  if (!mountHomeTab()) { const t = setInterval(() => { if (mountHomeTab()) clearInterval(t); }, 400); setTimeout(() => clearInterval(t), 20000); }

  // 3. the page address #quest (starts quest 1) or #quests (opens the tab)
  if (/^#quest$/.test(location.hash)) setTimeout(() => start(false), 2500);
  if (/^#quest2$/.test(location.hash)) setTimeout(() => start(false, 1), 2500);
  if (/^#quest3$/.test(location.hash)) setTimeout(() => start(false, 2), 2500);
  if (/^#quests$/.test(location.hash)) setTimeout(() => window.KT2Quest.showQuests && KT2Quest.showQuests(), 1500);
})();
