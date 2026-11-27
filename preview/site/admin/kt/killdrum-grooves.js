// KILLDRUM groove library: hand-programmed drum patterns per genre, data only.
// Each groove: { id, name, genre, bpm: [lo, hi], bars: 1|2, tags, pads: { slot: steps } }
// Steps are 16 chars per bar (one bar of 16ths): "." off, "x" hit, "X" accent, "o" ghost,
// "2" "3" "4" = a roll of that many hits inside the 16th, "t" = triplet roll.
// Pads: kick, 808, snare, clap, hat_closed, hat_open, perc, fx, texture. A missing pad is silent.
(function () {
  "use strict";

  var GROOVES = [
    // ---------------------------------------------------------------- TRAP
    {
      id: "trap-atl-bounce", name: "ATL Bounce", genre: "trap", bpm: [135, 150], bars: 2,
      tags: ["bouncy", "half-time", "metro"],
      pads: {
        kick:       "x.........x....." + "x.....x...x....x",
        "808":      "x.........x....." + "x.....x...x....x",
        snare:      "........X......." + "........X.......",
        clap:       "........x......." + "........x.......",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x3x4",
        hat_open:   "................" + "..............x.",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "trap-southside", name: "Southside", genre: "trap", bpm: [140, 150], bars: 2,
      tags: ["dark", "808 heavy", "hard"],
      pads: {
        kick:       "x......x..x....." + "x......x..x..x..",
        "808":      "x......x..x....." + "x......x..x...x.",
        snare:      "........X......." + "........X.......",
        clap:       "........x......." + "........x.......",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.3.",
        hat_open:   "......x........." + "......x.......x."
      }
    },
    {
      id: "trap-wheezy-swing", name: "Wheezy Swing", genre: "trap", bpm: [130, 145], bars: 2,
      tags: ["swing", "melodic", "snaps"],
      pads: {
        kick:       "x.....x...x....." + "x.....x.....x.x.",
        "808":      "x.....x...x....." + "x.....x.....x.x.",
        snare:      "........X......." + "........X.......",
        clap:       "........x......." + "........x.......",
        hat_closed: "x.x.x.xxx.x.x.x." + "x.x.x.xxx.x.x.tt",
        hat_open:   "..............x." + "..............x.",
        perc:       "....x.......x..." + "....x.......x..."
      }
    },
    {
      id: "trap-pierre-pattern", name: "Pi'erre Pattern", genre: "trap", bpm: [145, 160], bars: 2,
      tags: ["pierre", "bouncy", "808 pickups"],
      pads: {
        kick:       "x.........x.x..." + "x..x......x.x...",
        "808":      "x.........x.x..." + "x..x......x.x...",
        clap:       "........X......." + "........X.......",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x2x.x.x.x4",
        hat_open:   ".......x........" + ".......x........",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "trap-metro-rolls", name: "Metro Rolls", genre: "trap", bpm: [135, 150], bars: 2,
      tags: ["rolls", "aggressive", "metro"],
      pads: {
        kick:       "x..........x...." + "x.....x....x....",
        "808":      "x..........x...." + "x.....x....x..x.",
        snare:      "........X......." + "........X.......",
        clap:       "........x......." + "........x.......",
        hat_closed: "x.x.x.x3x.x.x.x3" + "x.x.x.x.x.x.4444",
        hat_open:   "..............x." + "..............x.",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "trap-slow-bounce", name: "Slow Bounce", genre: "trap", bpm: [130, 140], bars: 1,
      tags: ["laid back", "half-time", "simple"],
      pads: {
        kick:       "x.........x.....",
        "808":      "x.........x.....",
        snare:      "........X.......",
        clap:       "........x.......",
        hat_closed: "x.x.x.x.x.x.x.x.",
        hat_open:   "......x.........",
        perc:       "............x..."
      }
    },
    {
      id: "trap-hi-energy", name: "Hi Energy", genre: "trap", bpm: [150, 160], bars: 2,
      tags: ["fast", "16th hats", "rolls"],
      pads: {
        kick:       "x.....x...x....." + "x.....x...x..x.x",
        "808":      "x.....x...x....." + "x.....x...x..x.x",
        snare:      "........X......." + "........X.......",
        clap:       "........x......." + "........x.......",
        hat_closed: "XxxxXxxxXxxxXxxx" + "XxxxXxxxXxxx3333",
        hat_open:   "..........x....." + "..........x.....",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "trap-triplet-ride", name: "Triplet Ride", genre: "trap", bpm: [140, 150], bars: 2,
      tags: ["triplet", "swing", "snaps"],
      pads: {
        kick:       "x.........x....." + "x.........x..x..",
        "808":      "x.........x....." + "x.........x..x..",
        snare:      "........X......." + "........X.......",
        clap:       "........x......." + "........x.......",
        hat_closed: "x.t.x.t.x.t.x.t." + "x.t.x.t.x.t.tttt",
        hat_open:   "..............x." + "..............x.",
        perc:       "....x.......x..." + "....x.......x..."
      }
    },
    {
      id: "trap-slide-city", name: "Slide City", genre: "trap", bpm: [135, 150], bars: 2,
      tags: ["808 slides", "busy 808", "dark"],
      pads: {
        kick:       "x.........x....." + "x......x..x.....",
        "808":      "x..x......x...x." + "x......x..x.x...",
        snare:      "........X......." + "........X.......",
        clap:       "........x......." + "........x.......",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.2.",
        hat_open:   "..............x." + "................"
      }
    },

    // ---------------------------------------------------------------- RAGE
    {
      id: "rage-whole-lotta", name: "Whole Lotta", genre: "rage", bpm: [150, 160], bars: 2,
      tags: ["carti", "distorted 808", "claps"],
      pads: {
        kick:       "x..............." + "x...............",
        "808":      "x.........x....." + "x......x..x..x..",
        clap:       "........X......." + "........X.......",
        hat_closed: "x.x.x.x.x.x.xxxx" + "x.x.x.x.x.x.4444",
        hat_open:   "..........x....." + "..........x.....",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "rage-teen-x", name: "Teen X", genre: "rage", bpm: [145, 160], bars: 2,
      tags: ["ken carson", "bouncy", "open hats"],
      pads: {
        kick:       "x.........x....." + "x.........x.....",
        "808":      "x.........x..x.." + "x.....x...x....x",
        clap:       "........X......." + "........X.......",
        hat_closed: "xxxxxxxxxxxxxxxx" + "xxxxxxxx2222xxxx",
        hat_open:   "..x...x...x...x." + "..x...x...x...x."
      }
    },
    {
      id: "rage-destroy", name: "Destroy", genre: "rage", bpm: [140, 155], bars: 2,
      tags: ["destroy lonely", "dark", "sparse"],
      pads: {
        kick:       "x..............." + "x...............",
        "808":      "x......x........" + "x......x....x...",
        snare:      "........X......." + "........X.......",
        clap:       "........X......." + "........X.......",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "......x........." + "......x.......x."
      }
    },
    {
      id: "rage-pierre-rage", name: "Pi'erre Rage", genre: "rage", bpm: [150, 160], bars: 2,
      tags: ["pierre", "bouncy", "rolls"],
      pads: {
        kick:       "x.........x....." + "x..x......x.....",
        "808":      "x.........x....." + "x..x......x...x.",
        clap:       "........X......." + "........X.......",
        hat_closed: "x.x.x.x.x.x3x.x3" + "x.x.x.x.x.x.4t4t",
        hat_open:   "..............x." + "..............x.",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "rage-stomp", name: "Stomp", genre: "rage", bpm: [140, 150], bars: 1,
      tags: ["heavy", "stomp", "simple"],
      pads: {
        kick:       "x.........x.....",
        "808":      "x.........x.....",
        snare:      "........X.......",
        clap:       "........X.......",
        hat_closed: "x.x.xxx.x.x.xxxx",
        hat_open:   "..x.......x.....",
        fx:         "x..............."
      }
    },
    {
      id: "rage-32nds", name: "32nds", genre: "rage", bpm: [150, 160], bars: 2,
      tags: ["busy hats", "32nd", "energy"],
      pads: {
        kick:       "x..............." + "x...............",
        "808":      "x.........x....." + "x.....x...x.x...",
        clap:       "........X......." + "........X.......",
        hat_closed: "x2x2x2x2x2x2x2x2" + "x2x2x2x2x2x24444",
        hat_open:   "..........x....." + "..........x....."
      }
    },
    {
      id: "rage-bounce", name: "Rage Bounce", genre: "rage", bpm: [145, 160], bars: 2,
      tags: ["bouncy", "distorted", "clap pickup"],
      pads: {
        kick:       "x.........x....." + "x......x..x.....",
        "808":      "x.........x..x.." + "x......x..x.....",
        clap:       "........X......." + "........X.....x.",
        hat_closed: "x.xxx.xxx.xxx.xx" + "x.xxx.xxx.xx3333",
        hat_open:   "..............x." + "..............x.",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "rage-no-snare", name: "No Snare", genre: "rage", bpm: [140, 155], bars: 2,
      tags: ["clap only", "minimal", "3-3-2"],
      pads: {
        kick:       "x..............." + "x...............",
        "808":      "x....x....x....." + "x....x....x..x..",
        clap:       "........X......." + "........X.......",
        hat_closed: "x...x...x...x..." + "x...x...x...4444",
        hat_open:   "..x...x...x...x." + "..x...x...x...x."
      }
    },

    // ---------------------------------------------------------------- DRILL
    {
      id: "drill-uk-classic", name: "UK Drill", genre: "drill", bpm: [140, 144], bars: 2,
      tags: ["uk", "sliding 808", "classic"],
      pads: {
        kick:       "x......x..x....." + "x......x..x.....",
        "808":      "x......x..x....." + "x......x..x..x..",
        snare:      "........X.....x." + "........X....x..",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.t.t.",
        hat_open:   "................" + "..............x."
      }
    },
    {
      id: "drill-ny-bounce", name: "NY Drill", genre: "drill", bpm: [140, 146], bars: 2,
      tags: ["ny", "pop smoke", "bouncy"],
      pads: {
        kick:       "x.........x....." + "x......x..x.....",
        "808":      "x.........x..x.." + "x......x..x...x.",
        snare:      "........X....x.." + "........X....x..",
        clap:       "........x......." + "........x.......",
        hat_closed: "x..x..x.x..x..x." + "x..x..x.x..x..33",
        hat_open:   "..............x." + "..............x.",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "drill-triplet", name: "Triplet Drill", genre: "drill", bpm: [138, 144], bars: 2,
      tags: ["triplet hats", "dark", "uk"],
      pads: {
        kick:       "x......x..x....." + "x......x..x.....",
        "808":      "x......x..x....." + "x......x..x.x...",
        snare:      "........X.....x." + "........X.....x.",
        hat_closed: "x.x.x.t.x.x.x.t." + "x.x.x.t.x.x.tttt",
        hat_open:   "......x........." + "......x........."
      }
    },
    {
      id: "drill-slide", name: "Slide", genre: "drill", bpm: [140, 145], bars: 2,
      tags: ["808 slides", "sparse", "kick on 1 only"],
      pads: {
        kick:       "x..............." + "x...............",
        "808":      "x......x..x...x." + "x.....x...x..x..",
        snare:      "........X.....x." + "........X.......",
        clap:       "........x......." + "........x.......",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x4"
      }
    },
    {
      id: "drill-double-snare", name: "Double Snare", genre: "drill", bpm: [140, 146], bars: 1,
      tags: ["syncopated", "ghost snare"],
      pads: {
        kick:       "x......x..x.....",
        "808":      "x......x..x.....",
        snare:      "........X...o.x.",
        clap:       "........x.......",
        hat_closed: "x.x.x.x.x.x.x.x3"
      }
    },
    {
      id: "drill-brooklyn", name: "Brooklyn", genre: "drill", bpm: [140, 146], bars: 2,
      tags: ["ny", "808 bounce", "claps"],
      pads: {
        kick:       "x.........x....." + "x.........x.....",
        "808":      "x......x..x....." + "x......x..x...x.",
        snare:      "........X....X.." + "........X....X..",
        clap:       "........x......." + "........x.......",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.3.3.",
        hat_open:   "..............x." + "..............x.",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "drill-lo-key", name: "Lo Key", genre: "drill", bpm: [138, 142], bars: 2,
      tags: ["minimal", "dark", "uk"],
      pads: {
        kick:       "x..............." + "x......x........",
        "808":      "x......x..x....." + "x......x..x.....",
        snare:      "........X.....x." + "........X.......",
        hat_closed: "x...x...x...x..." + "x...x...x...x.t.",
        hat_open:   "......x........." + "......x........."
      }
    },
    {
      id: "drill-chi", name: "Chi Drill", genre: "drill", bpm: [140, 146], bars: 2,
      tags: ["chicago", "classic", "rolls"],
      pads: {
        kick:       "x.........x....." + "x......x..x.....",
        "808":      "x.........x....." + "x......x..x.....",
        snare:      "........X......." + "........X.......",
        clap:       "........x......." + "........x.......",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.33"
      }
    },

    // ---------------------------------------------------------------- JERSEY
    {
      id: "jersey-bounce", name: "Jersey Bounce", genre: "jersey", bpm: [135, 142], bars: 1,
      tags: ["classic", "bounce", "bed squeak"],
      pads: {
        kick:       "x..x..x...x.x...",
        clap:       "....x.......x...",
        hat_closed: "..x...x...x...x.",
        perc:       "..........x.x..."
      }
    },
    {
      id: "jersey-triplet-kick", name: "Triplet Kick", genre: "jersey", bpm: [135, 145], bars: 2,
      tags: ["kick triplets", "bounce"],
      pads: {
        kick:       "x..x..x...x.x..." + "x..x..x...x.x.x.",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "..x...x...x...x." + "..x...x...x...x.",
        hat_open:   "..............x." + "................",
        perc:       "..........x.x.x." + "..........x.x.x.",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "jersey-chop-club", name: "Chop Club", genre: "jersey", bpm: [130, 140], bars: 2,
      tags: ["vocal", "club", "layered"],
      pads: {
        kick:       "x..x..x...x.x..." + "x..x..x...x...x.",
        snare:      "....x.......x..." + "....x.......x...",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "......x.......x." + "......x.......x.",
        perc:       "..........x.x..." + "..........x.x..."
      }
    },
    {
      id: "jersey-sped-up", name: "Sped Up", genre: "jersey", bpm: [140, 145], bars: 1,
      tags: ["fast", "3-3-2", "hype"],
      pads: {
        kick:       "x..x..x.x..x..x.",
        clap:       "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x.",
        perc:       "..........x.x...",
        fx:         "x..............."
      }
    },
    {
      id: "jersey-dark", name: "Dark Jersey", genre: "jersey", bpm: [132, 142], bars: 2,
      tags: ["dark", "808", "bounce"],
      pads: {
        kick:       "x..x..x...x.x..." + "x..x..x...x.x...",
        "808":      "x.........x....." + "x.....x...x.....",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "..x...x...x...x." + "..x...x...x...x.",
        perc:       "..........x.x..." + "..........x.x.x."
      }
    },
    {
      id: "jersey-breakdown", name: "Breakdown", genre: "jersey", bpm: [130, 142], bars: 2,
      tags: ["breakdown", "claps", "drop"],
      pads: {
        kick:       "................" + "x..x..x...x.x...",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "..x...x...x...x." + "................",
        perc:       "..........x.x..." + "..........x.x...",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "jersey-philly", name: "Philly Club", genre: "jersey", bpm: [130, 140], bars: 2,
      tags: ["philly", "club", "bounce"],
      pads: {
        kick:       "x..x..x.x..x..x." + "x..x..x...x.x.x.",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "..x...x...x...x." + "..x...x...x...x.",
        perc:       "..........x.x..." + "........x.x.x.x."
      }
    },
    {
      id: "jersey-rolls", name: "Jersey Rolls", genre: "jersey", bpm: [135, 145], bars: 2,
      tags: ["rolls", "hype", "fill"],
      pads: {
        kick:       "x..x..x...x.x..." + "x..x..x...x.x.44",
        snare:      "................" + "............2.44",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "..x...x...x...x." + "..x...x...x.....",
        perc:       "..........x.x..." + "..........x.x..."
      }
    },

    // ---------------------------------------------------------------- LOFI
    {
      id: "lofi-blue-hour", name: "Blue Hour", genre: "lofi", bpm: [75, 85], bars: 2,
      tags: ["sad", "dusty", "dilla"],
      pads: {
        kick:       "x......x..x....." + "x.....x...x..o..",
        snare:      "....X.......X..." + "....X.......X.o.",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.xo",
        hat_open:   "..............x." + "................",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "lofi-snowfall", name: "Snowfall", genre: "lofi", bpm: [70, 80], bars: 2,
      tags: ["slow", "sparse", "soft"],
      pads: {
        kick:       "x.........x....." + "x......o..x.....",
        snare:      "....X.......X..." + "....X.......X...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "lofi-drunk", name: "Drunk", genre: "lofi", bpm: [80, 90], bars: 2,
      tags: ["dilla", "swing", "ghost notes"],
      pads: {
        kick:       "x..o...x..x..o.." + "x.o....x..x.....",
        snare:      "....X..o....X..." + "....X.......X.o.",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "......x........." + "..............x.",
        perc:       "..o.......o....." + "..o.......o.....",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "lofi-sad-hours", name: "Sad Hours", genre: "lofi", bpm: [72, 82], bars: 2,
      tags: ["sad", "minimal", "soft clap"],
      pads: {
        kick:       "x.........x....." + "x.........x.....",
        snare:      "....x.......x..." + "....x.......x...",
        clap:       "....o.......o..." + "....o.......o...",
        hat_closed: "..x...x...x...x." + "..x...x...x...x.",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "lofi-bedroom", name: "Bedroom", genre: "lofi", bpm: [78, 88], bars: 1,
      tags: ["bedroom", "bouncy", "ghost hats"],
      pads: {
        kick:       "x..x......x.x...",
        snare:      "....X.......X...",
        hat_closed: "x.xox.xox.xox.xo",
        perc:       "..............x.",
        texture:    "x..............."
      }
    },
    {
      id: "lofi-rainy", name: "Rainy", genre: "lofi", bpm: [70, 78], bars: 2,
      tags: ["rain", "haze", "slow"],
      pads: {
        kick:       "x......x........" + "x......x..o.....",
        snare:      "....X.......X..." + "....X.......X...",
        hat_closed: "x...x...x...x..." + "x...x...x...x...",
        hat_open:   "..........x....." + "..........x.....",
        perc:       "......o.......o." + "......o.......o.",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "lofi-jazzhop", name: "Jazzhop", genre: "lofi", bpm: [82, 90], bars: 2,
      tags: ["jazz", "swing", "ride"],
      pads: {
        kick:       "x.....x...x....." + "x.....x...x...o.",
        snare:      "....X.......X..." + "....X.......X.o.",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "x.......x......." + "x.......x.......",
        perc:       "..o...o...o...o." + "..o...o...o...o.",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "lofi-tape-stop", name: "Tape Stop", genre: "lofi", bpm: [74, 84], bars: 2,
      tags: ["tape", "wobbly", "pickup"],
      pads: {
        kick:       "x.........x....." + "x.......x.x.....",
        snare:      "....X.......X..." + "....X.......X...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x...",
        fx:         "................" + "..............x.",
        texture:    "x..............." + "x..............."
      }
    },

    // ---------------------------------------------------------------- BOOMBAP
    {
      id: "boombap-classic", name: "Boom Bap", genre: "boombap", bpm: [88, 95], bars: 2,
      tags: ["classic", "90s", "8th hats"],
      pads: {
        kick:       "x......x..x....." + "x......x..x.....",
        snare:      "....X.......X..." + "....X.......X...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "..............x." + "..............x."
      }
    },
    {
      id: "boombap-premo", name: "Premo", genre: "boombap", bpm: [90, 98], bars: 2,
      tags: ["premier", "chops", "hard"],
      pads: {
        kick:       "x.........x..o.." + "x..o......x.....",
        snare:      "....X.......X..." + "....X.......X...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x."
      }
    },
    {
      id: "boombap-soul-swing", name: "Soul Swing", genre: "boombap", bpm: [88, 94], bars: 2,
      tags: ["pete rock", "swing", "soulful"],
      pads: {
        kick:       "x..o..x...x....." + "x.....x...x..o..",
        snare:      "....X.......X..." + "....X.......X.o.",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "......x........." + "......x........."
      }
    },
    {
      id: "boombap-dusty", name: "Dusty", genre: "boombap", bpm: [85, 92], bars: 2,
      tags: ["dusty", "lazy", "vinyl"],
      pads: {
        kick:       "x......x........" + "x......x..x.....",
        snare:      "....X.......X..." + "....X.......X...",
        hat_closed: "x...x...x...x..." + "x...x...x...x.x.",
        perc:       "..............x." + "..............x.",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "boombap-hard-hitter", name: "Hard Hitter", genre: "boombap", bpm: [90, 98], bars: 1,
      tags: ["hard", "heavy", "layered clap"],
      pads: {
        kick:       "x.o....x..x.o...",
        snare:      "....X.......X...",
        clap:       "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x.",
        hat_open:   "..............x."
      }
    },
    {
      id: "boombap-east-coast", name: "East Coast", genre: "boombap", bpm: [86, 94], bars: 2,
      tags: ["east coast", "bounce"],
      pads: {
        kick:       "x.........x.x..." + "x..x......x.....",
        snare:      "....X.......X..." + "....X.......X...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "..............x." + "......x........."
      }
    },
    {
      id: "boombap-triplet-bap", name: "Triplet Bap", genre: "boombap", bpm: [88, 96], bars: 2,
      tags: ["swing", "ghost kicks", "dilla"],
      pads: {
        kick:       "x.....x...x.o..." + "x.....x..ox.....",
        snare:      "....X.......X..." + "....X..o....X...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x."
      }
    },
    {
      id: "boombap-loud-pack", name: "Loud Pack", genre: "boombap", bpm: [90, 96], bars: 2,
      tags: ["loud", "stomp", "fill"],
      pads: {
        kick:       "x.......x......." + "x.......x.....x.",
        snare:      "....X.......X..." + "....X.......X...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.xxxx"
      }
    },

    // ---------------------------------------------------------------- HOUSE
    {
      id: "house-classic", name: "Classic House", genre: "house", bpm: [122, 126], bars: 1,
      tags: ["4x4", "classic", "shaker"],
      pads: {
        kick:       "x...x...x...x...",
        clap:       "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x.",
        hat_open:   "..x...x...x...x.",
        perc:       "x.xxx.xxx.xxx.xx"
      }
    },
    {
      id: "house-deep", name: "Deep House", genre: "house", bpm: [120, 124], bars: 2,
      tags: ["deep", "smooth", "ghost hats"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x...",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "xoxoxoxoxoxoxoxo" + "xoxoxoxoxoxoxoxo",
        hat_open:   "..x...x...x...x." + "..x...x...x...x.",
        perc:       "...x......x....." + "...x......x..x.."
      }
    },
    {
      id: "house-tech", name: "Tech House", genre: "house", bpm: [124, 128], bars: 2,
      tags: ["tech house", "groove", "toms"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x...",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "..x...x...x...x." + "..x...x...x...x.",
        perc:       "..x..x..x..x..x." + "..x..x..x..x..x.",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "house-french", name: "French Touch", genre: "house", bpm: [120, 126], bars: 2,
      tags: ["french", "filter", "disco"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x...",
        snare:      "....x.......x..." + "....x.......x...",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "..x...x...x...x." + "..x...x...x...x.",
        perc:       "x.xxx.xxx.xxx.xx" + "x.xxx.xxx.xxx.xx",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "house-ukg-shuffle", name: "UKG Shuffle", genre: "house", bpm: [126, 128], bars: 2,
      tags: ["garage", "2-step", "shuffle"],
      pads: {
        kick:       "x.........x....." + "x......x..x.....",
        snare:      "....x.......x..." + "....x.......x...",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.xxx.x.x.",
        hat_open:   "..x...x...x...x." + "..x...x...x.....",
        perc:       "...x..x....x..x." + "...x..x....x..x."
      }
    },
    {
      id: "house-jackin", name: "Jackin", genre: "house", bpm: [124, 128], bars: 1,
      tags: ["jackin", "chicago", "rim"],
      pads: {
        kick:       "x...x...x...x...",
        clap:       "....x.......x...",
        hat_closed: "x.xxx.xxx.xxx.xx",
        hat_open:   "..x...x...x...x.",
        perc:       "...x...x..x...x.",
        fx:         "x..............."
      }
    },
    {
      id: "house-afro", name: "Afro House", genre: "house", bpm: [120, 124], bars: 2,
      tags: ["afro", "percussive", "conga"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x...",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "..x...x...x...x." + "..x...x...x...x.",
        hat_open:   "......x.......x." + "......x.......x.",
        perc:       "x..x..x.x..x..x." + "x..x..x.x..xx.x."
      }
    },
    {
      id: "house-lofi", name: "Lo-fi House", genre: "house", bpm: [120, 124], bars: 2,
      tags: ["lofi", "dusty", "4x4"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x...",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "..x...x...x...x." + "..x...x...x.....",
        perc:       "..o...o...o...o." + "..o...o...o...o.",
        texture:    "x..............." + "x..............."
      }
    },

    // ---------------------------------------------------------------- TECHNO
    {
      id: "techno-berlin", name: "Berlin", genre: "techno", bpm: [128, 135], bars: 1,
      tags: ["berlin", "rumble", "dark"],
      pads: {
        kick:       "x...x...x...x...",
        "808":      "..x...x...x...x.",
        hat_closed: "xxXxxxXxxxXxxxXx",
        hat_open:   "..x...x...x...x.",
        perc:       "......x........."
      }
    },
    {
      id: "techno-industrial", name: "Industrial", genre: "techno", bpm: [135, 140], bars: 2,
      tags: ["industrial", "hard", "distorted"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x.x.",
        "808":      ".x.x.x.x.x.x.x.x" + ".x.x.x.x.x.x.x.x",
        clap:       "....X.......X..." + "....X.......X...",
        hat_closed: "xxxxxxxxxxxxxxxx" + "xxxxxxxxxxxx2222",
        hat_open:   "..x...x...x...x." + "..x...x...x...x.",
        perc:       "...x......x....." + "...x......x..x..",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "techno-minimal", name: "Minimal", genre: "techno", bpm: [125, 130], bars: 2,
      tags: ["minimal", "dub", "sparse"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x...",
        "808":      "..x.......x....." + "..x.......x.....",
        clap:       "....o.......o..." + "....o.......o...",
        hat_closed: "..x...x...x...x." + "..x...x...x...x.",
        hat_open:   "......x........." + "......x.......x.",
        perc:       "...o..o....o.o.." + "...o..o....o...."
      }
    },
    {
      id: "techno-acid", name: "Acid", genre: "techno", bpm: [130, 138], bars: 1,
      tags: ["acid", "303", "driving"],
      pads: {
        kick:       "x...x...x...x...",
        "808":      ".x.x.x.x.x.x.x.x",
        clap:       "....x.......x...",
        hat_closed: "XxxxXxxxXxxxXxxx",
        hat_open:   "..x...x...x...x.",
        fx:         "x..............."
      }
    },
    {
      id: "techno-detroit", name: "Detroit", genre: "techno", bpm: [128, 134], bars: 2,
      tags: ["detroit", "909", "swing"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x...",
        snare:      "......o.......o." + "......o.......o.",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "..x...x...x...x." + "..x...x...x...x.",
        perc:       "..x..x..x..x..x." + "..x..x..x..x..x."
      }
    },
    {
      id: "techno-hypnotic", name: "Hypnotic", genre: "techno", bpm: [130, 136], bars: 2,
      tags: ["hypnotic", "loop", "rolling"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x...",
        "808":      "..x...x...x...x." + "..x...x...x...x.",
        hat_closed: "xoxoxoxoxoxoxoxo" + "xoxoxoxoxoxoxoxo",
        hat_open:   "..x...x...x...x." + "..x...x...x...x.",
        perc:       ".x..x..x..x..x.." + ".x..x..x..x..x.."
      }
    },
    {
      id: "techno-hard", name: "Hard Techno", genre: "techno", bpm: [136, 140], bars: 2,
      tags: ["hard", "schranz", "fast"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x.x.",
        "808":      ".x.x.x.x.x.x.x.x" + ".x.x.x.x.x.x.x.x",
        clap:       "....X.......X..." + "....X.......X..X",
        hat_closed: "XxxxXxxxXxxxXxxx" + "XxxxXxxxXxxx4444",
        hat_open:   "..x...x...x...x." + "..x...x...x...x.",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "techno-dub", name: "Dub Techno", genre: "techno", bpm: [125, 130], bars: 2,
      tags: ["dub", "deep", "haze"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x...",
        "808":      "......x.......x." + "......x.......x.",
        snare:      "....o.......o..." + "....o.......o...",
        hat_closed: "..x...x...x...x." + "..x...x...x...x.",
        hat_open:   "..........x....." + "..........x.....",
        perc:       "...o.....o....o." + "...o.....o......",
        texture:    "x..............." + "x..............."
      }
    },

    // ---------------------------------------------------------------- CRYSTAL
    {
      id: "crystal-alice", name: "Alice Practice", genre: "crystal", bpm: [125, 135], bars: 2,
      tags: ["crystal castles", "8-bit", "4x4", "harsh"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x.x.",
        snare:      "....X.......X..." + "....X.......X...",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "XxxxXxxxXxxxXxxx" + "XxxxXxxxXxxx2222",
        hat_open:   "..x...x...x...x." + "..x...x...x...x.",
        perc:       "x.xx.x.xx.xx.x.x" + "x.xx.x.xx.xx.xxx",
        fx:         "x..............." + "........x.......",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "crystal-courtship", name: "Courtship", genre: "crystal", bpm: [115, 125], bars: 2,
      tags: ["crystal castles", "broken", "sad"],
      pads: {
        kick:       "x.....x...x....." + "x.....x.x.x.....",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "......x........." + "......x.......x.",
        perc:       ".x.x.x.x.x.x.x.x" + ".x.x.x.x.x.x.xxx",
        fx:         "x..............." + "................",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "crystal-vanished", name: "Vanished", genre: "crystal", bpm: [118, 128], bars: 2,
      tags: ["crystal castles", "electro", "bouncy"],
      pads: {
        kick:       "x..x....x..x...." + "x..x....x..x..x.",
        snare:      "....x.......x..." + "....x.......x...",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "x.xxx.xxx.xxx.xx" + "x.xxx.xxx.xxx.xx",
        hat_open:   "..x...x...x...x." + "..x...x...x...x.",
        perc:       "x...x.x.x...x.x." + "x...x.x.x...x.x.",
        fx:         "x..............." + "................",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "crystal-chiptune", name: "Chiptune", genre: "crystal", bpm: [130, 140], bars: 1,
      tags: ["chip", "8-bit", "fast", "arp"],
      pads: {
        kick:       "x...x...x...x...",
        snare:      "....X.......X...",
        clap:       "....x.......x...",
        hat_closed: "xxxxxxxxxxxxxxxx",
        hat_open:   "..x...x...x...x.",
        perc:       "xxx.xxx.xxx.xxx.",
        fx:         "x...............",
        texture:    "x..............."
      }
    },
    {
      id: "crystal-witch", name: "Witch House", genre: "crystal", bpm: [110, 120], bars: 2,
      tags: ["witch house", "slow", "dark"],
      pads: {
        kick:       "x.........x....." + "x......x..x.....",
        "808":      "x.........x....." + "x......x..x.....",
        snare:      "....X.......X..." + "....X.......X...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x3",
        hat_open:   "..............x." + "..............x.",
        fx:         "x..............." + "................",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "crystal-glitch", name: "Glitch", genre: "crystal", bpm: [120, 135], bars: 2,
      tags: ["glitch", "broken", "rolls"],
      pads: {
        kick:       "x...x..x..x..x.." + "x...x..x..x.4...",
        clap:       "....x.......x..." + "....x.......x.33",
        hat_closed: "x2x2x2x2x2x2x2x2" + "x2x2x2x24444x2x2",
        hat_open:   "..x...x...x...x." + "..x...x...x...x.",
        perc:       "..x.x..x.x..x.x." + "..x.x..x.x..x.xx",
        fx:         "x..............." + "..............x.",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "crystal-electro-stomp", name: "Electro Stomp", genre: "crystal", bpm: [125, 135], bars: 2,
      tags: ["electro", "stomp", "4x4"],
      pads: {
        kick:       "x...x...x...x..." + "x...x...x...x...",
        "808":      "x.......x......." + "x.......x.......",
        clap:       "....X.......X..." + "....X.......X...",
        hat_closed: "..x...x...x...x." + "..x...x...x...x.",
        hat_open:   "......x.......x." + "......x.........",
        perc:       "x.x..x.x.x.x..x." + "x.x..x.x.x.x..x.",
        texture:    "x..............." + "x..............."
      }
    },
    {
      id: "crystal-crimewave", name: "Crimewave", genre: "crystal", bpm: [120, 130], bars: 2,
      tags: ["crystal castles", "haze", "dreamy"],
      pads: {
        kick:       "x.......x......." + "x.......x..x....",
        snare:      "....x.......x..." + "....x.......x...",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        perc:       "..x.....x.....x." + "..x.....x.....x.",
        fx:         "x..............." + "................",
        texture:    "x..............." + "x..............."
      }
    },

    // ---------------------------------------------------------------- DNB
    {
      id: "dnb-two-step", name: "Two Step", genre: "dnb", bpm: [172, 176], bars: 2,
      tags: ["two-step", "clean"],
      pads: {
        kick:       "x.........x....." + "x.........x.....",
        snare:      "....X.......X..." + "....X.......X...",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "..............x." + "................"
      }
    },
    {
      id: "dnb-amen", name: "Amen", genre: "dnb", bpm: [170, 176], bars: 2,
      tags: ["amen", "break", "jungle"],
      pads: {
        kick:       "x.x.......x....." + "x.x.....x.x.....",
        snare:      "....X..o.o..X..o" + "....X..o.oX...X.",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "..............x." + "......x........."
      }
    },
    {
      id: "dnb-liquid", name: "Liquid", genre: "dnb", bpm: [172, 176], bars: 2,
      tags: ["liquid", "smooth", "ghost snare"],
      pads: {
        kick:       "x.........x....." + "x.........x...x.",
        snare:      "....X.......X..." + "....X..o....X.o.",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "..............x." + "..............x.",
        perc:       "..x...x...x...x." + "..x...x...x...x."
      }
    },
    {
      id: "dnb-neuro", name: "Neuro", genre: "dnb", bpm: [172, 176], bars: 2,
      tags: ["neuro", "heavy", "tech"],
      pads: {
        kick:       "x.........x....." + "x......x..x.....",
        "808":      "x.........x....." + "x......x..x.....",
        snare:      "....X.......X..." + "....X.......X...",
        clap:       "....x.......x..." + "....x.......x...",
        hat_closed: "x.xxx.xxx.xxx.xx" + "x.xxx.xxx.xx2222",
        hat_open:   "..............x." + "..............x.",
        perc:       "......x.......x." + "......x.......x.",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "dnb-jump-up", name: "Jump Up", genre: "dnb", bpm: [172, 176], bars: 1,
      tags: ["jump up", "bouncy"],
      pads: {
        kick:       "x.........x.....",
        snare:      "....X.......X...",
        clap:       "....x.......x...",
        hat_closed: "x.x.x.x.x.x.x.x.",
        hat_open:   "..x.......x.....",
        fx:         "x..............."
      }
    },
    {
      id: "dnb-jungle", name: "Jungle", genre: "dnb", bpm: [170, 174], bars: 2,
      tags: ["jungle", "chopped", "rolls"],
      pads: {
        kick:       "x.x.......x....." + "x.x......x.x....",
        snare:      "....X..o.o..X..o" + "....X..o.oX.X.44",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "......x........." + "..............x.",
        fx:         "x..............." + "................"
      }
    },
    {
      id: "dnb-halftime", name: "Halftime", genre: "dnb", bpm: [170, 176], bars: 2,
      tags: ["halftime", "heavy", "bass"],
      pads: {
        kick:       "x.........x....." + "x.....x...x.....",
        "808":      "x.........x....." + "x.....x...x..x..",
        snare:      "........X......." + "........X.......",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x3",
        hat_open:   "..............x." + "..............x."
      }
    },
    {
      id: "dnb-techstep", name: "Techstep", genre: "dnb", bpm: [172, 176], bars: 2,
      tags: ["techstep", "dark", "two-step"],
      pads: {
        kick:       "x.........x....." + "x..x......x.....",
        snare:      "....X.......X..." + "....X.......X.o.",
        hat_closed: "x.x.x.x.x.x.x.x." + "x.x.x.x.x.x.x.x.",
        hat_open:   "..............x." + "......x.........",
        perc:       ".x.....x.x.....x" + ".x.....x.x.....x"
      }
    }
  ];

  if (typeof window !== "undefined") window.KillDrumGrooves = GROOVES;
  if (typeof module !== "undefined" && module.exports) module.exports = GROOVES;
})();
