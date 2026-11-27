/* KILLDRUM RHYTHMS: the rhythm brain (Eman, 8 Nov 2026).
   A rhythm is a world, not exact hits: "four on the floor", "boom bap", "dembow"... Every dice result is
   one of these (classify), a rhythm can be pressed (shape: the sounds stay, the patterns move into that
   rhythm), locked (every roll stays in it), and the EXPERIMENTAL amount warps it: 0 = the skeleton,
   middle = real-song variants of it, high = two rhythms mixed, max = glitch (drops, stutters, off-grid).
   The learned side (rhythm-brain-data.json, built by scripts/killdrum/rhythm_brain/build.py from the
   Lakh clean MIDI set + Magenta's Groove MIDI Dataset) adds, per rhythm, the real kick/snare variants,
   tempos, artists and genres. Without the file the skeletons alone work.
   window.KillDrumRhythms in the browser, module.exports in node (pure, no DOM). */
(function () {
  "use strict";

  // k = kick, s = snare (clap follows it), h = hats (X = open hat), b = 808 / bass line when it is not the kick,
  // p = perc. 16 chars per bar (grid 16) or 12 (grid 12 = triplet feel: 3 per beat). "X" = the hits that make
  // the rhythm, "x" = usual, "." = free. 2-bar rhythms have 32 chars. bpm = where it lives; "half" = the snare
  // sits on 3 (half-time). moods / genres / famous feed the suggestions and the tab's text.
  var RHYTHMS = [
    // ------------------------------------------------------------------ PULSE
    { id: "four", name: "Four on the floor", group: "pulse", k: "X...X...X...X...", s: "....X.......X...", h: "x.X.x.X.x.X.x.X.",
      bpm: [118, 135], genres: ["house", "techno", "disco", "edm", "electroclash", "trance", "french house"], moods: ["driving", "euphoric", "club", "hypnotic"],
      famous: ["Daft Punk", "Donna Summer", "Crystal Castles", "Charli XCX"], about: "Kick on every beat, clap on 2 and 4, open hat in between." },
    { id: "backbeat", name: "Backbeat", group: "pulse", k: "X.......X.x.....", s: "....X.......X...", h: "x.x.x.x.x.x.x.x.",
      bpm: [90, 160], genres: ["rock", "pop", "indie", "pop punk", "country", "grunge", "alt rock"], moods: ["steady", "anthemic", "live"],
      famous: ["AC/DC", "Nirvana", "The Strokes", "Taylor Swift"], about: "Kick on 1 and 3, snare on 2 and 4. The rock beat." },
    { id: "halftime", name: "Half-time", group: "pulse", k: "X.........x.....", s: "........X.......", h: "x.x.x.x.x.x.x.x.", half: true,
      bpm: [60, 100], alt: [130, 150], genres: ["dubstep", "phonk", "rock ballad", "trip hop", "future bass", "nu metal"], moods: ["heavy", "slow", "wide", "cinematic"],
      famous: ["Skrillex", "Deftones", "Massive Attack", "Flume"], about: "The snare only on 3: everything feels twice as slow and twice as big." },
    { id: "foursnare", name: "Four on the snare", group: "pulse", k: "X...X...X...X...", s: "X...X...X...X...", h: "x.x.x.x.x.x.x.x.",
      bpm: [110, 135], genres: ["motown", "northern soul", "60s pop", "indie pop", "glam"], moods: ["joyful", "stomping", "retro"],
      famous: ["The Supremes", "Arctic Monkeys", "Marvin Gaye", "Franz Ferdinand"], about: "Snare on every beat with the kick. Motown stomp." },
    { id: "motorik", name: "Motorik", group: "pulse", k: "X.x...x.X.x...x.", s: "....X.......X...", h: "x.x.x.x.x.x.x.x.",
      bpm: [120, 150], genres: ["krautrock", "post punk", "indie", "shoegaze", "kraut"], moods: ["hypnotic", "endless", "cold", "motor"],
      famous: ["Neu!", "Stereolab", "LCD Soundsystem", "Can"], about: "Straight eighth-note kick that never stops. The autobahn beat." },
    { id: "punk", name: "Punk / d-beat", group: "pulse", k: "X.x.X.x.X.x.X.x.", s: "..X...X...X...X.", h: "x.x.x.x.x.x.x.x.",
      bpm: [160, 220], genres: ["punk", "hardcore", "d-beat", "thrash", "crust", "skate punk"], moods: ["angry", "fast", "raw"],
      famous: ["Discharge", "Ramones", "Bad Brains", "Turnstile"], about: "Kick and snare trading on every eighth. Fast and raw." },
    { id: "blast", name: "Blast beat", group: "pulse", k: "x.x.x.x.x.x.x.x.", s: ".x.x.x.x.x.x.x.x", h: "x.x.x.x.x.x.x.x.",
      bpm: [180, 280], genres: ["grindcore", "black metal", "death metal", "breakcore", "noise"], moods: ["extreme", "wall", "chaos"],
      famous: ["Napalm Death", "Mayhem", "Converge", "Venetian Snares"], about: "Kick and snare alternating on every sixteenth. A wall." },
    { id: "train", name: "Train beat", group: "pulse", k: "X...X...X...X...", s: "x.xXx.xXx.xXx.xX", h: "x.x.x.x.x.x.x.x.",
      bpm: [130, 200], genres: ["country", "rockabilly", "bluegrass", "americana", "surf"], moods: ["rolling", "chugging", "road"],
      famous: ["Johnny Cash", "Stray Cats", "Dick Dale"], about: "Snare chugging on every eighth with an accent on the off-beats. The train." },

    // ------------------------------------------------------------------ HIP-HOP & CLUB
    { id: "boombap", name: "Boom bap", group: "club", k: "X.....x...x.x...", s: "....X.......X...", h: "x.x.x.x.x.x.x.x.", swing: 0.55,
      bpm: [85, 100], genres: ["hip hop", "boom bap", "90s rap", "east coast", "jazz rap", "trip hop"], moods: ["dusty", "head nod", "street", "golden"],
      famous: ["DJ Premier", "Nas", "MF DOOM", "J Dilla"], about: "Boom (kick) bap (snare): the kick chops around a hard 2 and 4." },
    { id: "lofi", name: "Lo-fi", group: "club", k: "X......x..X.....", s: "....X.......X...", h: "x.x.x.x.x.x.x.x.", swing: 0.62, ghost: 0.7,
      bpm: [65, 90], genres: ["lofi", "chillhop", "lo-fi hip hop", "trip hop", "neo soul", "bedroom"], moods: ["lazy", "rainy", "late", "warm", "sad"],
      famous: ["J Dilla", "Nujabes", "Knxwledge", "Jinsang"], about: "Boom bap that is late and lazy, with ghost snares and dust." },
    { id: "trap", name: "Trap", group: "club", bars: 2, k: "X.........x.....X.....x...x....x", s: "........X...............X.......", h: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.xxxx", half: true,
      bpm: [130, 170], genres: ["trap", "rage", "cloud rap", "plugg", "phonk", "southern rap", "hyperpop"], moods: ["dark", "bouncy", "codeine", "hard", "villain"],
      famous: ["Metro Boomin", "Travis Scott", "Future", "Playboi Carti"], about: "Snare on 3, the 808 bounces around the kick, hats roll. The 808 is the kick." },
    { id: "drill", name: "Drill", group: "club", k: "X..x..x...x.....", s: "........X.....x.", h: "x.x.x.x.x..xx.x.", half: true,
      bpm: [138, 146], genres: ["uk drill", "ny drill", "brooklyn drill", "chicago drill", "drill"], moods: ["cold", "sliding", "menace", "night"],
      famous: ["Pop Smoke", "Central Cee", "Headie One", "Chief Keef"], about: "3-3-2 kick bounce, snare on 3 with a late pickup, sliding 808s, skippy hats." },
    { id: "jersey", name: "Jersey club", group: "club", k: "X..X..X.X.X.....", s: "....X.......X...", h: "x.x.x.x.x.x.x.x.", p: "......x.x.x.....",
      bpm: [130, 145], genres: ["jersey club", "baltimore club", "philly club", "club"], moods: ["bouncy", "sweaty", "squeak", "party"],
      famous: ["UNIIQU3", "Cookiee Kawaii", "Drake (Sticky)", "DJ Sliink"], about: "The five-kick stutter: 1, 1-a, 2-and, 3, 3-and. Bed squeaks on top." },
    { id: "footwork", name: "Footwork", group: "club", k: "X..X..X.X..X..X.", s: "....X.......X...", h: ".x.x.x.x.x.x.x.x",
      bpm: [155, 165], genres: ["footwork", "juke", "ghetto house", "jungle"], moods: ["frantic", "triplet", "battle"],
      famous: ["RP Boo", "DJ Rashad", "Jlin", "Machinedrum"], about: "Tresillo kicks doubled up at 160, clap and vocal chops stuttering." },
    { id: "twostep", name: "2-step garage", group: "club", k: "X.........X.....", s: "....X.......X...", h: "x.X.x.x.x.X.x.x.", swing: 0.6,
      bpm: [128, 140], genres: ["uk garage", "2-step", "speed garage", "future garage", "bassline", "garage"], moods: ["skippy", "night bus", "swung", "london"],
      famous: ["MJ Cole", "Burial", "Craig David", "PinkPantheress"], about: "Kick on 1 and the and-of-3, swung hats, snare on 2 and 4. Skippy." },
    { id: "dnb", name: "Drum & bass", group: "club", k: "X.........X.....", s: "....X.......X...", h: "x.x.x.x.x.x.x.x.",
      bpm: [165, 178], genres: ["drum and bass", "dnb", "liquid", "neurofunk", "jungle", "jump up"], moods: ["rolling", "rush", "liquid", "fast"],
      famous: ["Goldie", "Pendulum", "Chase & Status", "Calibre"], about: "Two-step at 170: kick on 1 and the and-of-3, the snare on 2 and 4 drives it." },
    { id: "breakbeat", name: "Breakbeat", group: "breaks", k: "X.x......xx.....", s: "....X..x..x.X..x", h: "x.x.x.x.x.x.x.x.",
      bpm: [95, 130], genres: ["breakbeat", "big beat", "funk", "hip hop", "breaks", "nu funk"], moods: ["funky", "syncopated", "loose", "sampled"],
      famous: ["Clyde Stubblefield", "The Chemical Brothers", "The Prodigy", "Fatboy Slim"], about: "The Funky Drummer: syncopated snares around a chopped kick." },
    { id: "amen", name: "Amen break", group: "breaks", bars: 2, k: "X.x.......x.x...X.x......x......", s: "....X..x.x..X..x....X..x.x....X.", h: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.",
      bpm: [160, 175], genres: ["jungle", "breakcore", "drum and bass", "hardcore", "idm"], moods: ["chopped", "wild", "rave", "jungle"],
      famous: ["The Winstons", "Squarepusher", "Aphex Twin", "Goldie"], about: "The most sampled bar on earth, two bars of it, chopped." },
    { id: "electro", name: "Electro", group: "club", k: "X.....x...X.....", s: "....X.......X...", h: "x.x.x.x.x.x.x.x.",
      bpm: [120, 140], genres: ["electro", "electroclash", "witch house", "8-bit", "synthpop", "miami bass", "freestyle"], moods: ["robotic", "glitchy", "cold", "neon"],
      famous: ["Afrika Bambaataa", "Crystal Castles", "HEALTH", "Kraftwerk"], about: "Broken kick (1, and-of-2, 3), clap on 2 and 4, machine hats." },
    { id: "offbeat", name: "Offbeat bass", group: "club", k: "X...X...X...X...", b: "..X...X...X...X.", s: "....X.......X...", h: "..x...x...x...x.",
      bpm: [138, 150], genres: ["psytrance", "hardstyle", "goa", "hard dance", "eurodance"], moods: ["galloping", "trance", "rave", "relentless"],
      famous: ["Infected Mushroom", "Headhunterz", "Astrix"], about: "Kick on the beat, the bass answering on every off-beat. The gallop." },

    // ------------------------------------------------------------------ MOOD GENRES (Eman, 15 Nov 2026): the rhythms
    // of the new KILLDRUM genres that had none of their own yet
    // OPIUM (24 Nov): the rage skeleton read from two tutorial shorts. 808 on the 8ths with 16th pickups, hats 8ths with 16th bursts.
    // The snare on 3 is the usual rage placement, not measured (the 808 hides the kick in the audio).
    { id: "opium", name: "Opium", group: "club", bars: 2, k: "X.xxx.x.X.x.xxx.X.x.xxx.X.x.x.x.", s: "........X...............X.......", h: "x.x.x.x.x.x.x.xxx.x.x.x.x.xxxxxx", half: true,
      bpm: [138, 150], genres: ["opium", "rage", "trap", "evil rage"], moods: ["dark", "evil", "hard", "rage"],
      famous: ["Playboi Carti", "Ken Carson", "Destroy Lonely"], about: "Rage 808 pattern: a blown-out 808 on every 8th note with 16th pickups, snare on 3, tiny bright hats bursting in 16ths." },
    { id: "memphis", name: "Memphis", group: "club", k: "X......x..X.....", s: "........X.......", h: "x.x.x.x.x.x.x.x.", p: "x..x..x...x.x...", half: true,
      bpm: [130, 160], genres: ["memphis rap", "memphis", "horrorcore", "phonk", "crunk"], moods: ["dark", "evil", "dusty", "chant", "villain"],
      famous: ["Three 6 Mafia", "DJ Paul", "Tommy Wright III", "Project Pat"], about: "Half-time Memphis bounce: kick on 1 and the a of 2, snare on 3, cowbell in a 3-3-2." },
    { id: "phonk", name: "Phonk", group: "club", k: "X.........X..x..", s: "........X.......", h: "x.x.x.x.x.x.x.x.", p: "x..x..x.x..x..x.", half: true,
      bpm: [130, 150], genres: ["phonk", "memphis phonk", "cowbell"], moods: ["dark", "dirty", "night", "villain"],
      famous: ["DJ Smokey", "Soudiere", "Kordhell", "Ghostface Playa"], about: "Trap half-time with the cowbell carrying the groove and a dirty 808 under the kick." },
    { id: "driftphonk", name: "Drift phonk", group: "club", k: "X...X...X...X...", s: "....X.......X...", h: "..x...x...x...x.", p: "x.xx.xx.x.xx.xx.",
      bpm: [120, 135], genres: ["drift phonk", "brazilian phonk", "phonk"], moods: ["hard", "fast", "drift", "blown out"],
      famous: ["Kordhell", "INTERWORLD", "PlayaPhonk", "DVRST"], about: "A straight pounding kick, clap on 2 and 4, the blown-out cowbell playing 16ths over it." },
    { id: "detroit", name: "Detroit", group: "club", k: "X..X....X.X..X..", s: "....X.......X..x", h: "x.x.x.x.x.x.x.x.",
      bpm: [96, 112], genres: ["detroit rap", "flint", "detroit"], moods: ["bouncy", "raw", "off-kilter", "street"],
      famous: ["BabyTron", "Sada Baby", "Babyface Ray", "Veeze"], about: "Bouncy off-kilter kicks against a skippy clap that pushes into the next bar." },
    { id: "plugg", name: "Plugg", group: "club", bars: 2, k: "X.........X.....X.....x.........", s: "........X...............X.......", h: "x...x...x...x...x...x...x...x...", half: true,
      bpm: [140, 160], genres: ["plugg", "pluggnb", "cloud rap", "trap"], moods: ["floaty", "sweet", "soft", "dreamy"],
      famous: ["MexikoDro", "StoopidXool", "Summrs", "Autumn!"], about: "Sparse half-time: soft kicks, a crisp clap on 3, quarter-note hats, lots of air." },
    { id: "jerk", name: "Jerk", group: "club", k: "X.....X...X.....", s: "....X.......X...", h: "x.x.x.x.x.x.x.x.",
      bpm: [150, 170], genres: ["jerk", "new jerk", "jerk rap"], moods: ["bouncy", "fast", "youth", "hyper"],
      famous: ["Xaviersobased", "Nettspend", "OsamaSon", "Lazer Dim 700"], about: "Fast and bouncy: clap on 2 and 4, kick hopping between them, the 808 on the kick." },
    { id: "bmore", name: "Baltimore club", group: "club", k: "X...X...X.X.X...", s: "....X.......X...", h: "x.x.x.x.x.x.x.x.", p: "x.x.x.xx..x.x...",
      bpm: [128, 135], genres: ["baltimore club", "bmore club", "club"], moods: ["bouncy", "party", "chopped", "raw"],
      famous: ["Rod Lee", "Blaqstarr", "DJ Booman", "TT The Artist"], about: "The Think break chopped up: four kicks with a run on 3, hard claps on 2 and 4." },
    { id: "gfunk", name: "G-funk", group: "club", k: "X......X..X.....", s: "....X.......X...", h: "x.x.x.x.x.x.x.x.", p: "..x...x...x...x.", swing: 0.55,
      bpm: [88, 100], genres: ["g-funk", "west coast", "gangsta rap"], moods: ["laid back", "sunny", "lean", "smooth"],
      famous: ["Dr. Dre", "Warren G", "Snoop Dogg", "DJ Quik"], about: "West coast lean: laid back kick, snappy clap on 2 and 4, a shaker on the offbeats." },
    { id: "hardtechno", name: "Hard techno", group: "pulse", k: "X...X...X...X...", b: ".xx..xx..xx..xx.", s: "....X.......X...", h: "x.X.x.X.x.X.x.X.",
      bpm: [145, 160], genres: ["hard techno", "industrial techno", "schranz", "rave"], moods: ["hard", "pounding", "dark", "rave"],
      famous: ["I Hate Models", "Sara Landry", "Charlie Sparks", "999999999"], about: "Four distorted kicks with the rumble rolling between them, open hats on the offbeats." },
    { id: "riddim", name: "Riddim", group: "breaks", grid: 12, k: "X.....x.....", s: "......X.....", b: "X..X..x..X..", h: "x..x..x..x..", half: true,
      bpm: [140, 150], genres: ["riddim", "dubstep", "brostep", "bass music"], moods: ["heavy", "brutal", "minimal", "wobble"],
      famous: ["Subtronics", "Svdden Death", "Excision", "Marauda"], about: "Half-time at 140 with the bass wobbling in triplets around a giant snare on 3." },

    // ------------------------------------------------------------------ WORLD
    { id: "tresillo", name: "Tresillo 3-3-2", group: "world", k: "X..X..X.X..X..X.", s: "....X.......X...", h: "x.x.x.x.x.x.x.x.",
      bpm: [90, 130], genres: ["pop", "afrobeats", "reggaeton", "latin pop", "trap", "afro pop", "dancehall"], moods: ["sway", "warm", "sunny", "pop"],
      famous: ["Ed Sheeran (Shape of You)", "Luis Fonsi (Despacito)", "Wizkid", "Rihanna"], about: "3 + 3 + 2: the kick that half of all pop since 2015 sits on." },
    { id: "dembow", name: "Dembow", group: "world", k: "X...X...X...X...", s: "...x..x....x..x.", h: "x.x.x.x.x.x.x.x.",
      bpm: [88, 100], genres: ["reggaeton", "dembow", "dancehall", "moombahton", "latin"], moods: ["perreo", "sway", "hot", "party"],
      famous: ["Daddy Yankee", "Bad Bunny", "Shabba Ranks", "Rosalia"], about: "Four kicks with the snare in a tresillo over them. Reggaeton." },
    { id: "baile", name: "Baile funk", group: "world", k: "X..x..x.X..x..x.", s: "....X..X....X.X.", h: "x.x.x.x.x.x.x.x.", p: "..x..x.x..x..x.x",
      bpm: [125, 150], alt: [85, 100], genres: ["baile funk", "funk carioca", "brazilian funk", "brazilian phonk", "favela"], moods: ["raw", "sweaty", "rio", "party"],
      famous: ["MC Fioti", "Anitta", "DJ Marlboro", "Tropkillaz"], about: "Tamborzao: tresillo kicks and a snare that answers them. Rio." },
    { id: "son", name: "Son clave 3-2", group: "world", bars: 2, k: "X.......x.......X.......x.......", s: "X.....X.....X.......X...X.......", h: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.", rim: true,
      bpm: [90, 140], genres: ["salsa", "son", "afro-cuban", "latin jazz", "mambo", "latin pop"], moods: ["dance", "cuban", "classic", "swing"],
      famous: ["Buena Vista Social Club", "Celia Cruz", "Tito Puente"], about: "The clave: three on one bar, two on the next. Everything Cuban hangs on it." },
    { id: "rumba", name: "Rumba clave 3-2", group: "world", bars: 2, k: "X.......x.......X.......x.......", s: "X.....X.......X.....X...X.......", h: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.", rim: true,
      bpm: [90, 140], genres: ["rumba", "afro-cuban", "guaguanco", "latin jazz", "afrobeat"], moods: ["deep", "ritual", "cuban"],
      famous: ["Los Munequitos de Matanzas", "Chano Pozo"], about: "Son clave with the third hit pushed late. Deeper, more Afro." },
    { id: "bossa", name: "Bossa nova", group: "world", bars: 2, k: "X.....x.X.....x.X.....x.X.....x.", s: "X.....X.....X.......X.....X.....", h: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.", rim: true,
      bpm: [110, 140], genres: ["bossa nova", "latin jazz", "lounge", "mpb", "jazz"], moods: ["smooth", "beach", "cool", "soft"],
      famous: ["Joao Gilberto", "Stan Getz", "Antonio Carlos Jobim"], about: "Soft kick on 1 and the and-of-2, the rim playing the bossa clave." },
    { id: "samba", name: "Samba", group: "world", k: "x...X...x...X...", s: "..X...X.X...X.X.", h: "xxxxxxxxxxxxxxxx", p: "x.xx.xx.x.xx.xx.",
      bpm: [95, 115], genres: ["samba", "batucada", "brazilian", "carnival", "samba rock"], moods: ["carnival", "rolling", "joy", "crowd"],
      famous: ["Mangueira", "Sergio Mendes", "Jorge Ben"], about: "Surdo pushing on 2 and 4, sixteenth shakers over everything. Carnival." },
    { id: "afrobeat", name: "Afrobeat", group: "world", k: "X.....x...X.....", s: "....X.......X...", h: "xxxxxxxxxxxxxxxx",
      bpm: [100, 130], genres: ["afrobeat", "afrobeats", "highlife", "afro funk", "afro pop", "afro house", "ska", "two tone"], moods: ["groove", "lagos", "warm", "endless"],
      famous: ["Fela Kuti", "Tony Allen", "Burna Boy", "Wizkid"], about: "Tony Allen: a kick that leans on the and-of-2, sixteenth hats, everything interlocking." },
    { id: "amapiano", name: "Amapiano", group: "world", k: "X.......X.......", b: "...x..x...x..x.x", s: "....X.......X...", h: "xxxxxxxxxxxxxxxx",
      bpm: [108, 116], genres: ["amapiano", "afro house", "gqom", "south african house", "afro tech"], moods: ["sunset", "log drum", "deep", "sway"],
      famous: ["Kabza De Small", "Tyla", "DJ Maphorisa", "Uncle Waffles"], about: "A sparse kick, the log drum doing the dancing, shakers everywhere." },
    { id: "onedrop", name: "Reggae one drop", group: "world", k: "........X.......", s: "........X.......", h: "x.x.x.x.x.x.x.x.", rim: true,
      bpm: [70, 90], genres: ["reggae", "roots", "dub", "lovers rock", "rocksteady"], moods: ["laid back", "island", "dub", "slow"],
      famous: ["Bob Marley", "Sly & Robbie", "King Tubby"], about: "Nothing on 1. Kick and rim together on 3, the skank on the off-beats." },
    { id: "cumbia", name: "Cumbia", group: "world", k: "X...X...X...X...", s: "..X...X...X...X.", h: "x.xxx.xxx.xxx.xx", p: "x.xxx.xxx.xxx.xx",
      bpm: [85, 110], genres: ["cumbia", "tropical", "chicha", "digital cumbia", "latin"], moods: ["sway", "tropical", "hypnotic"],
      famous: ["Los Angeles Azules", "Bomba Estereo", "Celso Pina"], about: "Caja on the off-beats, guacharaca scraping, kick on the beat. Sway." },
    { id: "habanera", name: "Habanera", group: "world", k: "X.....x.X...X...", s: "........X.......", h: "x.x.x.x.x.x.x.x.",
      bpm: [60, 120], genres: ["tango", "habanera", "latin ballad", "classical", "bolero"], moods: ["dramatic", "old", "noir", "theatrical"],
      famous: ["Bizet (Carmen)", "Astor Piazzolla", "Gotan Project"], about: "Dotted: long, short, medium, medium. Tango's grandmother." },
    { id: "bodiddley", name: "Bo Diddley", group: "world", k: "X..x..x...x.x...", s: "X..x..x...x.x...", h: "x.x.x.x.x.x.x.x.",
      bpm: [100, 150], genres: ["rock n roll", "garage rock", "blues rock", "rockabilly", "indie"], moods: ["shuffle", "stomp", "primal"],
      famous: ["Bo Diddley", "Buddy Holly (Not Fade Away)", "George Michael (Faith)", "The Strokes"], about: "The clave played by the whole kit. Shave and a haircut." },

    // ------------------------------------------------------------------ FEELS (triplet grid, 3 per beat)
    { id: "shuffle", name: "Shuffle", group: "feel", grid: 12, k: "X.....X.....", s: "...X.....X..", h: "X.xX.xX.xX.x", swing: 0.67,
      bpm: [80, 140], genres: ["blues", "rock n roll", "boogie", "shuffle", "half-time shuffle", "swing rock"], moods: ["bouncy", "bar", "triplet", "greasy"],
      famous: ["Stevie Ray Vaughan", "Toto (Rosanna)", "Led Zeppelin (Fool in the Rain)", "John Lee Hooker"], about: "Long-short triplets under a backbeat. Blues." },
    { id: "swing", name: "Jazz swing", group: "feel", grid: 12, k: "x...........", s: "...x........", h: "X..X.XX..X.X", swing: 0.67, ride: true, ghost: 0.5,
      bpm: [100, 260], genres: ["jazz", "bebop", "big band", "swing", "hard bop", "jazz rap"], moods: ["cool", "smoky", "loose", "night"],
      famous: ["Art Blakey", "Miles Davis", "Count Basie", "Robert Glasper"], about: "Ding ding-a ding on the ride, hat on 2 and 4, the kick feathered." },
    { id: "six8", name: "6/8", group: "feel", grid: 12, k: "X.....X.....", s: "...X.....X..", h: "xxxxxxxxxxxx",
      bpm: [50, 80], genres: ["6/8 ballad", "soul", "doom", "folk", "afro 6/8", "gospel", "doo wop"], moods: ["rolling", "hymn", "waves", "epic"],
      famous: ["The Animals (House of the Rising Sun)", "Leonard Cohen (Hallelujah)", "Queen (We Are the Champions)"], about: "Two big beats of three. Rolls like waves." }
  ];
  var GROUPS = [{ id: "pulse", name: "PULSE" }, { id: "club", name: "HIP-HOP & CLUB" }, { id: "breaks", name: "BREAKS" }, { id: "world", name: "WORLD" }, { id: "feel", name: "FEELS" }];
  // Jersey Club = Lil Uzi Vert "Just Wanna Rock" (Eman, 8 Nov 2026): the classic five-kick bounce 1, 2, 3, 3-a, 4-and
  // (16ths 1, 5, 9, 12, 15; gaps 4-4-3-3-2) at 150 BPM. The old skeleton (1, 1-a, 2-and, 3, 3-and) stays behind KD_JERSEY_OLD.
  if (!(typeof window !== "undefined" && window.KD_JERSEY_OLD)) RHYTHMS.forEach(function (r) {
    if (r.id !== "jersey") return;
    r.name = "Jersey Club"; r.k = "X...X...X..X..X."; r.p = "........x..x..x."; r.bpm = [135, 155];
    r.skel2 = { k: "X..X..X.X.X.....", p: "......x.x.x.....", chance: 0.35 };   // the old stutter still comes up on some rolls
    r.famous = ["Lil Uzi Vert (Just Wanna Rock)", "UNIIQU3", "DJ Sliink", "Bandmanrill"];
    r.about = "The five-kick bounce from Just Wanna Rock: 1, 2, 3, 3-a, 4-and. Clap on 2 and 4, bed squeaks on the last three kicks.";
  });
  var BY = {}; RHYTHMS.forEach(function (r) { BY[r.id] = r; r.bars = r.bars || 1; r.grid = r.grid || 16; });

  var DATA = { songs: 0, bars: 0, rhythms: {}, pairs: {} };
  function load(d) { if (d && d.rhythms) DATA = d; return DATA; }
  function data() { return DATA; }

  /* ---------- random ---------- */
  function fnv(str) { var h = 2166136261 >>> 0; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed) {
    var a = fnv(String(seed)) || 1;
    var f = function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.chance = function (p) { return f() < p; };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length)]; };
    f.weighted = function (items) { var tot = 0, i; for (i = 0; i < items.length; i++) tot += items[i][1]; var x = f() * tot; for (i = 0; i < items.length; i++) { x -= items[i][1]; if (x < 0) return items[i][0]; } return items[items.length - 1][0]; };
    return f;
  }

  /* ---------- masks: a bar as a 16-bit int, bit i = step i ---------- */
  function maskOf(steps, b) { var m = 0; for (var i = 0; i < 16; i++) { var s = steps[b * 16 + i]; if (s && s.v) m |= 1 << i; } return m; }
  function bits(m) { var n = 0; while (m) { n += m & 1; m >>>= 1; } return n; }
  // a rhythm's string for bar b as [mustMask, usualMask] on the 16 grid (12-grid rhythms land on the nearest 16th)
  function rowMasks(r, key, b) {
    var str = r[key] || "", must = 0, usual = 0, g = r.grid, per = g, i, p, step;
    b = b % r.bars;
    for (i = 0; i < per; i++) {
      var c = str[b * per + i]; if (!c || c === ".") continue;
      if (g === 12) { var beat = Math.floor(i / 3), sub = i % 3; step = beat * 4 + (sub === 0 ? 0 : sub === 1 ? 1 : 3); } else step = i;
      p = 1 << step;
      if (c === "X") must |= p; else usual |= p;
    }
    return [must, usual];
  }

  /* ---------- classify: which rhythm is this beat in? ---------- */
  // score a (kick, snare) bar against a rhythm (higher = closer). Must-hits weigh most, extra hits on free steps
  // cost a little, hits on the strong "wrong" steps (a snare on 1 in a backbeat rhythm) cost more.
  function scoreBar(r, kick, snare, b, sub, hats) {
    var km = rowMasks(r, "k", b), sm = rowMasks(r, "s", b), s = 0, i, p;
    var bm = r.b ? rowMasks(r, "b", b) : null, hm = r.h ? rowMasks(r, "h", b) : null;
    for (i = 0; i < 16; i++) {
      p = 1 << i;
      var kh = !!(kick & p), sh = !!(snare & p), w = (i % 4 === 0) ? 1.5 : (i % 2 === 0) ? 1.1 : 0.85;
      if (km[0] & p) s += kh ? 3.0 * w : -3.0 * w; else if (km[1] & p) s += kh ? 0.9 * w : -0.5 * w; else if (kh) s -= 0.6 * w;
      if (sm[0] & p) s += sh ? 3.4 * w : -3.4 * w; else if (sm[1] & p) s += sh ? 1.0 * w : -0.5 * w; else if (sh) s -= 0.9 * w;
      if (bm && sub != null) { var bh = !!(sub & p); if (bm[0] & p) s += bh ? 1.2 : -1.2; else if (bm[1] & p) s += bh ? 0.5 : -0.1; else if (bh) s -= 0.3; }
      if (hm && hats != null) { var hh = !!(hats & p); if (hm[0] & p) s += hh ? 0.45 : -0.45; else if (hm[1] & p) s += hh ? 0.2 : -0.12; else if (hh) s -= 0.1; }
    }
    return s;
  }
  function tempoFit(r, bpm) {
    if (!bpm) return 0;
    var f = function (lo, hi) { if (bpm >= lo && bpm <= hi) return 1; var d = bpm < lo ? lo - bpm : bpm - hi; return Math.max(0, 1 - d / 40); };
    var t = f(r.bpm[0], r.bpm[1]);
    if (r.alt) t = Math.max(t, f(r.alt[0], r.alt[1]));
    if (!r.half) t = Math.max(t, 0.75 * f(r.bpm[0] / 2, r.bpm[1] / 2), 0.75 * f(r.bpm[0] * 2, r.bpm[1] * 2));   // half / double time feels
    return t;
  }
  // pads = { kick: Step[], "808": Step[], snare: Step[], clap: Step[] ... }; opts.bpm; returns ranked [{ id, score }]
  function rank(pads, opts) {
    opts = opts || {};
    var kickS = pads.kick || [], subS = pads["808"] || [], snS = pads.snare || [], clS = pads.clap || [], hcS = pads.hat_closed || [], hoS = pads.hat_open || [];
    var n = Math.max(kickS.length, subS.length, snS.length, clS.length), bars = Math.max(1, Math.round(n / 16));
    var hasHats = hcS.some(function (x) { return x && x.v; }) || hoS.some(function (x) { return x && x.v; });
    var out = [];
    RHYTHMS.forEach(function (r) {
      var tot = 0, b, used = 0;
      for (b = 0; b < bars; b++) {
        var km = maskOf(kickS, b), sub = maskOf(subS, b);
        var kick = r.b ? km : (km || sub);   // the 808 stands in for the kick only when there is no kick (a rhythm with its own bass line scores the 808 on b)
        var sn = maskOf(snS, b) | maskOf(clS, b);
        if (!kick && !sn) continue;
        used++;
        var hm2 = hasHats ? (maskOf(hcS, b) | maskOf(hoS, b)) : null, sc = scoreBar(r, kick, sn, b, r.b ? sub : null, hm2);
        if (r.skel2) sc = Math.max(sc, scoreBar(Object.assign({}, r, r.skel2), kick, sn, b, r.b ? sub : null, hm2));   // either skeleton counts
        tot += sc;
      }
      tot = tot / (used || 1);
      var t = tempoFit(r, opts.bpm);
      // feel: a triplet rhythm (grid 12) wants hits off the straight grid (o = 1/3, 2/3) or a deep swing; a straight one does not
      var trip = opts.triplet != null ? +opts.triplet : tripletOf(pads);
      var feel = r.grid === 12 ? (trip >= 0.2 ? 4 : trip > 0.08 ? 1 : -3) : (trip >= 0.2 ? -3 : 0);
      out.push({ id: r.id, score: tot + 3 * t + feel, fit: tot, tempo: t });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }
  // how much of the beat sits on triplet positions (a step's o = 1/3 or 2/3) or a swung grid (opts.swing >= 0.6 counts as half)
  function tripletOf(pads) {
    var n = 0, t = 0;
    Object.keys(pads).forEach(function (k) { (pads[k] || []).forEach(function (s) { if (s && s.v) { n++; if (s.o && Math.abs(s.o - 0.5) > 0.1) t++; } }); });
    return n ? t / n : 0;
  }
  function classify(pads, opts) { var r = rank(pads, opts); return r.length ? r[0] : null; }

  /* ---------- shape: move a beat into a rhythm, keep the sounds ---------- */
  function off() { return { v: 0, r: 1 }; }
  function hit(v) { return { v: v, r: 1 }; }
  function emptySteps(bars) { var a = []; for (var i = 0; i < 16 * bars; i++) a.push(off()); return a; }
  function stepsFromString(str, grid, bars, vMust, vUsual, R, keepP) {
    var out = emptySteps(bars), per = grid, i, b;
    for (b = 0; b < bars; b++) for (i = 0; i < per; i++) {
      var c = str[(b * per + i) % str.length]; if (!c || c === ".") continue;
      if (c === "x" && R && !R.chance(keepP == null ? 0.78 : keepP)) continue;
      var step, o = 0;
      if (grid === 12) { var beat = Math.floor(i / 3), sub = i % 3; step = beat * 4 + (sub === 0 ? 0 : sub === 1 ? 1 : 2); o = sub === 1 ? 1 / 3 : sub === 2 ? 2 / 3 : 0; } else step = i;
      var st = hit(c === "X" ? vMust : vUsual); if (o) st.o = o;
      out[b * 16 + step] = st;
    }
    return out;
  }
  function stepsFromMask(mask, bars, v, barIdx) { var out = emptySteps(bars); for (var b = 0; b < bars; b++) { if (barIdx != null && b !== barIdx) continue; for (var i = 0; i < 16; i++) if (mask & (1 << i)) out[b * 16 + i] = hit(v); } return out; }
  function merge(a, b) { return a.map(function (s, i) { return (s && s.v) ? s : (b[i] || off()); }); }
  function pickVariant(r, R, bpm) {
    var d = DATA.rhythms && DATA.rhythms[r.id];
    if (!d || !d.variants || !d.variants.length) return null;
    var items = d.variants.map(function (v) { return [v, Math.sqrt(v[2] || 1)]; });
    return R.weighted(items);
  }
  // opts: { seed, bars, bpm, experimental (0..1), genre, locked: {slot: true}, pads: current pads (sounds' patterns to keep where possible), sub: true when the 808 carries the kick }
  function shape(id, opts) {
    opts = opts || {};
    var r = BY[id] || RHYTHMS[0], bars = Math.max(1, Math.min(8, opts.bars || r.bars)), xp = Math.max(0, Math.min(1, +opts.experimental || 0));
    var R = rng("shape:" + (opts.seed == null ? 1 : opts.seed) + ":" + id + ":" + bars + ":" + xp.toFixed(2));
    if (r.skel2 && R.chance(r.skel2.chance)) r = Object.assign({}, r, r.skel2, { skel2: null });   // a second skeleton of the same rhythm (Jersey Club: Uzi bounce or the old stutter)
    var cur = opts.pads || {}, locked = opts.locked || {}, out = {}, b, i;
    var info = { rhythm: r.id, mix: null, variant: false, glitch: false };
    // 1) kick + snare: skeleton, or a real-song variant when the slider is past the first quarter
    var kick, snare;
    var vari = xp >= 0.25 ? pickVariant(r, R, opts.bpm) : null;
    if (vari && R.chance(Math.min(1, (xp - 0.1) * 1.6))) {
      info.variant = true;
      kick = stepsFromMask(vari[0], bars, 112); snare = stepsFromMask(vari[1], bars, 118);
      // the must-hits of the rhythm always stay in (a variant is a way of playing it, not another rhythm)
      for (b = 0; b < bars; b++) { var km = rowMasks(r, "k", b)[0], sm = rowMasks(r, "s", b)[0]; for (i = 0; i < 16; i++) { if (km & (1 << i)) kick[b * 16 + i] = hit(120); if (sm & (1 << i)) snare[b * 16 + i] = hit(124); } }
      if (bars > 1 && R.chance(0.6)) { var v2 = pickVariant(r, R, opts.bpm); if (v2) { var lb = bars - 1; kick = merge(kick, stepsFromMask(v2[0], bars, 100, lb)); snare = merge(snare, stepsFromMask(v2[1], bars, 110, lb)); } }
    } else {
      kick = stepsFromString(r.k, r.grid, bars, 120, 104, R, 0.9 - xp * 0.4);
      snare = stepsFromString(r.s, r.grid, bars, 124, 100, R, 0.9 - xp * 0.4);
    }
    // 2) mixing in a second rhythm past the middle: some pads follow the other one
    if (xp >= 0.55) {
      var other = neighbour(r, R, opts.bpm);
      if (other) {
        info.mix = other.id;
        var ok = stepsFromString(other.k, other.grid, bars, 110, 96, R, 0.8), os = stepsFromString(other.s, other.grid, bars, 112, 96, R, 0.8);
        var how = R.pick(xp > 0.75 ? ["snare", "kick", "both", "alternate"] : ["snare", "kick", "lastbar"]);
        if (how === "kick") kick = ok; else if (how === "snare") snare = os; else if (how === "both" || how === "lastbar") { var fromBar = how === "both" ? 0 : bars - 1; for (i = fromBar * 16; i < bars * 16; i++) { if (bars === 1 && how === "lastbar" && i < 8) continue; kick[i] = ok[i]; snare[i] = os[i]; } }
        else for (b = 0; b < bars; b++) if (b % 2 === 1) for (i = 0; i < 16; i++) { kick[b * 16 + i] = ok[b * 16 + i]; snare[b * 16 + i] = os[b * 16 + i]; }
      }
    }
    var sub = opts.sub != null ? !!opts.sub : /^(trap|drill|rage|jersey)$/.test(baseG(opts.genre)) || r.id === "trap" || r.id === "drill";
    if (!locked.kick) out.kick = kick;
    if (!locked["808"]) {
      if (r.b) out["808"] = stepsFromString(r.b, r.grid, bars, 110, 96, R, 0.85);
      else if (sub) out["808"] = kick.map(function (s) { return s.v ? hit(s.v - 4) : off(); });
      else if (cur["808"] && cur["808"].some(function (s) { return s.v; })) out["808"] = kick.map(function (s, j) { return s.v && (j % 16 === 0 || R.chance(0.45)) ? hit(100) : off(); });
      else out["808"] = emptySteps(bars);
    }
    if (!locked.snare) out.snare = r.rim ? snare.map(function (s) { return s.v ? hit(84) : s; }) : snare;
    if (!locked.clap) {
      var clapPrimary = /^(house|techno|crystal|jersey)$/.test(baseG(opts.genre)) || r.id === "four" || r.id === "electro";
      if (clapPrimary) out.clap = snare.map(function (s) { return s.v ? hit(112) : off(); });
      else out.clap = snare.map(function (s, j) { return s.v && s.v >= 118 && (j % 16 === 4 || j % 16 === 12 || j % 16 === 8) && R.chance(0.5) ? hit(96) : off(); });
    }
    // 3) hats: the rhythm's own hats below the middle, the current (genre) hats above it
    var keepHats = xp >= 0.5 && cur.hat_closed && cur.hat_closed.some(function (s) { return s.v; });
    if (!locked.hat_closed && !keepHats) {
      var h = stepsFromString(r.h, r.grid, bars, 106, 92, null);
      out.hat_closed = h.map(function (s, j) { var c = r.h[(j % 16) % r.h.length]; return (r.grid === 16 && c === "X") ? off() : s; });
      if (r.grid === 12) out.hat_closed = h;
      if (!locked.hat_open) out.hat_open = r.grid === 16 ? h.map(function (s, j) { return r.h[j % 16] === "X" ? hit(100) : off(); }) : emptySteps(bars);
      if (r.ride) { out.hat_open = out.hat_closed; out.hat_closed = stepsFromString("...X.....X..", 12, bars, 96, 96, null); }
    }
    if (r.p && !locked.perc && (!cur.perc || !cur.perc.some(function (s) { return s.v; }) || xp < 0.5)) out.perc = stepsFromString(r.p, r.grid, bars, 100, 88, R, 0.85);
    // 4) the top of the slider: glitch. Drops, stutters (rolls), chance hits, off-grid pushes, a bar that jumps out and in
    if (xp > 0.8) {
      info.glitch = true;
      var amt = (xp - 0.8) * 5;   // 0..1
      Object.keys(out).forEach(function (slot) {
        var st = out[slot];
        for (i = 0; i < st.length; i++) {
          var s = st[i]; if (!s || !s.v) { if (R.chance(0.03 * amt) && /^(perc|hat_open|fx|texture|clap)$/.test(slot)) st[i] = hit(70 + Math.floor(R() * 40)); continue; }
          var z = R();
          if (z < 0.12 * amt) s.r = 2 + Math.floor(R() * 3);
          else if (z < 0.22 * amt) s.c = R.pick([0.75, 0.5, 0.5, 0.25]);
          else if (z < 0.30 * amt) s.o = R.pick([0.5, 1 / 3, 2 / 3]);
          else if (z < 0.36 * amt && (i % 16) % 4 !== 0) st[i] = off();
        }
        // jump out and in: a stretch goes silent (at most a beat and a half), then it all comes back
        if (amt > 0.4 && R.chance(0.35 * amt)) { var at = Math.floor(R() * (st.length - 6)) + 2, len = 2 + Math.floor(R() * 5); for (i = at; i < Math.min(st.length, at + len); i++) st[i] = off(); }
      });
      if (!locked.fx) { out.fx = emptySteps(bars); for (i = 0; i < out.fx.length; i++) if (R.chance(0.06 + 0.12 * amt)) out.fx[i] = hit(80 + Math.floor(R() * 40)); }
    }
    // swing hint for the tab
    info.swing = r.swing != null ? r.swing : 0;
    info.feel = r.grid === 12 ? "triplet" : (r.swing ? "swing" : "straight");
    return { pads: out, info: info };
  }
  // another rhythm to mix with: one that real songs put next to this one (DATA.pairs), else a neighbour by tempo
  function neighbour(r, R, bpm) {
    var pairs = DATA.pairs || {}, cands = [];
    RHYTHMS.forEach(function (o) {
      if (o.id === r.id) return;
      var c = (pairs[r.id + "|" + o.id] || 0) + (pairs[o.id + "|" + r.id] || 0);
      var w = 0.2 + Math.sqrt(c) + 1.5 * tempoFit(o, bpm);
      if (o.grid !== r.grid) w *= 0.35;
      cands.push([o, w]);
    });
    return cands.length ? R.weighted(cands) : null;
  }

  /* ---------- suggest: which rhythm fits what is already in the song? ---------- */
  // ctx: { bpm, genre (KILLDRUM genre id), words: [prompt / vibe words], onsets: 16-step mask of where the chords
  //       or melody hit in a bar, density: notes per bar, minor: true/false, has: { chords, melody, audio } }
  var GENRE_TO = { opium: ["opium", "trap", "halftime"], evilrage: ["opium", "halftime", "trap"], trap: ["trap", "halftime", "drill"], rage: ["trap", "halftime"], drill: ["drill", "trap"], jersey: ["jersey", "four", "baile"], lofi: ["lofi", "boombap"],
    boombap: ["boombap", "breakbeat", "lofi"], house: ["four", "twostep", "offbeat"], techno: ["four", "offbeat", "electro"], crystal: ["electro", "four", "punk"], dnb: ["dnb", "amen", "footwork"],
    // MOOD GENRES (15 Nov): the new genres' own rhythms, their signature one first
    memphis: ["memphis", "phonk", "trap"], phonk: ["phonk", "memphis", "trap"], detroit: ["detroit", "trap", "boombap"], sampledrill: ["drill", "trap"], horrorcore: ["memphis", "halftime", "boombap"],
    hardtechno: ["hardtechno", "four", "offbeat"], dubstep: ["halftime", "riddim", "breakbeat"], riddim: ["riddim", "halftime"], driftphonk: ["driftphonk", "phonk", "four"],
    darkwave: ["motorik", "backbeat", "electro"], hyperpop: ["trap", "footwork", "four"], digicore: ["trap", "plugg", "halftime"], glitchcore: ["footwork", "breakbeat", "trap"],
    plugg: ["plugg", "trap", "halftime"], pluggnb: ["plugg", "trap", "halftime"], cloudrap: ["halftime", "plugg", "trap"],
    bmore: ["bmore", "jersey", "breakbeat"], footwork: ["footwork", "jersey"], jerk: ["jerk", "trap", "jersey"], baile: ["baile", "tresillo"],
    reggaeton: ["dembow", "tresillo"], dembow: ["dembow", "tresillo", "baile"], afrobeats: ["afrobeat", "tresillo"], amapiano: ["amapiano", "offbeat"], rnb: ["halftime", "backbeat", "trap"],
    ukg: ["four", "twostep", "offbeat"], twostep: ["twostep", "offbeat"], basshouse: ["offbeat", "four"],
    jungle: ["amen", "breakbeat", "dnb"], breakbeat: ["breakbeat", "amen", "electro"], gfunk: ["gfunk", "boombap", "backbeat"], synthwave: ["backbeat", "four", "motorik"],
    darksynth: ["four", "backbeat", "motorik"], vaporwave: ["backbeat", "halftime", "lofi"], italo: ["four", "offbeat", "motorik"] };
  // a new genre borrows the 808 / clap rules of the older genre it grew from (KillDrumPatterns baseOf)
  function baseG(g) { try { var P = typeof window !== "undefined" && window.KillDrumPatterns; if (P && P.baseOf) return P.baseOf(g) || g; } catch (e) { /* none */ } return g || ""; }
  function suggest(ctx) {
    ctx = ctx || {};
    var words = (ctx.words || []).map(function (w) { return String(w).toLowerCase(); });
    var out = RHYTHMS.map(function (r) {
      var w = 1 + 3 * tempoFit(r, ctx.bpm);
      var gl = GENRE_TO[ctx.genre]; if (gl) { var gi = gl.indexOf(r.id); if (gi >= 0) w += 4 - gi; }
      // the underground / experimental scenes (research thread, 8 Nov): a word names a scene, the scene names its rhythms
      scenesFor(words).forEach(function (sc) { var k = sc.rhythms.indexOf(r.id); if (k >= 0) w += 5 - 1.5 * k; });
      words.forEach(function (word) {
        if (r.id === word || r.name.toLowerCase() === word) w += 6;
        r.genres.forEach(function (g) { if (g === word || (word.length > 3 && g.indexOf(word) >= 0)) w += 3; });
        r.moods.forEach(function (m) { if (m === word) w += 2; });
        r.famous.forEach(function (f) { if (f.toLowerCase().indexOf(word) >= 0 && word.length > 3) w += 3; });
      });
      // what the chords / melody already do: a beat whose hits land where the notes land
      if (ctx.onsets) {
        var km = rowMasks(r, "k", 0), both = km[0] | km[1] | rowMasks(r, "s", 0)[0], agree = bits(both & ctx.onsets), miss = bits(ctx.onsets & ~both);
        w += 0.6 * agree - 0.25 * miss;
        var syncop = bits(ctx.onsets & 0xAAAA) + bits(ctx.onsets & 0x4444);   // hits off the beat
        if (syncop >= 3 && /^(tresillo|dembow|baile|breakbeat|son|rumba|bossa|drill|footwork)$/.test(r.id)) w += 1.5;
      }
      if (ctx.density != null) { if (ctx.density > 12 && /^(halftime|trap|lofi|onedrop|six8)$/.test(r.id)) w += 1.2; if (ctx.density < 4 && /^(four|motorik|punk|dnb|footwork|amen)$/.test(r.id)) w += 1.0; }
      if (ctx.minor === true && /^(trap|drill|halftime|lofi|electro|amen|motorik)$/.test(r.id)) w += 0.6;
      if (ctx.minor === false && /^(four|foursnare|tresillo|ska|samba|bossa)$/.test(r.id)) w += 0.6;
      var d = DATA.rhythms && DATA.rhythms[r.id]; if (d && d.songs) w += 0.4 * Math.log10(1 + d.songs);
      return { id: r.id, w: Math.max(0.05, w) };
    });
    out.sort(function (a, b) { return b.w - a.w; });
    return out;
  }
  // the scenes a list of prompt words names (single words and 2-3 word phrases, "witch house", "three 6 mafia")
  function scenesFor(words) {
    var map = DATA.sceneWords, sc = DATA.scenes, out = [], seen = {};
    if (!map || !sc) return out;
    var add = function (key) { var ids = map[key]; if (!ids) return; ids.forEach(function (id) { if (!seen[id] && sc[id]) { seen[id] = 1; out.push(sc[id]); } }); };
    for (var i = 0; i < words.length; i++) { add(words[i]); if (i + 1 < words.length) add(words[i] + " " + words[i + 1]); if (i + 2 < words.length) add(words[i] + " " + words[i + 1] + " " + words[i + 2]); }
    return out;
  }
  // what the scenes say about a prompt: the most experimental amount they ask for (for an AUTO EXP later), their names
  function sceneHint(words) { var sc = scenesFor(words || []); if (!sc.length) return null; var xp = 0; sc.forEach(function (x) { xp = Math.max(xp, x.xp || 0); }); return { scenes: sc.map(function (x) { return x.name; }), xp: xp, bpm: sc[0].bpm || null }; }
  function pickFor(ctx, seed) { var R = rng("pick:" + (seed == null ? 1 : seed)), s = suggest(ctx); return R.weighted(s.map(function (x) { return [x.id, Math.pow(x.w, 1.6)]; })); }
  // GENRE LINK (Eman, 15 Nov): the KILLDRUM genre picker sets the vibe, and AUTO plays that genre's own rhythms.
  // genreRhythms = the genre's rhythms, its signature one first (they open the rhythm list); pickForGenre = AUTO's pick:
  // only from that list, the signature rhythm most of the time (the song context still nudges which one).
  function genreRhythms(genre) { return (GENRE_TO[genre] || []).filter(function (id) { return !!BY[id]; }); }
  function pickForGenre(ctx, seed) {
    var list = genreRhythms(ctx && ctx.genre); if (!list.length) return pickFor(ctx, seed);
    var R = rng("gpick:" + (seed == null ? 1 : seed)), s = suggest(ctx), w = {}, POS = [6, 1.6, 0.9];
    s.forEach(function (x) { w[x.id] = x.w; });
    return R.weighted(list.map(function (id, i) { return [id, (POS[i] || 0.6) * Math.sqrt(w[id] || 1)]; }));
  }

  // one line about a rhythm, with what the data knows
  function describe(id) {
    var r = BY[id]; if (!r) return "";
    var d = DATA.rhythms && DATA.rhythms[id], t = r.about;
    if (d && d.songs) t += " In " + d.songs + " of the songs analysed" + (d.bpm && d.bpm[1] ? ", mostly around " + Math.round(d.bpm[1]) + " BPM" : "") + (d.artists && d.artists.length ? " (" + d.artists.slice(0, 3).join(", ") + ")" : "") + ".";
    return t;
  }

  var API = { RHYTHMS: RHYTHMS, GROUPS: GROUPS, scenesFor: scenesFor, sceneHint: sceneHint, byId: function (id) { return BY[id] || null; }, rank: rank, classify: classify, shape: shape, suggest: suggest, pickFor: pickFor, genreRhythms: genreRhythms, pickForGenre: pickForGenre, GENRE_TO: GENRE_TO, describe: describe, load: load, data: data, rowMasks: rowMasks, maskOf: maskOf, tempoFit: tempoFit };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window !== "undefined") {
    window.KillDrumRhythms = API;
    // OWN SOURCES (Eman, 12 Nov): the learned variants come from song collections found online, so they stay on disk
    // and load only when the DRUM RHYTHM COLLECTION switch on the UNPERSONAL DATA page is on (applies at once); the
    // hand-made skeletons always work. KT2_OWN_SOURCES_OFF = load them as before
    var useOn = function () { return window.KT2Use ? window.KT2Use("drumbrain") : !!window.KT2_OWN_SOURCES_OFF; };
    var fetched = null;
    var apply = function () {
      if (!useOn()) { DATA = { songs: 0, bars: 0, rhythms: {}, pairs: {} }; return; }   // 14 Nov: was null, which broke the RHYTHMS tab ("Rhythms didn't load.")
      if (typeof fetch !== "function") return;
      try {
        if (!fetched) {
          var urls = ["rhythm-brain-data.json"];
          if (window.KD_RHYTHM_DATA_URL) urls.push(window.KD_RHYTHM_DATA_URL);
          var get = function (i) { return i >= urls.length ? Promise.resolve(null) : fetch(urls[i]).then(function (r) { return r.ok ? r.json() : Promise.reject(0); }).catch(function () { return get(i + 1); }); };
          fetched = get(0);
        }
        fetched.then(function (d) { if (d && useOn()) { load(d); if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("rhythmbrain", { detail: { songs: d.songs } })); } }).catch(function () {});
      } catch (e) { /* no data: the skeletons alone */ }
    };
    apply();
    window.addEventListener("storage", function (e) { if (!e.key || /^kt2\.use\./.test(e.key)) apply(); });
    if (typeof document !== "undefined") document.addEventListener("kt2use", apply);
  }
})();
