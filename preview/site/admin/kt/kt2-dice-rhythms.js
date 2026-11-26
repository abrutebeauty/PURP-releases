// MIDI DICE rhythm list by category (Eman, 15 Nov 2026: "add more here alternatives, put like a side bar with some
// categories, from CLASSIC, to more alternative, and experimental"). Read by ui/toymachine-dice.js (QPRE); the old
// 11-rhythm list stays behind KT2_DICE_RHYCATS_OFF.
// Every rhythm: h = [[start, length], ...] in 16th notes, len = steps before it loops (16 = 1 bar, 32 = 2 bars).
// The CLASSIC ids that already existed (whole ... bounce) keep their ids and notes so saved picks still match.
(function () {
  "use strict";
  // Euclidean rhythm: k hits spread as evenly as possible over n steps (Toussaint), starting on the 1
  const euclid = (k, n) => { const on = []; for (let i = 0; i < n; i++) if (Math.floor((i * k) / n) !== Math.floor(((i - 1) * k) / n) || i === 0) on.push(i); return on; };
  // hit steps -> [[start, length to the next hit]]; short = staccato length instead
  const run = (steps, len, short) => steps.map((a, i) => [a, short || (i + 1 < steps.length ? steps[i + 1] : len) - a]);
  const R = (id, n, cat, h, len, t) => ({ id, n, cat, h, len: len || 16, t: t || "" });
  const list = [
    // ---- CLASSIC: the basics every beat uses
    R("whole", "WHOLE", "classic", [[0, 16]]),
    R("halves", "HALVES", "classic", [[0, 8], [8, 8]]),
    R("quarters", "QUARTERS", "classic", [[0, 4], [4, 4], [8, 4], [12, 4]]),
    R("eighths", "8THS", "classic", run([0, 2, 4, 6, 8, 10, 12, 14], 16)),
    R("offbeat", "OFFBEAT", "classic", [[2, 2], [6, 2], [10, 2], [14, 2]]),
    R("332", "3-3-2", "classic", [[0, 6], [6, 6], [12, 4]], 16, "Tresillo: three, three, two"),
    R("dembow", "3-3-2 X2", "classic", [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]], 16, "Dembow / reggaeton"),
    R("charleston", "CHARLESTON", "classic", [[0, 3], [6, 4]]),
    R("push", "PUSH", "classic", [[0, 7], [7, 9]]),
    R("stabs", "STABS", "classic", [[0, 1], [3, 1], [6, 1], [10, 1], [12, 1]]),
    R("bounce", "BOUNCE", "classic", [[0, 2], [3, 1], [6, 2], [8, 2], [11, 1], [14, 2]]),
    R("hold2", "2-BAR HOLD", "classic", [[0, 32]], 32, "One chord rings for two bars"),
    R("backbeat", "BACKBEAT", "classic", [[4, 2], [12, 2]], 16, "Only on 2 and 4, with the snare"),
    R("anticip", "ANTICIPATE", "classic", [[0, 10], [10, 6]], 16, "Next hit lands early, on the and of 3"),
    R("dotted", "DOTTED 8THS", "classic", run([0, 3, 6, 9, 12], 16), 16, "Every dotted 8th, like a delay"),
    R("halftime", "HALF-TIME", "classic", [[0, 12], [16, 4], [24, 8]], 32, "Slow, heavy, room for the 808"),

    // ---- ALTERNATIVE: real rhythms from trap, drill, latin, afro, garage
    R("trapstab", "TRAP STAB", "alt", [[0, 2], [7, 1], [10, 2]], 16, "Sparse dark stabs, leaves space for hats"),
    R("drill", "DRILL", "alt", [[0, 3], [3, 3], [10, 2], [13, 3]], 16, "UK / NY drill chord bounce"),
    R("villain", "VILLAIN", "alt", [[0, 10], [10, 1], [11, 1], [12, 4]], 16, "Long hold, then a quick double into 4"),
    R("sliding", "808 SLIDE", "alt", [[0, 6], [6, 4], [14, 2], [16, 6], [22, 6], [28, 4]], 32, "Follows a sliding 808 line"),
    R("jersey", "JERSEY", "alt", run([0, 4, 8, 11, 14], 16, 2), 16, "Jersey club kick bounce"),
    R("habanera", "HABANERA", "alt", run([0, 3, 4, 6, 8, 11, 12, 14], 16), 16, "Dotted 8th, 16th, two 8ths"),
    R("son32", "SON CLAVE 3-2", "alt", run([0, 3, 6, 10, 12], 16), 16, "The clave from salsa and son"),
    R("son23", "SON CLAVE 2-3", "alt", run([2, 4, 8, 11, 14], 16, 2), 16, "Same clave, starting from the other side"),
    R("rumba", "RUMBA CLAVE", "alt", run([0, 3, 7, 10, 12], 16), 16, "Like son clave, third hit pushed late"),
    R("bossa", "BOSSA CLAVE", "alt", run([0, 3, 6, 10, 13], 16), 16, "Bossa nova clave"),
    R("cinquillo", "CINQUILLO", "alt", run([0, 2, 3, 5, 6, 8, 10, 11, 13, 14], 16), 16, "Cuban five-note figure"),
    R("afro", "AFRO ROLL", "alt", run([0, 3, 5, 6, 8, 11, 13, 14], 16, 1.5), 16, "Highlife / afrobeats guitar roll"),
    R("house", "HOUSE STAB", "alt", run([0, 3, 5, 8, 11, 13], 16, 1), 16, "Piano house skip"),
    R("garage", "2-STEP", "alt", [[0, 2], [7, 1], [10, 2], [13, 1]], 16, "UK garage skip, beat 3 left empty"),
    R("shuffle", "SHUFFLE", "alt", run([0, 3, 4, 7, 8, 11, 12, 15], 16), 16, "Long-short swing feel"),
    R("funk", "FUNK CHANK", "alt", [[0, 1], [2, 1], [3, 2], [6, 1], [8, 1], [10, 1], [11, 2], [14, 1]], 16, "Choppy 16th funk guitar"),
    R("callresp", "CALL + ANSWER", "alt", [[0, 16], [16, 1], [19, 1], [22, 1], [26, 1], [28, 2]], 32, "Bar 1 holds, bar 2 answers in stabs"),

    // ---- EXPERIMENTAL: odd groupings, polyrhythms, euclid, glitch
    R("poly34", "3 OVER 4", "exp", run([0, 6, 12, 18, 24, 30], 32), 32, "Dotted quarters against the 4/4 beat"),
    R("poly54", "FIVE ACROSS", "exp", run([0, 6, 13, 19, 26], 32), 32, "Five even hits across two bars"),
    R("sevens", "SEVENS", "exp", run([0, 7, 14, 21, 28], 32), 32, "A hit every 7 sixteenths, drifts over the bar line"),
    R("fives", "FIVES", "exp", run([0, 5, 10, 15, 20, 25, 30], 32), 32, "A hit every 5 sixteenths"),
    R("e316", "EUCLID 3", "exp", run(euclid(3, 16), 16), 16, "3 hits spread over 16 steps"),
    R("e716", "EUCLID 7", "exp", run(euclid(7, 16), 16, 1.5), 16, "7 hits spread over 16 steps"),
    R("e916", "EUCLID 9", "exp", run(euclid(9, 16), 16, 1), 16, "9 hits spread over 16 steps"),
    R("e1124", "EUCLID 11/24", "exp", run(euclid(11, 24), 24, 1), 24, "11 hits over a bar and a half"),
    R("5551", "5-5-5-1", "exp", [[0, 5], [5, 5], [10, 5], [15, 1]], 16, "Three fives and a catch"),
    R("accel", "SPEED UP", "exp", [[0, 8], [8, 4], [12, 2], [14, 1], [15, 1]], 16, "Each hit half as long as the last"),
    R("decay", "SLOW DOWN", "exp", [[0, 1], [1, 1], [2, 2], [4, 4], [8, 8]], 16, "Starts fast, ends long"),
    R("stutter", "STUTTER", "exp", [[0, 1], [1, 1], [2, 1], [3, 1], [8, 6], [14, 1], [15, 1]], 16, "Glitchy retrigger"),
    R("rage", "RAGE", "exp", [[0, 1], [1, 1], [2, 1], [4, 1], [5, 1], [6, 1], [8, 1], [9, 1], [11, 1], [12, 1], [13, 1], [15, 1]], 16, "Gated 16ths with holes"),
    R("late", "LATE", "exp", [[3, 13]], 16, "Comes in a 16th-and-a-half late, every bar"),
    R("onehit", "ONE HIT", "exp", [[0, 2]], 32, "One short hit every two bars, all space"),
    R("ghost", "GHOST", "exp", [[6, 1], [14, 1], [19, 1], [27, 3]], 32, "Never on the beat"),
  ];
  window.KT2DiceRhythms = {
    cats: [{ id: "classic", n: "CLASSIC" }, { id: "alt", n: "ALTERNATIVE" }, { id: "exp", n: "EXPERIMENTAL" }],
    list,
  };
})();
