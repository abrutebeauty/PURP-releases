/* KILLDRUM patterns: pure, deterministic drum-pattern generator (no DOM, node-testable).
   window.KillDrumPatterns in the browser, module.exports in node. See scratchpad CONTRACT.md.

   Step = { v: 0..127 (0 = off), r: 1..4 (hits inside the 16th) }; a pad's pattern = Step[16 * bars]
   API: GENRES, SLOTS, NOTE_OF, beat(), pad(), toNotes(), fromNotes(), empty(), parse(), str()

   Templates: when window.KillDrumGrooves (ui/killdrum-grooves.js) is around, a groove of the genre is
   picked by seed and mutated; otherwise (or 30% of the time, for variety) the rule-based generator runs.
   Same seed + same inputs = same output. */
(function () {
  "use strict";

  var SLOTS = ["kick", "808", "snare", "clap", "hat_closed", "hat_open", "perc", "fx", "texture"];
  var NOTE_OF = { kick: 36, "808": 35, snare: 38, clap: 39, hat_closed: 42, hat_open: 46, perc: 37, fx: 49, texture: 51 };
  // generation order: dependencies first (808 follows kick, clap follows snare, open hat avoids closed)
  var ORDER = ["kick", "snare", "808", "clap", "hat_closed", "hat_open", "perc", "fx", "texture"];

  // kick: four | trap | rage | drill | jersey | boom | twostep | electro
  // sub (808): follow | lead | offbeat | eighths     hats: 16 | 8 | drill | 8off | lazy
  // open: choke | offbeat | soft | off               clap: layer chance (clapPrimary = clap carries the backbeat)
  var GENRES = [
    { id: "trap", label: "Trap", bpm: [130, 165], feel: "half-time, rolling hats, 808 slides",
      half: true, kick: "trap", sub: "follow", hats: "16", rolls: 0.8, open: "choke", clap: 0.7, ghost: 0, perc: 0.3, fx: 0.35, tex: 0.25,
      names: ["ATL Bounce", "Plug Walk", "Slime Season", "Trap Door", "Codeine Dream", "Molly Whop"] },
    { id: "rage", label: "Rage", bpm: [140, 170], feel: "half-time, the 808 does the kicking, loud and sparse",
      half: true, kick: "rage", sub: "lead", hats: "8", rolls: 0.5, open: "choke", clap: 0.5, ghost: 0, perc: 0.2, fx: 0.4, tex: 0.2,
      names: ["Whole Lotta", "Opium Den", "Vamp Hour", "Sorcery", "Mosh Pit", "Red Lights"] },
    { id: "drill", label: "Drill", bpm: [138, 146], feel: "half-time, sliding 808s, 3-3-2 bounce, skippy hats",
      half: true, kick: "drill", sub: "follow", hats: "drill", rolls: 0.45, open: "choke", clap: 0.4, ghost: 0, perc: 0.35, fx: 0.3, tex: 0.15,
      names: ["Brixton Slide", "Woo Walk", "Gang Hour", "Balaclava", "Night Bus", "Opp Block"] },
    { id: "jersey", label: "Jersey", bpm: [130, 145], feel: "club bounce, kick stutter, squeaks and chops",
      half: false, kick: "jersey", sub: "follow", hats: "8", rolls: 0.3, open: "off", clap: 0.6, ghost: 0, perc: 0.6, fx: 0.5, tex: 0.1,
      names: ["Bed Squeak", "Jersey Jump", "Club Rat", "Garden State", "Bounce Back", "Sneaker Squeak"] },
    { id: "lofi", label: "Lo-fi", bpm: [70, 95], feel: "lazy swing, ghost snares, dust and tape",
      half: false, kick: "boom", sub: "follow", hats: "lazy", rolls: 0, open: "soft", clap: 0.3, ghost: 0.7, perc: 0.3, fx: 0.1, tex: 0.85,
      names: ["Blue Hour", "Sad Hours", "Snowfall", "Tape Hiss", "Late Bus", "Rainy Window"] },
    { id: "boombap", label: "Boom bap", bpm: [85, 100], feel: "hard backbeat, swung 16ths, chopped kick",
      half: false, kick: "boom", sub: "follow", hats: "8", rolls: 0, open: "soft", clap: 0.3, ghost: 0.6, perc: 0.3, fx: 0.15, tex: 0.35,
      names: ["Dusty Crate", "Golden Era", "Shook", "Boom Box", "Corner Store", "Vinyl Dig"] },
    { id: "house", label: "House", bpm: [120, 128], feel: "four on the floor, open hat offbeats, clap on 2 and 4",
      half: false, kick: "four", sub: "offbeat", hats: "8off", rolls: 0, open: "offbeat", clap: 1, clapPrimary: true, ghost: 0.1, perc: 0.5, fx: 0.25, tex: 0.2,
      names: ["Deep End", "Warehouse", "Piano Hands", "Body Move", "Sunrise Set", "Disco Dust"] },
    { id: "techno", label: "Techno", bpm: [125, 145], feel: "four on the floor, 16th hats, machine perc",
      half: false, kick: "four", sub: "offbeat", hats: "16", rolls: 0.15, open: "offbeat", clap: 1, clapPrimary: true, ghost: 0, perc: 0.55, fx: 0.2, tex: 0.25,
      names: ["Concrete", "Strobe", "Tunnel", "Black Box", "Steel Room", "Night Shift"] },
    { id: "crystal", label: "Crystal", bpm: [120, 140], feel: "electro: 4-on-floor or broken, bitcrushed stabs",
      half: false, kick: "electro", sub: "eighths", hats: "8", rolls: 0.2, open: "offbeat", clap: 0.8, ghost: 0.1, perc: 0.5, fx: 0.5, tex: 0.75,
      names: ["Crimewave", "Courtship", "Glass Castle", "8-bit Riot", "Untrust", "Celestica"] },
    { id: "dnb", label: "DnB", bpm: [165, 178], feel: "two-step breaks, kick on 1 and the 'and' of 3, ghost snares",
      half: false, kick: "twostep", sub: "follow", hats: "16", rolls: 0.1, open: "soft", clap: 0.2, ghost: 0.6, perc: 0.4, fx: 0.3, tex: 0.2,
      names: ["Amen Cut", "Two Step", "Roller", "Liquid Sky", "Jungle Run", "Hyper Jump"] }
  ];
  // MOOD GENRES (Eman, 15 Nov 2026): 38 genres in 10 mood sections, so each pick is a clearly different mood.
  // Every new genre has its own tempo, drum style, sound vibe (vibe = the words the sound dice reads) and rhythms
  // (GENRE_TO in killdrum-rhythms.js). b = the older genre whose song layouts, grooves and 808 rules it borrows.
  // Crystal keeps its id (saved beats) and is shown as Witch house. KD_GENRES_OLD = the old flat list of 10.
  var MOODS = [
    { id: "villain", title: "VILLAINCORE" }, { id: "mosh", title: "MOSH PIT" }, { id: "ghost", title: "GHOST MACHINE" },
    { id: "cloud", title: "CLOUD NINE" }, { id: "jump", title: "JERSEY" }, { id: "sweat", title: "AFRO" },
    { id: "warehouse", title: "WAREHOUSE" }, { id: "redline", title: "170+" }, { id: "crates", title: "OLD SCHOOL" }, { id: "neon", title: "SYNTH" }];
  var OLD_MOOD = { trap: "villain", drill: "villain", rage: "mosh", crystal: "ghost", lofi: "cloud", jersey: "jump", house: "warehouse", techno: "warehouse", dnb: "redline", boombap: "crates" };
  var OLD_VIBE = { trap: "trap, punchy kick, long 808, crisp snare, tight crisp hats", drill: "drill, sliding 808, crisp snare, tight hats, rim perc, dark",
    rage: "rage, blown out fuzz 808, hard distorted kick, distorted clap, crunchy hats, impact fx", crystal: "crystal castles, witch house, bitcrushed crunchy everything, chiptune blip fx, static texture",
    lofi: "lofi, dusty soft drums, round warm 808, vinyl crackle texture, reverb snare", jersey: "jersey club, punchy kick, bright clap, bed squeak perc, chopped vocal fx",
    house: "house, punchy kick, bright clap, shaker perc, open hats", techno: "techno, hard tight kick, metallic perc, reverb clap, industrial rumble texture",
    dnb: "jungle, dnb, punchy breakbeat kick, bright snappy snare, sub bass", boombap: "boom bap, dusty hip hop drums, punchy kick, vinyl crackle texture, rim perc" };
  var NEW_GENRES = [
    // VILLAINCORE
    { id: "memphis", label: "Memphis", mood: "villain", b: "trap", bpm: [130, 160], feel: "Three 6 era: dusty tape drums, cowbell, dark chants",
      half: true, kick: "trap", sub: "follow", hats: "8", rolls: 0.3, open: "choke", clap: 0.8, ghost: 0, perc: 0.75, fx: 0.3, tex: 0.6,
      vibe: "memphis phonk, dusty tape drums, cowbell perc, punchy kick, dark snare, distorted 808, tape hiss texture",
      names: ["Back Alley", "Tear Da Club", "Mystic Stylez", "Dark Chant", "Cassette Tape", "Hypnotize"] },
    { id: "phonk", label: "Phonk", mood: "villain", b: "trap", bpm: [130, 150], feel: "cowbell melodies, dirty 808, Memphis chops",
      half: true, kick: "trap", sub: "follow", hats: "8", rolls: 0.35, open: "choke", clap: 0.9, ghost: 0, perc: 0.85, fx: 0.35, tex: 0.45,
      vibe: "phonk, distorted cowbell perc, dirty distorted 808, punchy kick, crunchy clap, tight hats",
      names: ["Cowbell Cult", "Night Crawl", "Devil Lane", "Smoke Signal", "Black Visor", "Cold Grip"] },
    { id: "detroit", subOdds: 1, label: "Detroit", mood: "villain", b: "trap", bpm: [96, 112], feel: "bouncy off-kilter kicks, skippy claps, raw 808",
      half: false, kick: "jersey", sub: "follow", hats: "8", rolls: 0.15, open: "choke", clap: 0.9, clapPrimary: true, ghost: 0.2, perc: 0.4, fx: 0.2, tex: 0.15,
      vibe: "detroit, punchy bouncy kick, snappy bright clap, raw 808, tight hats, rim perc",
      names: ["Eastside", "Motor City", "Seven Mile", "Scam Season", "Flint Bounce", "Grit Avenue"] },
    { id: "sampledrill", label: "Sample drill", mood: "villain", b: "drill", bpm: [140, 146], feel: "NY drill over flipped samples: slides, skippy hats",
      half: true, kick: "drill", sub: "follow", hats: "drill", rolls: 0.5, open: "choke", clap: 0.5, ghost: 0, perc: 0.3, fx: 0.4, tex: 0.25,
      vibe: "ny drill, sliding glide 808, crisp snare, skippy tight hats, rim perc, dark",
      names: ["Bronx Flip", "Canarsie", "Sample Thief", "Woo Back", "Glide Path", "Flatbush"] },
    { id: "horrorcore", subOdds: 0.9, label: "Horrorcore", mood: "villain", b: "boombap", bpm: [75, 95], feel: "slow and evil: heavy kick, dead snare, creaks",
      half: false, kick: "boom", sub: "follow", hats: "lazy", rolls: 0, open: "soft", clap: 0.4, ghost: 0.4, perc: 0.3, fx: 0.55, tex: 0.6,
      vibe: "horror, evil dark kit, heavy dark kick, distorted 808, dark snare, reverb clap, horror fx, dark texture",
      names: ["Basement Tape", "Crypt Walk", "Body Bag", "Midnight Mass", "Hollow Grave", "Night Terror"] },
    // MOSH PIT
    { id: "hardtechno", subOdds: 0.1, label: "Hard techno", mood: "mosh", b: "techno", bpm: [145, 160], feel: "pounding distorted kick, rumble, no mercy",
      half: false, kick: "four", sub: "offbeat", hats: "16", rolls: 0.15, open: "offbeat", clap: 1, clapPrimary: true, ghost: 0, perc: 0.6, fx: 0.3, tex: 0.5,
      vibe: "hard techno, distorted hard kick, rumble, industrial metallic perc, clipped clap, noise texture",
      names: ["Bunker", "Steel Toe", "Rave Cage", "Hammer", "Concrete Rain", "Pressure Drop"] },
    { id: "dubstep", label: "Dubstep", mood: "mosh", b: "rage", bpm: [138, 150], feel: "half-time at 140, giant snare on 3, growl drops",
      half: true, kick: "rage", sub: "lead", hats: "8", rolls: 0.3, open: "choke", clap: 0.4, ghost: 0, perc: 0.3, fx: 0.6, tex: 0.25,
      vibe: "dubstep, hard punchy kick, huge snare, growl 808, impact braam fx",
      names: ["Wub Machine", "Low End", "Drop Zone", "Bass Face", "Sub Quake", "Filth"] },
    { id: "riddim", label: "Riddim", mood: "mosh", b: "rage", bpm: [140, 150], feel: "minimal and brutal: triplet wobble, empty space, hits",
      half: true, kick: "rage", sub: "lead", hats: "8", rolls: 0.2, open: "off", clap: 0.3, ghost: 0, perc: 0.2, fx: 0.5, tex: 0.2,
      vibe: "riddim, brostep, heavy growl 808, hard snare, punchy kick, impact fx",
      names: ["Robot Wob", "Grime Pit", "Sludge", "Mech", "Skull Rattle", "Snap Neck"] },
    { id: "driftphonk", label: "Drift phonk", mood: "mosh", b: "trap", bpm: [120, 135], feel: "blown out cowbell, smashed 808, straight pounding kick",
      half: false, kick: "four", sub: "follow", hats: "8", rolls: 0.25, open: "choke", clap: 1, clapPrimary: true, ghost: 0, perc: 0.9, fx: 0.4, tex: 0.3,
      vibe: "drift phonk, distorted cowbell perc, blown out fuzz 808, hard distorted clap, crunchy kick",
      names: ["Tokyo Drift", "Handbrake", "Burnout", "Night Racer", "Smoke Show", "Redline Run"] },
    // GHOST MACHINE
    { id: "darkwave", subOdds: 0.15, label: "Darkwave", mood: "ghost", b: "crystal", bpm: [110, 130], feel: "cold drum machine, gated snare, post-punk drive",
      half: false, kick: "electro", sub: "eighths", hats: "8", rolls: 0.05, open: "offbeat", clap: 0.6, ghost: 0, perc: 0.3, fx: 0.3, tex: 0.5,
      vibe: "darkwave, cold analog drum machine, gated reverb snare, tight kick, reverb clap, dark texture",
      names: ["Cold Room", "Black Lace", "Static Love", "Mirror Ball", "Funeral Disco", "Grey Dawn"] },
    { id: "hyperpop", label: "Hyperpop", mood: "ghost", b: "trap", bpm: [150, 180], feel: "maximal and glitchy: clipping 808s, zaps, chaos",
      half: true, kick: "trap", sub: "follow", hats: "16", rolls: 0.7, open: "choke", clap: 0.8, ghost: 0, perc: 0.4, fx: 0.7, tex: 0.3,
      vibe: "hyperpop, glitchy bright crunchy kit, distorted 808, bright snare, zap 8-bit fx",
      names: ["Sugar Crash", "Pink Static", "Glitter Bomb", "Overclock", "Candy Core", "Error 404"] },
    { id: "digicore", label: "Digicore", mood: "ghost", b: "trap", bpm: [140, 170], feel: "Discord-born trap: bright, bouncy, glitched",
      half: true, kick: "trap", sub: "follow", hats: "16", rolls: 0.6, open: "choke", clap: 0.8, ghost: 0, perc: 0.3, fx: 0.55, tex: 0.25,
      vibe: "digicore, glitchy crunchy trap kit, bright snare, distorted 808, 8-bit fx",
      names: ["Server Room", "Lagging", "Low Battery", "Pixel Heart", "Dial Up", "Bit Rot"] },
    { id: "glitchcore", subOdds: 0.6, label: "Glitchcore", mood: "ghost", b: "crystal", bpm: [150, 175], feel: "stutters, chops, bitcrushed everything",
      half: false, kick: "electro", sub: "eighths", hats: "16", rolls: 0.8, open: "offbeat", clap: 0.7, ghost: 0.1, perc: 0.5, fx: 0.8, tex: 0.6,
      vibe: "glitchcore, glitchy bitcrushed crunchy kit, stutter glitch fx, static texture",
      names: ["Buffer", "Corrupt File", "Skip Skip", "Data Moth", "Shatter", "Blue Screen"] },
    // CLOUD NINE
    { id: "plugg", label: "Plugg", mood: "cloud", b: "trap", bpm: [140, 160], feel: "floaty and sweet: soft 808, crisp clap, bells",
      half: true, kick: "trap", sub: "follow", hats: "8", rolls: 0.2, open: "choke", clap: 0.95, clapPrimary: true, ghost: 0, perc: 0.2, fx: 0.25, tex: 0.3,
      vibe: "plugg, soft round 808, crisp bright clap, airy hats, plucky",
      names: ["Pluggin", "Candy Rain", "Soft Lock", "Space Plug", "Lil Halo", "Fluff"] },
    { id: "pluggnb", label: "Pluggnb", mood: "cloud", b: "trap", bpm: [140, 160], feel: "plugg with R&B heart: lush, wet, warm 808",
      half: true, kick: "trap", sub: "follow", hats: "8", rolls: 0.25, open: "soft", clap: 0.9, clapPrimary: true, ghost: 0.1, perc: 0.2, fx: 0.2, tex: 0.35,
      vibe: "pluggnb, round warm 808, soft snare, reverb clap, airy hats, wide",
      names: ["Lovesick", "Heart Plug", "Velvet Rain", "Late Text", "Rose Water", "Slow Dance"] },
    { id: "cloudrap", label: "Cloud rap", mood: "cloud", b: "trap", bpm: [125, 150], feel: "hazy and wide: reverb drums, long 808, air",
      half: true, kick: "trap", sub: "follow", hats: "lazy", rolls: 0.15, open: "soft", clap: 0.6, ghost: 0, perc: 0.2, fx: 0.3, tex: 0.6,
      vibe: "cloud rap, airy reverb drums, long round 808, muffled hats, ambient texture, wide",
      names: ["Haze", "Above Clouds", "Purple Sky", "Float", "Daydream", "Sky Walk"] },
    // JERSEY
    { id: "bmore", label: "Baltimore club", mood: "jump", b: "jersey", bpm: [128, 135], feel: "the Think break chopped: kick runs, hard claps",
      half: false, kick: "jersey", sub: "follow", hats: "8", rolls: 0.2, open: "offbeat", clap: 0.9, clapPrimary: true, ghost: 0.1, perc: 0.6, fx: 0.4, tex: 0.1,
      vibe: "baltimore club, breakbeat kick, bright hard clap, chopped vocal perc",
      names: ["Charm City", "Think Break", "Club Queen", "Harbor Jump", "Row House", "B-More"] },
    { id: "footwork", label: "Footwork", mood: "jump", b: "jersey", bpm: [155, 165], feel: "160 BPM juke: triplet kicks, rapid claps",
      half: false, kick: "jersey", sub: "follow", hats: "16", rolls: 0.4, open: "off", clap: 0.9, ghost: 0.2, perc: 0.7, fx: 0.4, tex: 0.1,
      vibe: "footwork juke, 808 kick, rapid bright claps, chopped vocal perc",
      names: ["Battle Circle", "Teklife", "Juke Joint", "Fast Feet", "Southside", "Footwork Cypher"] },
    { id: "jerk", label: "Jerk", mood: "jump", b: "trap", bpm: [150, 170], feel: "fast bouncy claps, punchy kicks, sub 808 hops",
      half: false, kick: "jersey", sub: "follow", hats: "8", rolls: 0.3, open: "choke", clap: 0.95, clapPrimary: true, ghost: 0, perc: 0.3, fx: 0.3, tex: 0.15,
      vibe: "jerk, bouncy punchy kick, snappy bright clap, sub 808, tight hats",
      names: ["Jerkin", "Skinny Jeans", "Hop Step", "Pin Drop", "Sprint", "Twitch"] },
    { id: "baile", label: "Baile funk", mood: "jump", b: "jersey", bpm: [125, 135], feel: "Rio tamborzao: raw kicks, vocal chops, chaos",
      half: false, kick: "jersey", sub: "follow", hats: "8", rolls: 0.15, open: "off", clap: 0.7, ghost: 0.1, perc: 0.8, fx: 0.4, tex: 0.15,
      vibe: "baile funk, raw punchy kick, snappy snare, vocal chop perc, distorted 808",
      names: ["Favela", "Tamborzao", "Rio Heat", "Baile Night", "Morro", "Pancadao"] },
    // AFRO
    { id: "reggaeton", subOdds: 0.7, label: "Reggaeton", mood: "sweat", b: "house", bpm: [88, 100], feel: "dembow: four kicks, the snare answers, perreo",
      half: false, kick: "four", sub: "follow", hats: "8", rolls: 0.1, open: "off", clap: 0.6, ghost: 0, perc: 0.5, fx: 0.25, tex: 0.1,
      vibe: "reggaeton, punchy kick, snappy snare, rim perc, sub 808, shaker",
      names: ["Perreo", "Calle Luna", "Noche Roja", "Gasolina Hour", "Dembow Heat", "Bellaqueo"] },
    { id: "dembow", subOdds: 0.6, label: "Dembow", mood: "sweat", b: "house", bpm: [115, 130], feel: "Dominican dembow: faster, harder, machine-gun snares",
      half: false, kick: "four", sub: "follow", hats: "16", rolls: 0.3, open: "off", clap: 0.6, ghost: 0.1, perc: 0.7, fx: 0.3, tex: 0.1,
      vibe: "dominican dembow, hard snappy snare, punchy kick, perc, sub 808",
      names: ["Santo Domingo", "Tiguere", "Rapido", "Calle Fuego", "Dale Ya", "Ritmo Duro"] },
    { id: "afrobeats", subOdds: 0.3, label: "Afrobeats", mood: "sweat", b: "house", bpm: [100, 115], feel: "rolling log of shakers and congas, soft kick sway",
      half: false, kick: "boom", sub: "follow", hats: "16", rolls: 0, open: "soft", clap: 0.5, ghost: 0.3, perc: 0.9, fx: 0.15, tex: 0.1,
      vibe: "afrobeats, organic perc, shaker, conga, soft kick, rim snare",
      names: ["Lagos Night", "Accra Sun", "Gbedu", "Owambe", "Island Sway", "Sweet Sound"] },
    { id: "amapiano", subOdds: 0.6, label: "Amapiano", mood: "sweat", b: "house", bpm: [110, 115], feel: "log drum bass, shakers, lazy kick, the piano groove",
      half: false, kick: "four", sub: "offbeat", hats: "16", rolls: 0, open: "soft", clap: 0.6, ghost: 0.2, perc: 0.8, fx: 0.2, tex: 0.15,
      vibe: "amapiano, log drum, shaker perc, soft kick, wide reverb clap",
      names: ["Log Drum", "Joburg", "Piano Hands", "Yanos", "Soweto", "Private School"] },
    { id: "rnb", subOdds: 0.9, label: "R&B", mood: "sweat", b: "lofi", bpm: [65, 95], feel: "slow and close: finger snaps, round 808, soft hats",
      half: false, kick: "boom", sub: "follow", hats: "lazy", rolls: 0.3, open: "soft", clap: 0.8, ghost: 0.3, perc: 0.3, fx: 0.15, tex: 0.3,
      vibe: "r&b, smooth round warm 808, soft snare, finger snap clap, crisp hats",
      names: ["Slow Wind", "Silk Sheets", "Candle Light", "After Hours", "Body Talk", "Late Call"] },
    // WAREHOUSE
    { id: "ukg", subOdds: 0.5, label: "UK Garage", mood: "warehouse", b: "house", bpm: [128, 136], feel: "speed garage: swung four, rude bass, shuffled hats",
      half: false, kick: "four", sub: "offbeat", hats: "8off", rolls: 0.1, open: "offbeat", clap: 1, clapPrimary: true, ghost: 0.3, perc: 0.5, fx: 0.25, tex: 0.15,
      vibe: "uk garage, punchy kick, bright clap, shuffled hats, shaker perc, sub bass",
      names: ["Pirate Radio", "Sunday Rave", "Bus Shelter", "Rewind", "Bassline Bounce", "London Fog"] },
    { id: "twostep", subOdds: 0.35, label: "2-step", mood: "warehouse", b: "house", bpm: [130, 136], feel: "skippy broken kick, snare on 2 and 4, swing",
      half: false, kick: "twostep", sub: "offbeat", hats: "8", rolls: 0.1, open: "soft", clap: 0.8, ghost: 0.4, perc: 0.5, fx: 0.2, tex: 0.2,
      vibe: "2-step garage, punchy kick, bright snappy snare, shaker perc, crisp hats",
      names: ["Skip Step", "Night Bus", "Two Step", "Moonlit Shuffle", "Cross Town", "Deja"] },
    { id: "basshouse", subOdds: 0.7, label: "Bass house", mood: "warehouse", b: "house", bpm: [124, 130], feel: "house with a growl: hard four, wobble bass stabs",
      half: false, kick: "four", sub: "offbeat", hats: "8off", rolls: 0.1, open: "offbeat", clap: 1, clapPrimary: true, ghost: 0, perc: 0.4, fx: 0.4, tex: 0.2,
      vibe: "bass house, hard punchy kick, growl 808 bass, crisp bright clap, open hats",
      names: ["Growl Room", "Bass Face", "Stomp", "Rubber Floor", "Low Rider", "Wobble"] },
    // 170+
    { id: "jungle", subOdds: 0.5, label: "Jungle", mood: "redline", b: "dnb", bpm: [160, 175], feel: "chopped amen breaks, ragga energy, sub pressure",
      half: false, kick: "twostep", sub: "follow", hats: "16", rolls: 0.3, open: "soft", clap: 0.2, ghost: 0.7, perc: 0.5, fx: 0.35, tex: 0.3,
      vibe: "jungle, amen breakbeat, punchy kick, bright snappy snare, sub bass, ragga",
      names: ["Amen Brother", "Rinse Out", "Junglist", "Bad Boy", "Pressure", "Sound Boy"] },
    { id: "breakbeat", subOdds: 0.3, label: "Breakbeat", mood: "redline", b: "dnb", bpm: [125, 140], feel: "big beat breaks: funky kick, cracking snare",
      half: false, kick: "boom", sub: "follow", hats: "16", rolls: 0.15, open: "soft", clap: 0.3, ghost: 0.6, perc: 0.4, fx: 0.35, tex: 0.25,
      vibe: "breakbeat, big beat, punchy breaks kick, cracking bright snare, crisp hats",
      names: ["Big Beat", "Firestarter", "Break Loose", "Funky Drummer", "Smash Cut", "Breakdown"] },
    // OLD SCHOOL
    { id: "gfunk", subOdds: 0.6, label: "G-funk", mood: "crates", b: "boombap", bpm: [88, 100], feel: "West coast lean: laid back kick, snappy clap, shaker",
      half: false, kick: "boom", sub: "follow", hats: "8", rolls: 0, open: "soft", clap: 0.9, clapPrimary: true, ghost: 0.3, perc: 0.6, fx: 0.1, tex: 0.2,
      vibe: "g-funk, west coast, laid back punchy kick, snappy clap, shaker perc, round 808",
      names: ["Lowrider", "Cruise Control", "Long Beach", "Sunset Blvd", "Six Four", "Hydraulics"] },
    // SYNTH
    { id: "synthwave", subOdds: 0.1, label: "Synthwave", mood: "neon", b: "house", bpm: [80, 118], feel: "80s drum machine: gated snare, steady kick, chrome",
      half: false, kick: "four", sub: "eighths", hats: "8", rolls: 0.05, open: "offbeat", clap: 0.5, ghost: 0, perc: 0.2, fx: 0.25, tex: 0.2,
      vibe: "synthwave, 80s retro gated reverb snare, punchy kick, crisp hats",
      names: ["Outrun", "Neon Drive", "Miami Night", "Chrome Heart", "VHS Sunset", "Laser Grid"] },
    { id: "darksynth", subOdds: 0.2, label: "Darksynth", mood: "neon", b: "crystal", bpm: [100, 125], feel: "synthwave gone evil: huge gated snare, pounding kick",
      half: false, kick: "four", sub: "eighths", hats: "16", rolls: 0.1, open: "offbeat", clap: 0.6, ghost: 0, perc: 0.3, fx: 0.4, tex: 0.4,
      vibe: "darksynth, dark distorted punchy kick, huge gated reverb snare, industrial texture, 80s",
      names: ["Night Stalker", "Red Eye", "Turbo Killer", "Chrome Skull", "Blackout", "Grid Hunter"] },
    { id: "vaporwave", subOdds: 0.2, label: "Vaporwave", mood: "neon", b: "lofi", bpm: [60, 90], feel: "slowed mall music: soft muffled drums, wide, warped",
      half: false, kick: "boom", sub: "follow", hats: "lazy", rolls: 0, open: "soft", clap: 0.6, ghost: 0.2, perc: 0.3, fx: 0.2, tex: 0.8,
      vibe: "vaporwave, muffled soft 80s drums, gated reverb snare, wide, tape texture",
      names: ["Mall Soft", "Plaza", "Dream Pool", "Pastel Lobby", "Floral Shop", "Slow Escalator"] },
    { id: "italo", subOdds: 0.15, label: "Italo disco", mood: "neon", b: "house", bpm: [115, 125], feel: "drum machine disco: four on the floor, claps, octave bass",
      half: false, kick: "four", sub: "eighths", hats: "8off", rolls: 0, open: "offbeat", clap: 1, clapPrimary: true, ghost: 0, perc: 0.4, fx: 0.2, tex: 0.1,
      vibe: "italo disco, 80s drum machine, punchy kick, bright clap, open hats, retro",
      names: ["Milano", "Disco Laser", "Riviera", "Vamos", "Moroder Nights", "Cosmic Club"] }
  ];
  GENRES.forEach(function (g) { g.b = g.id; g.mood = OLD_MOOD[g.id]; g.vibe = OLD_VIBE[g.id]; });
  // OPIUM (Eman, 24 Nov 2026): rage-beat page built from two tutorial shorts (808 on every 8th with 16th pickups
  // at ~142 BPM, 808 doing the kicking, tiny very bright hats). KD_OPIUM_OFF = page gone. Sounds: pack "opium".
  if (!(typeof window !== "undefined" && window.KD_OPIUM_OFF)) {
    MOODS.unshift({ id: "opium", title: "OPIUM" });
    NEW_GENRES.push(
      { id: "opium", subOdds: 1, label: "Opium", mood: "opium", b: "rage", bpm: [138, 150], feel: "rage: distorted 808 on every 8th, snare on 3, tiny bright hats",
        half: true, kick: "rage", sub: "lead", hats: "8", rolls: 0.45, open: "choke", clap: 0.6, ghost: 0, perc: 0.15, fx: 0.3, tex: 0.1,
        vibe: "opium, rage, distorted blown out 808, punchy kick, stacked snare, layered clap, crispy tight hats, dark bell perc",
        names: ["Vamp Hour", "Sorcery", "Slatt Room", "Chrome Hearts", "Red Light", "Antagonist"] },
      { id: "evilrage", subOdds: 1, label: "Evil rage", mood: "opium", b: "rage", bpm: [125, 140], feel: "slower and meaner: long glide 808, dead snare, bells",
        half: true, kick: "rage", sub: "lead", hats: "8", rolls: 0.3, open: "soft", clap: 0.4, ghost: 0, perc: 0.35, fx: 0.4, tex: 0.25,
        vibe: "opium, evil, dark, long sliding 808, dead snare, wide clap, dark bell perc, dirty hats",
        names: ["Dark Mode", "Cult Leader", "Black Halo", "Night Shift", "Crown Of Thorns", "Evil Jordan"] }
    );
  }
  var OLD_LIST = typeof window !== "undefined" && !!window.KD_GENRES_OLD;
  if (!OLD_LIST) {
    GENRES.forEach(function (g) { if (g.id === "crystal") { g.label = "Witch house"; g.feel = "witch house / Crystal Castles: bitcrushed, cold, haunted"; } });
    GENRES = GENRES.concat(NEW_GENRES);
    var moodAt = {}; MOODS.forEach(function (m, i) { moodAt[m.id] = i; });
    var orig = {}; GENRES.forEach(function (g, i) { orig[g.id] = i; });
    GENRES.sort(function (a, b) { return (moodAt[a.mood] - moodAt[b.mood]) || (orig[a.id] - orig[b.id]); });
  }
  var BY_ID = {};
  GENRES.forEach(function (g) { BY_ID[g.id] = g; });
  function baseOf(id) { var g = BY_ID[String(id || "").toLowerCase()]; return g ? g.b : id; }

  /* ---------- random ---------- */
  function fnv(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function seedOf() {
    var s = "";
    for (var i = 0; i < arguments.length; i++) s += String(arguments[i]) + "|";
    return fnv(s);
  }
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    var f = mulberry32(seed);
    return {
      next: f,
      chance: function (p) { return f() < p; },
      int: function (n) { return Math.floor(f() * n); },
      range: function (lo, hi) { return lo + Math.floor(f() * (hi - lo + 1)); },
      pick: function (arr) { return arr[Math.floor(f() * arr.length)]; },
      // weighted pick: items = [[value, weight], ...]
      weighted: function (items) {
        var total = 0, i;
        for (i = 0; i < items.length; i++) total += items[i][1];
        var x = f() * total;
        for (i = 0; i < items.length; i++) { x -= items[i][1]; if (x < 0) return items[i][0]; }
        return items[items.length - 1][0];
      }
    };
  }

  /* ---------- steps ---------- */
  function clampV(v) { v = Math.round(+v || 0); return v < 0 ? 0 : v > 127 ? 127 : v; }
  function clampR(r) { r = Math.round(+r || 1); return r < 1 ? 1 : r > 4 ? 4 : r; }
  function off() { return { v: 0, r: 1 }; }
  function hit(v, r) { v = clampV(v); return { v: v, r: v ? clampR(r) : 1 }; }
  // a step's extras: c = chance (0..1, left out = always), t = pitch in semitones, g = glide into it,
  // o = how far past its 16th the hit sits (0..1 of a step: Cmd-drag snaps to 1/32 and triplets),
  // u = a unique hit's own settings on top of the row ({ id, tune, decay, drive, cutoff, pan, level, fx })
  function extras(dst, s) {
    if (s && s.c != null && s.c < 1) dst.c = Math.max(0.05, +s.c);
    if (s && s.t) dst.t = Math.max(-24, Math.min(24, Math.round(+s.t)));
    if (s && s.g) dst.g = true;
    if (s && s.o > 0.01 && s.o < 0.99) dst.o = Math.round(+s.o * 1000) / 1000;
    if (s && s.u && typeof s.u === "object") dst.u = JSON.parse(JSON.stringify(s.u));
    // the row's MIDI editor (14 Nov): l = how long the note holds (steps), bend = pitch line [[beats, semis]],
    // wob = wobble { d, r, sh, f }, ft = fine pitch (cents). Left out = the hit rings as before.
    if (s && s.l > 0) dst.l = Math.max(0.25, Math.min(128, Math.round(+s.l * 1000) / 1000));
    if (s && Array.isArray(s.bend) && s.bend.length) dst.bend = s.bend.map(function (p) { return [+p[0] || 0, Math.max(-48, Math.min(48, +p[1] || 0))]; });
    if (s && s.wob && s.wob.d > 0) dst.wob = { d: Math.min(12, +s.wob.d), r: +s.wob.r || 4, sh: s.wob.sh | 0, f: Math.max(0, Math.min(1, +s.wob.f || 0)) };
    if (s && s.ft) dst.ft = Math.max(-100, Math.min(100, Math.round(+s.ft)));
    return dst;
  }
  function clampBars(bars) { bars = Math.round(+bars || 0); return bars < 1 ? 1 : bars > 512 ? 512 : bars; }   // up to 512 bars: a long clip is one long pattern (15 Nov; was 8)

  function empty(bars) {
    var n = 16 * clampBars(bars), p = new Array(n);
    for (var i = 0; i < n; i++) p[i] = off();
    return p;
  }
  // any array-ish of steps -> clean Step[16*bars] (repeat / trim)
  function normalize(pat, bars) {
    var n = 16 * clampBars(bars), out = new Array(n);
    var len = pat && pat.length ? pat.length : 0;
    for (var i = 0; i < n; i++) {
      var s = len ? pat[i % len] : null;
      out[i] = s && s.v > 0 ? extras(hit(s.v, s.r), s) : off();
    }
    return out;
  }
  function clone(pat) { return pat.map(function (s) { return s.v > 0 ? hit(s.v, s.r) : off(); }); }
  function same(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      var av = a[i] ? a[i].v : 0, bv = b[i] ? b[i].v : 0;
      if (av !== bv) return false;
      if (av && (a[i].r || 1) !== (b[i].r || 1)) return false;
    }
    return true;
  }
  // "x" hit, "X" accent, "o" ghost, "2"/"3"/"4" roll, "t" triplet roll, anything else off
  function parse(str, bars) {
    str = String(str || "");
    var n = 16 * clampBars(bars), out = new Array(n), len = str.length;
    for (var i = 0; i < n; i++) {
      var c = len ? str.charAt(i % len) : ".";
      out[i] = c === "x" ? hit(100, 1) : c === "X" ? hit(124, 1) : c === "o" ? hit(55, 1)
        : (c === "2" || c === "3" || c === "4") ? hit(96, +c) : c === "t" ? hit(96, 3) : off();
    }
    return out;
  }
  function str(pat) {
    var s = "";
    for (var i = 0; i < pat.length; i++) {
      var st = pat[i];
      s += !st || !st.v ? "." : st.r > 1 ? String(clampR(st.r)) : st.v >= 115 ? "X" : st.v <= 62 ? "o" : "x";
    }
    return s;
  }
  function on(p, i) { return i >= 0 && i < p.length && p[i].v > 0; }
  function onIdx(p, skipDownbeats) {
    var out = [];
    for (var i = 0; i < p.length; i++) if (p[i].v > 0 && !(skipDownbeats && i % 16 === 0)) out.push(i);
    return out;
  }
  function count(p, from, to) { var c = 0; for (var i = from; i < to; i++) if (p[i].v > 0) c++; return c; }
  function hitsPerBar(p, b) { return count(p, b * 16, b * 16 + 16); }
  // keep at most max hits in a bar: drop the softest ones (never step 0 of the bar)
  function capBar(p, b, max) {
    while (hitsPerBar(p, b) > max) {
      var softest = -1;
      for (var i = b * 16 + 1; i < b * 16 + 16; i++) if (p[i].v > 0 && (softest < 0 || p[i].v < p[softest].v)) softest = i;
      if (softest < 0) break;
      p[softest] = off();
    }
  }

  /* ---------- context ---------- */
  function ruleFor(genre) { return BY_ID[String(genre || "").toLowerCase()] || BY_ID.trap; }
  function midBpm(rule) { return Math.round((rule.bpm[0] + rule.bpm[1]) / 2); }
  function makeCtx(rule, bpm, bars, density, rng, pads, locked) {
    bpm = +bpm > 0 ? +bpm : midBpm(rule);
    var half = !!rule.half && bpm >= 100;        // half-time genres played slow turn double-time
    return {
      rule: rule, bpm: bpm, bars: bars, n: 16 * bars, half: half,
      bb: half ? [8] : [4, 12],                   // backbeat steps within a bar
      density: density, rng: rng, pads: pads || {}, locked: locked || {}
    };
  }
  function pad_(ctx, slot) { return ctx.pads[slot] || null; }
  function isBackbeat(ctx, i) { return ctx.bb.indexOf(i % 16) >= 0; }
  function dens(ctx, k) { return (0.5 + ctx.density) * (k == null ? 1 : k); }   // x1 at density 0.5

  /* ---------- rule generators ---------- */
  function genKick(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng, bars = ctx.bars, style = ctx.rule.kick, b, base, last;
    var sub = pad_(ctx, "808");
    if (ctx.locked["808"] && sub) return kickFrom808(ctx);
    for (b = 0; b < bars; b++) {
      base = b * 16; last = b === bars - 1;
      if (style === "four") {
        p[base] = hit(120, 1); p[base + 4] = hit(112, 1); p[base + 8] = hit(116, 1); p[base + 12] = hit(112, 1);
      } else if (style === "trap") {
        p[base] = hit(122, 1);
        if (rng.chance(0.7 * dens(ctx))) p[base + rng.pick([10, 11, 10])] = hit(108, 1);
        if (rng.chance(0.35 * dens(ctx))) p[base + rng.pick([6, 7, 3])] = hit(100, 1);
        if (last && rng.chance(0.4)) p[base + rng.pick([14, 15])] = hit(96, 1);
        else if (b % 2 === 1 && rng.chance(0.3)) p[base + 13] = hit(92, 1);
      } else if (style === "rage") {
        if (b === 0 || rng.chance(0.6)) p[base] = hit(120, 1);
        if (rng.chance(0.3 * dens(ctx))) p[base + rng.pick([6, 10, 11])] = hit(104, 1);
      } else if (style === "drill") {
        p[base] = hit(120, 1);
        if (rng.chance(0.8)) p[base + 6] = hit(106, 1);
        if (rng.chance(0.6)) p[base + 12] = hit(104, 1); else p[base + 11] = hit(104, 1);
        if (last && rng.chance(0.4)) p[base + rng.pick([14, 15])] = hit(96, 1);
      } else if (style === "jersey") {
        [0, 3, 6, 10, 12].forEach(function (s, k) { p[base + s] = hit(k === 0 ? 120 : 108, 1); });
        if (last && rng.chance(0.5)) p[base + 14] = hit(104, 3);         // the triplet kick stutter
        else if (rng.chance(0.3)) p[base + 14] = hit(96, 1);
      } else if (style === "boom") {
        p[base] = hit(118, 1);
        var pool = rng.pick([[7, 10], [6, 10], [10], [3, 10], [7, 11], [6, 11, 14], [2, 7, 10]]);
        pool.forEach(function (s) { if (rng.chance(0.85)) p[base + s] = hit(s === 10 ? 110 : 100, 1); });
        if (last && rng.chance(0.35)) p[base + 15] = hit(92, 1);
      } else if (style === "twostep") {
        p[base] = hit(120, 1); p[base + 10] = hit(112, 1);
        if (rng.chance(0.25 * dens(ctx))) p[base + 14] = hit(96, 1);
        if (b % 2 === 1 && rng.chance(0.3)) p[base + 7] = hit(92, 1);
      } else if (style === "electro") {
        var pat = rng.weighted([[[0, 4, 8, 12], 5], [[0, 4, 8, 12, 14], 2], [[0, 7, 8, 10], 2], [[0, 6, 8, 11], 2]]);
        pat.forEach(function (s, k) { p[base + s] = hit(k === 0 ? 120 : s % 4 === 0 ? 112 : 100, 1); });
      }
    }
    return p;
  }
  // when the 808 is locked, the kick follows it instead
  function kickFrom808(ctx) {
    var sub = pad_(ctx, "808"), p = empty(ctx.bars), rng = ctx.rng, rage = ctx.rule.b === "rage";
    for (var i = 0; i < ctx.n; i++) {
      if (!sub[i].v) continue;
      if (i % 16 === 0 ? (rage ? rng.chance(0.6) : true) : rng.chance(rage ? 0.4 : 0.7)) p[i] = hit(i % 16 === 0 ? 120 : 104, 1);
    }
    if (!rage && !p[0].v) p[0] = hit(120, 1);
    return p;
  }
  function gen808(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng, bars = ctx.bars, style = ctx.rule.sub, kick = pad_(ctx, "kick") || empty(bars), b, base, i;
    var snare = pad_(ctx, "snare");
    function free(i) { return !p[i].v && !kick[i].v && !(snare && snare[i].v >= 100); }
    if (style === "lead") {   // rage: the 808 is the drum
      for (b = 0; b < bars; b++) {
        base = b * 16;
        var pat = rng.pick([[0, 6, 10], [0, 7, 10, 14], [0, 10, 11], [0, 6, 11, 14], [0, 3, 10], [0, 10, 13]]);
        pat.forEach(function (s, k) { p[base + s] = hit(k === 0 ? 120 : 108, 1); });
        if (b === bars - 1 && rng.chance(0.4)) p[base + 15] = hit(100, 1);
      }
      for (i = 0; i < ctx.n; i++) if (kick[i].v && !p[i].v && rng.chance(0.5)) p[i] = hit(104, 1);
    } else if (style === "offbeat" && rng.chance(0.55)) {   // house/techno rolling bass
      for (i = 2; i < ctx.n; i += 4) p[i] = hit(100, 1);
      if (rng.chance(0.3)) p[0] = hit(108, 1);
    } else if (style === "eighths" && rng.chance(0.5)) {    // crystal: 8th-note bass
      for (i = 0; i < ctx.n; i += 2) p[i] = hit(i % 16 === 0 ? 110 : 96, 1);
      if (rng.chance(0.5)) for (i = 14; i < ctx.n; i += 16) p[i] = off();
    } else {                                                 // follow the kick (~75%) plus pickups, leave space
      for (i = 0; i < ctx.n; i++) if (kick[i].v && (i === 0 || rng.chance(0.75))) p[i] = hit(kick[i].v - 4, 1);
      var pickups = bars > 1 ? rng.range(1, 2) : (rng.chance(0.6) ? 1 : 0);
      var cands = [3, 11, 14, 15, 7, 13, 9];
      for (var k = 0; k < pickups; k++) {
        b = rng.int(bars); var s = base = b * 16 + rng.pick(cands);
        if (free(s)) p[s] = hit(100, 1);
      }
      if (!p[0].v && !count(p, 0, ctx.n)) p[0] = hit(112, 1);
    }
    for (b = 0; b < bars; b++) capBar(p, b, style === "eighths" ? 8 : 5);
    return p;
  }
  function fillInto(p, ctx) {   // a snare fill in the last bar
    var rng = ctx.rng, base = (ctx.bars - 1) * 16, id = ctx.rule.b, kind;
    var light = id === "lofi" || id === "house" || id === "techno";
    kind = rng.weighted([["climb", 3], ["double", light ? 1 : 3], ["trip", light ? 0.5 : 2], ["skip", 2]]);
    function put(s, v, r) { if (!isBackbeat(ctx, s) && !p[base + s].v) p[base + s] = hit(light ? v - 25 : v, r); }
    if (kind === "climb") { put(13, 80, 1); put(14, 92, 1); put(15, 104, 1); }
    else if (kind === "double") { put(14, 96, 2); put(15, 110, 1); }
    else if (kind === "trip") { put(15, 100, 3); }
    else { put(11, 84, 1); put(13, 94, 1); put(15, 106, 1); }
    return p;
  }
  function addGhosts(p, ctx) {
    var rule = ctx.rule, rng = ctx.rng;
    if (!rule.ghost) return p;
    var per = Math.round(rule.ghost * dens(ctx) * 2.2);   // ~0..3 per bar
    for (var b = 0; b < ctx.bars; b++) {
      var cands = rng.pick([[3, 7, 11, 15], [7, 10, 15, 2], [3, 10, 14, 11], [7, 11, 15, 6]]);
      for (var k = 0; k < per && k < cands.length; k++) {
        var s = b * 16 + cands[k];
        if (!p[s].v && !isBackbeat(ctx, s) && rng.chance(0.8)) p[s] = hit(rng.range(44, 58), 1);
      }
    }
    return p;
  }
  function genSnare(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng, rule = ctx.rule, bars = ctx.bars, b, base;
    for (b = 0; b < bars; b++) {
      base = b * 16;
      if (rule.clapPrimary) {   // house/techno: the clap carries 2 and 4, the snare layers it sometimes
        if (rng.chance(0.4)) ctx.bb.forEach(function (s) { p[base + s] = hit(92, 1); });
        continue;
      }
      ctx.bb.forEach(function (s) { p[base + s] = hit(rule.b === "rage" ? 124 : 120, 1); });
      if (rule.b === "drill" && ctx.half && rng.chance(0.45)) p[base + 14] = hit(100, 1);
      if (rule.b === "jersey" && rng.chance(0.3)) p[base + 14] = hit(92, 1);
    }
    addGhosts(p, ctx);
    var fillChance = bars > 1 ? (rule.clapPrimary || rule.b === "lofi" ? 0.25 : 0.45) : 0.12;
    if (rng.chance(fillChance)) fillInto(p, ctx);
    return p;
  }
  function genClap(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng, rule = ctx.rule, snare = pad_(ctx, "snare") || empty(ctx.bars), b, base, i;
    var strong = [];
    for (i = 0; i < ctx.n; i++) if (snare[i].v >= 100) strong.push(i);
    if (rule.clapPrimary) {
      for (b = 0; b < ctx.bars; b++) ctx.bb.forEach(function (s) { p[b * 16 + s] = hit(112, 1); });
      if (rule.b === "house" && rng.chance(0.3)) p[ctx.n - 1] = hit(84, 1);
      return p;
    }
    if (!strong.length) for (b = 0; b < ctx.bars; b++) ctx.bb.forEach(function (s) { strong.push(b * 16 + s); });
    if (rng.chance(rule.clap)) {   // layer the snare
      strong.forEach(function (i) { p[i] = hit(104, 1); });
      // and the fill, sometimes
      if (rng.chance(0.5)) for (i = ctx.n - 4; i < ctx.n; i++) if (snare[i].v >= 70 && snare[i].v < 115) p[i] = hit(snare[i].v, snare[i].r);
    } else {                       // answer it: a clap in the gap after the snare
      strong.forEach(function (i) {
        if (!rng.chance(0.65)) return;
        var cands = [i + 6, i + 7, i + 3], s;
        for (var k = 0; k < cands.length; k++) { s = cands[k]; if (s < ctx.n && !snare[s].v && !p[s].v && !isBackbeat(ctx, s)) { p[s] = hit(96, 1); break; } }
      });
      if (!count(p, 0, ctx.n) && strong.length) p[strong[0]] = hit(104, 1);
    }
    return p;
  }
  // thin or thicken a hat pattern by density (keeps the accents)
  function applyDensity(p, ctx) {
    var d = ctx.density, rng = ctx.rng, i;
    if (d < 0.5) { var drop = (0.5 - d) * 2 * 0.9; for (i = 1; i < p.length; i += 2) if (p[i].v && p[i].r === 1 && rng.chance(drop)) p[i] = off(); }
    else if (d > 0.5) { var add = (d - 0.5) * 2 * 0.7; for (i = 1; i < p.length; i += 2) if (!p[i].v && rng.chance(add)) p[i] = hit(70, 1); }
    return p;
  }
  function addRolls(p, ctx) {
    var rule = ctx.rule, rng = ctx.rng, bars = ctx.bars, b, base;
    if (!rule.rolls) return p;
    var spots = ctx.half ? [[15, 4], [14, 3], [7, 3], [6, 2], [11, 1], [3, 1]] : [[15, 4], [14, 2], [7, 3], [11, 1]];
    for (b = 0; b < bars; b++) {
      base = b * 16;
      if (!rng.chance(rule.rolls * (0.4 + ctx.density))) continue;
      var s = base + rng.weighted(spots);
      p[s] = hit(96, rng.weighted([[2, 4], [3, 3.5], [4, 2.5]]));
      if (rng.chance(0.3)) { var s2 = base + rng.weighted(spots); if (s2 !== s) p[s2] = hit(92, rng.pick([2, 3])); }
      if (b === bars - 1 && rule.b === "trap" && rng.chance(0.3 * ctx.density * 2)) for (var i = 12; i < 16; i++) p[base + i] = hit(90 + i, 2);   // the double-time run
    }
    return p;
  }
  function genHatClosed(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng, rule = ctx.rule, style = rule.hats, i, b, base;
    for (b = 0; b < ctx.bars; b++) {
      base = b * 16;
      if (style === "16") for (i = 0; i < 16; i++) p[base + i] = hit(i % 4 === 0 ? 110 : i % 4 === 2 ? 92 : 78, 1);
      else if (style === "8" || style === "8off") {
        for (i = 0; i < 16; i += 2) p[base + i] = hit(i % 4 === 0 ? 106 : 88, 1);
        if (style === "8off" && rng.chance(0.5)) for (i = 3; i < 16; i += 4) p[base + i] = hit(70, 1);
      } else if (style === "drill") {
        var s = rng.pick(["x.x.xx.x.x.x.xx.", "x.x.x.xxx.x.x.x.", "x.xx.x.x.x.xx.x.", "x.x.x.x.xx.x.x.x"]);
        for (i = 0; i < 16; i++) if (s.charAt(i) === "x") p[base + i] = hit(i % 4 === 0 ? 108 : i % 2 ? 76 : 92, 1);
      } else if (style === "lazy") {
        for (i = 0; i < 16; i += 2) p[base + i] = hit(i % 4 === 0 ? 92 : 76, 1);
        if (rng.chance(0.5)) p[base + rng.pick([6, 10, 14])] = off();
        if (rng.chance(0.6)) p[base + rng.pick([3, 7, 11, 15])] = hit(64, 1);
      }
    }
    applyDensity(p, ctx);
    addRolls(p, ctx);
    return p;
  }
  function openSpots(ctx) {
    var rule = ctx.rule, bars = ctx.bars, rng = ctx.rng, out = [], b, base;
    for (b = 0; b < bars; b++) {
      base = b * 16;
      if (rule.open === "offbeat") {
        var all = rule.b === "house" || rng.chance(0.6);
        (all ? [2, 6, 10, 14] : [6, 14]).forEach(function (s) { out.push([base + s, 100]); });
      } else if (rule.open === "choke") {
        if (rng.chance(0.5)) out.push([base + rng.weighted([[15, 3.5], [7, 2.5], [14, 1.5], [6, 1.5], [11, 1]]), 92]);
      } else if (rule.open === "soft") {
        if (rng.chance(0.6)) out.push([base + rng.pick([6, 14]), 72]);
      } else if (b === bars - 1 && rng.chance(0.3)) out.push([base + 14, 88]);
    }
    return out;
  }
  function genHatOpen(ctx) {
    var p = empty(ctx.bars), closed = pad_(ctx, "hat_closed");
    openSpots(ctx).forEach(function (sv) {
      var s = sv[0];
      if (ctx.locked.hat_closed && closed && closed[s].v) {        // can't choke a locked closed hat: try a neighbour
        if (s + 1 < ctx.n && !closed[s + 1].v) s = s + 1; else if (s > 0 && !closed[s - 1].v) s = s - 1; else return;
      }
      p[s] = hit(sv[1], 1);
    });
    return p;
  }
  function genPerc(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng, rule = ctx.rule, bars = ctx.bars, i, b;
    var kick = pad_(ctx, "kick"), snare = pad_(ctx, "snare"), clap = pad_(ctx, "clap");
    var busy = [];
    for (i = 0; i < 16; i++) busy.push((kick && kick[i].v) || (snare && snare[i].v >= 100) || (clap && clap[i].v));
    var per = Math.round(rule.perc * 4 * (0.4 + ctx.density * 1.2));
    if (per > 4) per = 4;
    var cands = [];
    for (i = 0; i < 16; i++) if (!busy[i]) cands.push([i, i % 4 === 3 ? 3 : i % 4 === 1 ? 1.5 : i % 4 === 2 ? 2 : 0.5]);
    var bar = empty(1), accent = -1;
    for (var k = 0; k < per && cands.length; k++) {
      var s = rng.weighted(cands);
      cands = cands.filter(function (c) { return c[0] !== s; });
      bar[s] = hit(rng.range(78, 90), 1);
      if (accent < 0) accent = s;
    }
    if (accent >= 0) bar[accent] = hit(100, 1);
    for (b = 0; b < bars; b++) for (i = 0; i < 16; i++) p[b * 16 + i] = hit(bar[i].v, bar[i].r);
    if (bars > 1 && rng.chance(0.4) && cands.length) {   // vary the last bar
      var base = (bars - 1) * 16, hits = onIdx(bar, false);
      if (hits.length) { p[base + rng.pick(hits)] = off(); p[base + rng.weighted(cands)] = hit(88, 1); }
    }
    return p;
  }
  function genFx(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng;
    if (!rng.chance(ctx.rule.fx * 0.9)) return p;
    var last = (ctx.bars - 1) * 16;
    if (rng.chance(0.55)) { p[0] = hit(110, 1); if (ctx.bars > 1 && rng.chance(0.15)) p[last + 15] = hit(96, 1); }
    else p[last + rng.pick([14, 15, 12])] = hit(100, 1);
    return p;
  }
  function genTexture(ctx) {
    var p = empty(ctx.bars), rng = ctx.rng;
    if (!rng.chance(ctx.rule.tex)) return p;
    var s = rng.chance(0.3) ? 8 : 0;
    if (rng.chance(0.5)) for (var b = 0; b < ctx.bars; b++) p[b * 16 + s] = hit(90, 1);
    else p[s] = hit(96, 1);
    return p;
  }
  var GEN = { kick: genKick, "808": gen808, snare: genSnare, clap: genClap, hat_closed: genHatClosed, hat_open: genHatOpen, perc: genPerc, fx: genFx, texture: genTexture };

  // never an open hat and a closed hat on the same step: the open one wins (choke), unless the closed hat is locked
  function resolveHats(ctx) {
    var c = ctx.pads.hat_closed, o = ctx.pads.hat_open;
    if (!c || !o) return;
    for (var i = 0; i < ctx.n; i++) {
      if (!(c[i].v && o[i].v)) continue;
      if (!ctx.locked.hat_closed) c[i] = off();
      else if (!ctx.locked.hat_open) o[i] = off();
    }
  }

  /* ---------- templates (window.KillDrumGrooves) ---------- */
  function grooveList() {
    var g = null;
    try {
      if (typeof window !== "undefined" && window.KillDrumGrooves) g = window.KillDrumGrooves;
      else if (typeof require === "function" && typeof module !== "undefined") {
        try { g = require("./killdrum-grooves.js"); } catch (e) { g = null; }
      }
    } catch (e2) { g = null; }
    if (g && !Array.isArray(g) && Array.isArray(g.grooves)) g = g.grooves;
    return Array.isArray(g) ? g : [];
  }
  function groovesFor(genre, bpm) {
    var all = grooveList().filter(function (g) { return g && g.pads && g.genre === genre; });
    var near = all.filter(function (g) { return !g.bpm || !g.bpm.length || (bpm >= g.bpm[0] - 6 && bpm <= g.bpm[1] + 6); });
    return near.length ? near : all;
  }
  function fromGroove(g, bars) {
    var pads = {};
    SLOTS.forEach(function (slot) { pads[slot] = parse(g.pads[slot] || "", bars); });
    return pads;
  }
  function mutate(slot, src, ctx) {
    var p = clone(src), rng = ctx.rng, rule = ctx.rule, bars = ctx.bars, n = ctx.n, i, s, hits;
    if (slot === "kick") {
      if (ctx.locked["808"]) return kickFrom808(ctx);
      hits = onIdx(p, true);
      if (hits.length && rng.chance(0.4)) { i = rng.pick(hits); s = i + rng.pick([-1, 1]); if (s > 0 && s < n && !p[s].v && s % 16 !== 0) { p[s] = p[i]; p[i] = off(); } }
      if (rng.chance(0.3)) { s = (bars - 1) * 16 + rng.pick([14, 15]); if (!p[s].v) p[s] = hit(96, 1); }
      if (hits.length >= 3 && rng.chance(0.2)) p[rng.pick(onIdx(p, true))] = off();
      if (rule.b !== "rage" && !p[0].v) p[0] = hit(120, 1);
    } else if (slot === "808") {
      if (ctx.locked.kick || !count(p, 0, n)) return gen808(ctx);
      var kick = pad_(ctx, "kick");
      if (kick) for (i = 0; i < n; i++) if (kick[i].v && !p[i].v && rng.chance(0.35)) p[i] = hit(kick[i].v - 4, 1);
      if (rng.chance(0.4)) { s = rng.int(bars) * 16 + rng.pick([3, 11, 14, 15]); if (!p[s].v && !(kick && kick[s].v)) p[s] = hit(100, 1); }
      else if (rng.chance(0.3)) { hits = onIdx(p, true); if (hits.length > 1) p[rng.pick(hits)] = off(); }
      for (var b = 0; b < bars; b++) capBar(p, b, 5);
    } else if (slot === "snare") {
      addGhosts(p, ctx);
      if (rule.b === "drill" && ctx.half && rng.chance(0.3)) { s = rng.int(bars) * 16 + 14; p[s] = p[s].v ? off() : hit(100, 1); }
      if (rng.chance(bars > 1 ? 0.4 : 0.1)) fillInto(p, ctx);
      for (i = 0; i < n; i++) if (p[i].v && p[i].v < 70 && rng.chance(0.15)) p[i] = off();
    } else if (slot === "clap") {
      if (ctx.locked.snare || (!count(p, 0, n) && rng.chance(0.5))) return genClap(ctx);
      var snare = pad_(ctx, "snare");
      if (rng.chance(0.3)) { var c = [15, 14, 7, 6, 3]; for (i = 0; i < c.length; i++) { s = rng.int(bars) * 16 + c[i]; if (!p[s].v && !(snare && snare[s].v)) { p[s] = hit(90, 1); break; } } }
      else if (rng.chance(0.25) && count(p, 0, n) >= 2) p[rng.pick(onIdx(p, false))] = off();
    } else if (slot === "hat_closed") {
      applyDensity(p, ctx);
      for (i = 0; i < n; i++) if (p[i].r > 1 && rng.chance(0.3)) p[i] = hit(p[i].v, 1);
      addRolls(p, ctx);
    } else if (slot === "hat_open") {
      if (ctx.locked.hat_closed || rng.chance(0.3)) return genHatOpen(ctx);
      hits = onIdx(p, false);
      if (hits.length && rng.chance(0.3)) { i = rng.pick(hits); s = i + rng.pick([-1, 1, 8, -8]); if (s >= 0 && s < n && !p[s].v) { p[s] = p[i]; p[i] = off(); } }
    } else if (slot === "perc") {
      if (rng.chance(0.45) || !count(p, 0, n)) return genPerc(ctx);
      hits = onIdx(p, false);
      if (rng.chance(0.5)) { i = rng.pick(hits); s = i + rng.pick([-2, -1, 1, 2]); if (s >= 0 && s < n && !p[s].v) { p[s] = p[i]; p[i] = off(); } }
    } else if (slot === "fx") {
      if (rng.chance(0.5)) return genFx(ctx);
    } else if (slot === "texture") {
      if (rng.chance(0.5)) return genTexture(ctx);
    }
    return p;
  }

  /* ---------- names ---------- */
  function makeName(rule, rng) { return rng.pick(rule.names) + " " + rng.range(1, 9); }

  /* ---------- API ---------- */
  function beat(opts) {
    opts = opts || {};
    var rule = ruleFor(opts.genre), bars = clampBars(opts.bars == null ? 2 : opts.bars);
    var seed = opts.seed == null ? 1 : opts.seed;
    var density = opts.density == null ? 0.5 : Math.max(0, Math.min(1, +opts.density || 0));
    var rng = makeRng(seedOf("beat", seed, rule.id, bars, density));
    var pads = {}, locked = {}, lockedIn = opts.locked || {};
    SLOTS.forEach(function (slot) {
      var l = lockedIn[slot];
      if (!l || !l.length) return;
      pads[slot] = l.length === 16 * bars ? l : normalize(l, bars);   // exactly as given (repeat/trim only if the bar count differs)
      locked[slot] = true;
    });
    var ctx = makeCtx(rule, opts.bpm, bars, density, rng, pads, locked);
    var pool = (rule.half && !ctx.half) ? [] : groovesFor(rule.b, ctx.bpm), tpl = null;   // templates are written at genre tempo
    if (pool.length && rng.chance(0.7)) tpl = fromGroove(rng.pick(pool), bars);
    ORDER.forEach(function (slot) {
      if (locked[slot]) return;
      pads[slot] = tpl ? mutate(slot, tpl[slot], ctx) : GEN[slot](ctx);
    });
    resolveHats(ctx);
    return { name: makeName(rule, rng), genre: rule.id, bars: bars, pads: pads };
  }

  function pad(slot, opts) {
    opts = opts || {};
    slot = SLOTS.indexOf(slot) >= 0 ? slot : "kick";
    var rule = ruleFor(opts.genre), current = opts.beat && opts.beat[slot];
    var bars = clampBars(opts.bars == null ? (current && current.length ? current.length / 16 : 2) : opts.bars);
    var seed = opts.seed == null ? 1 : opts.seed, candidate = null, k;
    var bpm = +opts.bpm > 0 ? +opts.bpm : midBpm(rule);
    var pool = (rule.half && bpm < 100) ? [] : groovesFor(rule.b, bpm);
    for (k = 0; k < 8; k++) {
      var rng = makeRng(seedOf("pad", seed, rule.id, bars, slot, k));
      var pads = {}, locked = {};
      SLOTS.forEach(function (s) {
        if (s === slot || !opts.beat || !opts.beat[s]) return;
        pads[s] = opts.beat[s].length === 16 * bars ? opts.beat[s] : normalize(opts.beat[s], bars);
        locked[s] = true;
      });
      var ctx = makeCtx(rule, opts.bpm, bars, opts.density == null ? 0.5 : +opts.density, rng, pads, locked);
      if (pool.length && k % 2 === 1) candidate = mutate(slot, parse(rng.pick(pool).pads[slot] || "", bars), ctx);
      else candidate = GEN[slot](ctx);
      if (slot === "hat_closed" && pads.hat_open) for (var i = 0; i < ctx.n; i++) if (pads.hat_open[i].v) candidate[i] = off();
      if (!current || !same(candidate, current)) return candidate;
    }
    return candidate;
  }

  function timeFactor(slot) { return slot === "kick" || slot === "808" ? 0.25 : slot === "snare" || slot === "clap" ? 0.6 : 1; }

  function toNotes(pads, opts) {
    opts = opts || {}; pads = pads || {};
    var noteOf = opts.noteOf || NOTE_OF;
    var first = null;
    for (var key in pads) if (pads[key] && pads[key].length) { first = pads[key]; break; }
    var bars = clampBars(opts.bars == null ? (first ? first.length / 16 : 1) : opts.bars);
    var patBeats = bars * 4, n = bars * 16;
    var clipBeats = +opts.clipBeats > 0 ? +opts.clipBeats : patBeats;
    var swing = Math.max(0, Math.min(1, +opts.swing || 0)), hum = Math.max(0, Math.min(1, +opts.humanize || 0));
    var rng = makeRng(seedOf("notes", opts.seed == null ? 0 : opts.seed));
    var notes = [], slots = SLOTS.filter(function (s) { return pads[s]; });
    Object.keys(pads).forEach(function (s) { if (slots.indexOf(s) < 0) slots.push(s); });
    slots.forEach(function (slot) {
      var pitch = noteOf[slot];
      if (pitch == null || !pads[slot]) return;
      var pat = normalize(pads[slot], bars), tf = timeFactor(slot);
      var sustain = slot === "808" || slot === "fx" || slot === "texture", hits = [], rep, i, k;
      for (rep = 0; rep * patBeats < clipBeats; rep++) {
        for (i = 0; i < n; i++) {
          var st = pat[i];
          if (!st.v) continue;
          var base = rep * patBeats + (i + (st.o || 0)) * 0.25;
          if (base >= clipBeats) break;
          var sw = (i & 1) && !st.o ? swing * 0.0833 : 0, r = st.r;
          var spacing = r > 1 ? (0.25 - sw) * 0.8 / r : 0;   // r hits evenly spaced, kept inside the (swung) 16th
          for (k = 0; k < r; k++) {
            var start = base + sw + k * spacing;
            var vel = r > 1 ? st.v * (0.7 + 0.3 * k / (r - 1)) : st.v;
            if (hum > 0) { start += (rng.next() * 2 - 1) * hum * 0.02 * tf; vel += (rng.next() * 2 - 1) * hum * 12; }
            if (start < 0) start = 0;
            vel = Math.round(vel); if (vel < 1) vel = 1; if (vel > 127) vel = 127;
            hits.push({ start: start, vel: vel, len: 0.25 / r * 0.9, st: st, sub: k });
          }
        }
      }
      for (i = 0; i < hits.length; i++) {
        var h = hits[i], len = h.len;
        if (sustain) {
          var next = i + 1 < hits.length ? hits[i + 1].start : hits[0].start + clipBeats;
          len = Math.min(4, next - h.start, clipBeats - h.start);
          if (!(len > 0.05)) len = h.len;
        }
        var nt = { pitch: pitch, start: h.start, length: len, velocity: h.vel };
        if (h.st.c != null && h.st.c < 1) nt.chance = h.st.c;
        if (h.st.t) nt.tune = h.st.t;
        if (h.st.g && !h.sub) nt.slide = 1;
        if (!h.sub && h.st.l > 0) { nt.len = Math.min(h.st.l * 0.25, clipBeats - h.start); nt.length = nt.len; }
        if (!h.sub && h.st.bend) nt.bend = h.st.bend;
        if (!h.sub && h.st.wob) nt.wob = h.st.wob;
        if (!h.sub && h.st.ft) nt.ft = h.st.ft;
        if (h.st.o) nt.o = h.st.o;
        if (h.st.u) nt.u = h.st.u;
        notes.push(nt);
      }
    });
    notes.sort(function (a, b) { return a.start - b.start || a.pitch - b.pitch; });
    return notes;
  }

  function fromNotes(notes, opts) {
    opts = opts || {};
    var bars = clampBars(opts.bars == null ? 1 : opts.bars), n = bars * 16, noteOf = opts.noteOf || NOTE_OF;
    var slotOf = {}, pads = {}, cnt = {}, slot;
    for (slot in noteOf) { slotOf[noteOf[slot]] = slot; pads[slot] = empty(bars); cnt[slot] = new Array(n); }
    (notes || []).forEach(function (note) {
      if (!note) return;
      slot = slotOf[note.pitch];
      var start = +note.start;
      if (!slot || !(start >= 0 || start < 0) || !(start < bars * 4)) return;
      var step = Math.floor((start - (note.o > 0 ? note.o * 0.25 : 0)) * 4 + 0.15);   // tolerant floor: swing (late) and roll sub-hits still land in their step
      if (step < 0) step = 0;
      if (step >= n) return;
      var v = clampV(note.velocity == null ? 100 : note.velocity);
      if (v < 1) v = 1;
      var c = cnt[slot][step] || 0;
      cnt[slot][step] = c + 1;
      pads[slot][step] = extras(hit(Math.max(v, pads[slot][step].v), Math.min(4, c + 1)), c ? pads[slot][step] : { c: note.chance, t: note.tune, g: note.slide, o: note.o, u: note.u, l: note.len > 0 ? note.len / 0.25 : 0, bend: note.bend, wob: note.wob, ft: note.ft });
    });
    return pads;
  }

  /* ---------- COMPLEXITY + 808 FIT (Eman, 15 Nov 2026) ----------
     shape(opts) reshapes a rolled beat: which rows play (2-3 at SIMPLE, up to 16 rows with extra lines at CRAZY),
     how busy each row is, and whether the style gets an 808 at all.
     opts = { pads, lines, locked: {slot: true}, genre, bars, bpm, seed, cx: 0..1, sub: "auto" | "on" | "off" }
     -> { pads, lines, sub808: bool, rows: n }. Pure + seeded: same inputs, same beat. */
  // how often a style rolls an 808 when the 808 switch is on AUTO
  var SUB_ODDS = { trap: 1, rage: 1, drill: 1, jersey: 0.55, crystal: 0.5, house: 0.4, boombap: 0.3, dnb: 0.3, techno: 0.2, lofi: 0.15 };
  var MAX_ROWS = 16;
  function anyHit(p) { if (!p) return false; for (var i = 0; i < p.length; i++) if (p[i] && p[i].v) return true; return false; }
  function rowsTarget(cx, rng) {
    var lo = 2 + 10 * Math.pow(cx, 1.5), hi = 3 + 13 * Math.pow(cx, 1.15);
    var t = Math.floor(lo + rng.next() * (hi - lo + 1));
    return t < 2 ? 2 : t > MAX_ROWS ? MAX_ROWS : t;
  }
  function shape(opts) {
    opts = opts || {};
    var rule = ruleFor(opts.genre), bars = clampBars(opts.bars || 1), n = 16 * bars;
    var cx = Math.max(0, Math.min(1, opts.cx == null ? 0.5 : +opts.cx));
    var rng = makeRng(seedOf("cx", opts.seed == null ? 1 : opts.seed, rule.id, bars, Math.round(cx * 100), opts.sub || "auto"));
    var locked = opts.locked || {}, pads = {}, lines = {}, s, i, k;
    SLOTS.forEach(function (slot) { pads[slot] = normalize(opts.pads && opts.pads[slot] || [], bars); });
    // extra lines: a locked pad keeps its own, a rolled pad starts clean
    for (s in (opts.lines || {})) if (locked[s] && Array.isArray(opts.lines[s])) lines[s] = opts.lines[s].map(function (l) { return normalize(l, bars); });
    var ctx = makeCtx(rule, opts.bpm, bars, 0.5, rng, pads, {});
    SLOTS.forEach(function (slot) { ctx.locked[slot] = true; });
    var regen = function (slot) { ctx.locked[slot] = false; var p = GEN[slot](ctx); ctx.locked[slot] = true; return p; };

    // 1. the 808: only in styles where it fits (or the switch says so). A rolled 808 never sticks from the last roll.
    var has808;
    if (locked["808"]) has808 = anyHit(pads["808"]);
    else {
      var sub = opts.sub === "on" ? true : opts.sub === "off" ? false : rng.next() < (rule.subOdds != null ? rule.subOdds : SUB_ODDS[rule.b] == null ? 0.3 : SUB_ODDS[rule.b]);
      if (!sub) pads["808"] = empty(bars);
      else if (!anyHit(pads["808"])) {
        if (/^(trap|rage|drill|jersey)$/.test(rule.b) || !anyHit(pads.kick)) pads["808"] = regen("808");
        else pads["808"] = pads.kick.map(function (st, j) { return st.v && (j % 16 === 0 || rng.chance(0.7)) ? hit(st.v - 6, 1) : off(); });   // follows the kick
        if (!anyHit(pads["808"])) pads["808"][0] = hit(112, 1);
      }
      has808 = sub;
    }
    var bass = /^(trap|rage|drill)$/.test(rule.b);

    // 2. which rows play
    var core = [rule.b === "rage" && has808 ? "808" : "kick", rule.clapPrimary ? "clap" : "snare"];
    if (bass && has808 && core[0] !== "808") core.push("808");
    core.push("hat_closed");
    if (has808 && core.indexOf("808") < 0) core.push("808");
    var restW = { snare: 1, clap: 1.2, hat_open: 1.4, perc: 1.3, fx: 0.8, texture: 0.7, kick: 0.6 };
    if (rule.b === "lofi") restW.texture = 3;
    if (rule.b === "crystal") { restW.fx = 2; restW.texture = 1.6; }
    if (rule.b === "jersey") restW.perc = 2.5;
    if (rule.b === "house" || rule.b === "techno") restW.hat_open = 2.5;
    var rest = SLOTS.filter(function (x) { return core.indexOf(x) < 0 && x !== "808"; }), order = core.slice();
    while (rest.length) {
      var w = rest.map(function (x) { return [x, restW[x] || 1]; }), pk = rng.weighted(w);
      order.push(pk); rest.splice(rest.indexOf(pk), 1);
    }
    var target = rowsTarget(cx, rng);
    if (opts.sub === "on" && order.indexOf("808") >= target) target = order.indexOf("808") + 1;
    var lockedRows = 0;
    SLOTS.forEach(function (x) { if (locked[x]) lockedRows += (anyHit(pads[x]) ? 1 : 0) + (lines[x] ? lines[x].length : 0); });
    var room = target - lockedRows, keep = {};
    order.forEach(function (x) { if (locked[x]) return; if (room > 0) { keep[x] = true; room--; } });
    SLOTS.forEach(function (x) {
      if (locked[x]) return;
      if (!keep[x]) { pads[x] = empty(bars); return; }
      if (!anyHit(pads[x])) {   // a row the roll needs that came back empty: give it something
        var p = regen(x);
        if (!anyHit(p)) { p = empty(bars); p[x === "texture" || x === "fx" ? 0 : x === "hat_open" ? 14 : x === "perc" ? 11 : x === "clap" ? 12 : 4] = hit(96, 1); }
        pads[x] = p;
      }
    });
    if (opts.sub !== "on" && !locked["808"]) has808 = anyHit(pads["808"]);

    // extra lines on top (dense rolls): same pad, another part of it, often pitched
    var rows = 0; SLOTS.forEach(function (x) { rows += (anyHit(pads[x]) ? 1 : 0) + (lines[x] ? lines[x].length : 0); });
    var lineOrder = ["hat_closed", "perc", "snare", "perc", "clap", "hat_closed", "kick", "fx", "hat_open", "texture", "perc", "snare", "clap"];
    if (has808) lineOrder.splice(4, 0, "808");
    var crazy = cx > 0.86;
    for (k = 0; rows < target && k < lineOrder.length * 2; k++) {
      var ls = lineOrder[k % lineOrder.length];
      if (locked[ls] || !anyHit(pads[ls]) || (lines[ls] && lines[ls].length >= 3)) continue;
      var ln = makeLine(ls, (lines[ls] || []).length, pads, ctx, rng, crazy);
      if (!anyHit(ln)) continue;
      (lines[ls] = lines[ls] || []).push(ln); rows++;
    }

    // 3. how busy each row is
    SLOTS.forEach(function (x) {
      if (locked[x]) return;
      busy(x, pads[x], cx, ctx, rng);
      (lines[x] || []).forEach(function (l) { busy(x, l, cx, ctx, rng); });
    });
    if (crazy) madness(pads, lines, locked, cx, ctx, rng);
    // never a closed and an open hat on one step (the open one wins)
    for (i = 0; i < n; i++) if (!locked.hat_closed && pads.hat_open[i].v && pads.hat_closed[i].v) pads.hat_closed[i] = off();
    rows = 0; SLOTS.forEach(function (x) { rows += (anyHit(pads[x]) ? 1 : 0) + (lines[x] ? lines[x].length : 0); });
    return { pads: pads, lines: lines, sub808: has808, rows: rows, target: target };
  }
  // another line for a pad: a different part of it, never on the pad's own hits
  function makeLine(slot, k, pads, ctx, rng, crazy) {
    var n = ctx.n, main = pads[slot], p = empty(ctx.bars), i, b;
    var free = function (j) { return j >= 0 && j < n && !main[j].v && !p[j].v; };
    var put = function (j, v, t, r) { if (free(j)) { p[j] = hit(v, r || 1); if (t) p[j].t = t; } };
    var poly = crazy && rng.chance(0.5) ? rng.pick([3, 5, 7]) : 0;
    if (poly) {   // a cycle of 3, 5 or 7 steps across the bar line
      var t0 = rng.pick([0, 3, 5, 7, 12, -5]);
      for (i = rng.int(poly); i < n; i += poly) put(i, rng.range(70, 100), t0);
      return p;
    }
    if (slot === "hat_closed") {
      var tt = k ? rng.pick([5, 7, 12]) : rng.pick([0, 2, -2]);
      if (rng.chance(0.5)) for (i = 1; i < n; i += 2) { if (rng.chance(0.7)) put(i, rng.range(52, 72), tt); }
      else for (b = 0; b < ctx.bars; b++) { put(b * 16 + rng.pick([3, 7, 11, 15]), 84, tt, rng.pick([2, 3, 4])); put(b * 16 + rng.pick([5, 9, 13]), 70, tt, 2); }
    } else if (slot === "perc") {
      var tp = rng.pick([-5, 3, 5, 7, 12, -7]);
      for (b = 0; b < ctx.bars; b++) { var cnt = rng.range(2, 4); for (i = 0; i < cnt; i++) put(b * 16 + rng.pick([1, 2, 3, 5, 6, 9, 10, 11, 13, 14, 15]), rng.range(74, 96), tp); }
    } else if (slot === "snare") {
      for (b = 0; b < ctx.bars; b++) { put(b * 16 + rng.pick([3, 7, 10, 15]), rng.range(44, 60)); put(b * 16 + rng.pick([2, 6, 11, 14]), rng.range(44, 60)); }
      if (rng.chance(0.5)) put(n - 2, 90, rng.pick([0, 2, 5]), 2);
    } else if (slot === "clap") {
      for (b = 0; b < ctx.bars; b++) put(b * 16 + rng.pick([7, 10, 14, 15]), 92, rng.pick([0, -2, 3]));
    } else if (slot === "kick") {
      for (b = 0; b < ctx.bars; b++) put(b * 16 + rng.pick([3, 7, 9, 13, 15]), rng.range(72, 92));
    } else if (slot === "808") {
      for (b = 0; b < ctx.bars; b++) put(b * 16 + rng.pick([3, 7, 11, 14]), 100, rng.pick([7, 12, -5, 3]));
    } else if (slot === "hat_open") {
      for (b = 0; b < ctx.bars; b++) put(b * 16 + rng.pick([2, 6, 10, 14]), 80, rng.pick([-3, 2, 5]));
    } else if (slot === "fx") {
      put(rng.int(ctx.bars) * 16 + rng.pick([0, 8, 12]), 100, rng.pick([-7, 7, 12]));
    } else if (slot === "texture") {
      put(rng.chance(0.5) ? 8 : 4, 92, rng.pick([12, -12, 7]));
    }
    return p;
  }
  // SIMPLE thins a row (no ghosts, no rolls, 8th hats), MID leaves it, past MID it gets busier
  function busy(slot, p, cx, ctx, rng) {
    var n = p.length, i;
    if (!anyHit(p)) return;
    if (cx < 0.4) {
      var a = (0.4 - cx) / 0.4;
      for (i = 0; i < n; i++) {
        if (!p[i].v) continue;
        if (p[i].r > 1 && rng.chance(a)) p[i] = extras(hit(p[i].v, 1), p[i]);
        if (p[i].v < 70 && rng.chance(a)) { p[i] = off(); continue; }
        if (p[i].o && rng.chance(a)) delete p[i].o;
        if (/^hat/.test(slot) && i % 2 === 1 && rng.chance(a)) p[i] = off();
        else if (slot === "hat_closed" && a > 0.6 && i % 4 === 2 && rng.chance(a - 0.4)) p[i] = off();
        else if (slot === "kick" && i % 4 !== 0 && rng.chance(a * 0.45)) p[i] = off();
        else if (slot === "snare" && p[i].v < 100 && rng.chance(a)) p[i] = off();
        else if (/^(perc|fx|texture|clap)$/.test(slot) && i % 16 !== 0 && rng.chance(a * 0.4)) p[i] = off();
      }
      if (!anyHit(p) && slot !== "808") p[slot === "snare" || slot === "clap" ? (ctx.half ? 8 : 4) : 0] = hit(104, 1);
    } else if (cx > 0.6) {
      var b = (cx - 0.6) / 0.4;
      for (i = 0; i < n; i++) {
        var st = p[i];
        if (slot === "hat_closed") {
          if (!st.v && rng.chance(b * 0.5)) p[i] = hit(rng.range(58, 80), 1);
          else if (st.v && i % 4 === 3 && rng.chance(b * 0.3)) p[i] = extras(hit(st.v, rng.pick([2, 3, 4])), st);
        } else if (slot === "snare" && !st.v && i % 2 === 1 && rng.chance(b * 0.18)) p[i] = hit(rng.range(42, 60), 1);
        else if (slot === "kick" && !st.v && i % 2 === 1 && rng.chance(b * 0.1)) p[i] = hit(rng.range(80, 100), 1);
        else if (slot === "perc" && !st.v && rng.chance(b * 0.12)) p[i] = hit(rng.range(70, 95), 1);
        else if (slot === "perc" && st.v && b > 0.4 && !st.t && rng.chance(b * 0.5)) p[i].t = rng.pick([-5, 3, 5, 7, 12]);
      }
    }
  }
  // CRAZY: off-grid hits, ratchets, chance, pitched snare runs, polyrhythm, a drop-out
  function madness(pads, lines, locked, cx, ctx, rng) {
    var m = (cx - 0.86) / 0.14, n = ctx.n, i, OFF = [1 / 3, 0.5, 2 / 3];
    var all = [];
    SLOTS.forEach(function (x) { if (!locked[x]) { all.push([x, pads[x]]); (lines[x] || []).forEach(function (l) { all.push([x, l]); }); } });
    all.forEach(function (e) {
      var x = e[0], p = e[1];
      for (i = 0; i < n; i++) {
        if (!p[i].v) continue;
        if (i % 4 !== 0 && rng.chance(0.18 + 0.2 * m)) p[i].o = rng.pick(OFF);
        if (rng.chance(0.08 + 0.12 * m)) p[i].r = rng.pick([2, 3, 4]);
        if (x !== "kick" && i % 8 !== 0 && rng.chance(0.15 + 0.2 * m)) p[i].c = rng.pick([0.25, 0.5, 0.75]);
        if (/^(snare|clap|perc|hat_open)$/.test(x) && rng.chance(0.1 + 0.15 * m)) p[i].t = rng.pick([-12, -7, -5, 5, 7, 12]);
      }
    });
    // a pitched snare run into the loop point
    if (!locked.snare) { var st0 = n - rng.pick([4, 6, 8]); for (i = st0; i < n; i++) { pads.snare[i] = hit(70 + (i - st0) * 6, rng.pick([1, 2, 3])); pads.snare[i].t = (i - st0) * 2 - 4; } }
    // a cycle of 3 or 5 accents across the closed hats, soft hats filling the gaps
    if (!locked.hat_closed && rng.chance(0.6)) { var c = rng.pick([3, 5]); for (i = 0; i < n; i++) if (i % c === 0) pads.hat_closed[i] = hit(118, rng.chance(0.3) ? rng.pick([2, 3]) : 1); else if (!pads.hat_closed[i].v && rng.chance(0.5)) pads.hat_closed[i] = hit(rng.range(50, 70), 1); }
    // a drop-out: half a beat to a beat where only the low end and texture play
    if (rng.chance(0.3 + 0.2 * m)) {
      var at = rng.int(ctx.bars) * 16 + rng.pick([6, 10, 12]), len = rng.pick([2, 3, 4]);
      all.forEach(function (e) { if (!/^(808|texture)$/.test(e[0])) for (i = at; i < Math.min(n, at + len); i++) e[1][i] = off(); });
    }
  }

  /* ---------- SONG ARRANGEMENT (Eman, 15 Nov 2026) ----------
     A long KILLDRUM clip (a minute, three minutes...) rolls like a song: intro, verse, hook, break, build, drop, outro.
     The form comes from the analysed songs (window.KillDrumForms, the audio analysis' sections + energy per section)
     or from basic genre knowledge (how trap / house / dnb ... songs are usually built), then is fitted to the clip.
     arrange(opts) opts = { loop: pads of the rolled loop (loopBars), loopLines, loopBars, bars: the clip's bars, genre,
     bpm, seed, cx, sub808: bool, sad: 0..1, locked: { slot: full-length steps } } -> { pads, lines, sections } */
  var SEC_NAME = { i: "Intro", v: "Verse", p: "Pre", c: "Hook", P: "Post", b: "Bridge", k: "Break", n: "Instr", o: "Outro", A: "Theme A", B: "Theme B", V: "Variation", u: "Build", d: "Drop" };
  // basic knowledge: how songs in each style are usually laid out ([code, bars, energy 0..9]); "full" = starts on the hook
  var GENRE_FORMS = {
    trap: [[["i", 4, 3], ["c", 8, 9], ["v", 16, 7], ["c", 8, 9], ["v", 16, 7], ["c", 8, 9], ["o", 4, 2]], [["c", 8, 9], ["v", 16, 6], ["c", 8, 9], ["b", 8, 4], ["c", 8, 9], ["o", 4, 2]], [["i", 8, 2], ["v", 16, 6], ["c", 8, 9], ["v", 16, 7], ["k", 4, 1], ["c", 8, 9], ["o", 8, 2]]],
    drill: [[["i", 8, 3], ["c", 8, 9], ["v", 16, 7], ["c", 8, 9], ["v", 16, 7], ["c", 8, 9], ["o", 4, 2]], [["c", 8, 9], ["v", 16, 7], ["c", 8, 9], ["k", 4, 2], ["v", 8, 7], ["c", 8, 9], ["o", 4, 2]]],
    rage: [[["i", 4, 4], ["d", 8, 9], ["v", 8, 7], ["d", 8, 9], ["k", 4, 2], ["d", 8, 9], ["o", 4, 3]], [["d", 8, 9], ["v", 16, 7], ["d", 8, 9], ["v", 8, 6], ["d", 16, 9], ["o", 4, 2]]],
    jersey: [[["i", 4, 4], ["c", 8, 9], ["v", 8, 7], ["c", 8, 9], ["k", 4, 3], ["c", 8, 9], ["o", 4, 3]], [["c", 8, 9], ["v", 8, 7], ["u", 4, 6], ["c", 16, 9], ["o", 4, 3]]],
    lofi: [[["i", 4, 3], ["v", 16, 6], ["c", 8, 7], ["v", 16, 6], ["c", 8, 7], ["o", 4, 2]], [["i", 8, 2], ["A", 16, 6], ["B", 8, 5], ["A", 16, 6], ["o", 8, 2]]],
    boombap: [[["i", 4, 4], ["v", 16, 7], ["c", 8, 8], ["v", 16, 7], ["c", 8, 8], ["v", 16, 7], ["c", 8, 8], ["o", 4, 3]]],
    house: [[["i", 16, 4], ["u", 8, 6], ["d", 16, 9], ["k", 8, 2], ["u", 8, 7], ["d", 16, 9], ["o", 16, 4]], [["i", 8, 5], ["v", 16, 7], ["k", 8, 3], ["d", 16, 9], ["v", 8, 7], ["d", 16, 9], ["o", 8, 4]]],
    techno: [[["i", 16, 5], ["v", 16, 7], ["u", 8, 7], ["d", 32, 9], ["k", 16, 3], ["d", 32, 9], ["o", 16, 5]]],
    crystal: [[["i", 8, 3], ["v", 8, 6], ["c", 8, 9], ["k", 4, 2], ["v", 8, 6], ["c", 8, 9], ["o", 4, 3]], [["c", 8, 9], ["v", 8, 6], ["c", 8, 9], ["b", 8, 4], ["c", 16, 9], ["o", 4, 2]]],
    dnb: [[["i", 16, 3], ["u", 8, 6], ["d", 32, 9], ["k", 16, 2], ["u", 8, 7], ["d", 32, 9], ["o", 16, 3]]]
  };
  function formsData() {
    try {
      if (typeof window !== "undefined" && window.KillDrumForms) return window.KillDrumForms;
      if (typeof require === "function" && typeof module !== "undefined") return require("./killdrum-forms.js");
    } catch (e) { /* none */ }
    return null;
  }
  function parseForm(str) {
    return String(str).split(" ").map(function (t) { var m = /^([a-zA-Z])(\d+):(\d)$/.exec(t); return m ? [m[1], +m[2], +m[3]] : null; }).filter(Boolean);
  }
  // pick a form: an analysed song near the tempo (and the mood) or the style's basics
  function pickForm(rule, bpm, sad, rng) {
    var F = formsData(), edm = /^(house|techno|dnb)$/.test(rule.b), basics = GENRE_FORMS[rule.b] || GENRE_FORMS.trap;
    var useSongs = F && F.songs && F.songs.length && rng.chance(edm ? 0.3 : 0.6), form = null, from = "basics";
    if (useSongs) {
      var pool = [], tot = 0;
      F.songs.forEach(function (s) {
        var d = Math.min(Math.abs(Math.log(s[0] / bpm)), Math.abs(Math.log(s[0] * 2 / bpm)), Math.abs(Math.log(s[0] / 2 / bpm)));
        var w = Math.max(0.03, 1 - d / 0.15) * (1 - 0.5 * Math.abs(s[1] / 9 - sad));
        pool.push([s, w]); tot += w;
      });
      var s0 = rng.weighted(pool); form = parseForm(s0[2]); from = "song";
    }
    if (!form || form.length < 2) form = rng.pick(basics).map(function (x) { return x.slice(); });
    // mood (basic knowledge): dark / sad songs breathe more (a longer, quieter intro and a break before the last hook)
    if (from === "basics" && sad > 0.6 && form[0][0] === "i") { form[0][1] = Math.max(form[0][1], 8); form[0][2] = Math.min(form[0][2], 2); }
    return { form: form, from: from };
  }
  var SNAP = [2, 4, 8, 12, 16, 24, 32];
  function snapBars(b) { var best = 4, bd = 1e9; SNAP.forEach(function (x) { var d = Math.abs(x - b); if (d < bd) { bd = d; best = x; } }); return best; }
  // the form fitted to exactly `bars` bars: the middle repeats when the clip is longer, the end is cut when shorter
  function fitForm(form, bars) {
    var f = form.map(function (x) { return [x[0], snapBars(x[1]), x[2]]; });
    var hasI = f[0][0] === "i", hasO = f[f.length - 1][0] === "o";
    var body = f.slice(hasI ? 1 : 0, hasO ? f.length - 1 : f.length);
    if (!body.length) body = f.slice();
    var total = function (a) { return a.reduce(function (n, x) { return n + x[1]; }, 0); };
    var seq = (hasI ? [f[0]] : []).concat(body);
    var guard = 0;
    while (total(seq) + (hasO ? f[f.length - 1][1] : 0) < bars && guard++ < 64) {
      var j = body.length > 2 ? Math.floor(body.length / 3) : 0;
      while (j < body.length - 1 && body[j][0] === seq[seq.length - 1][0]) j++;   // never the same section twice in a row
      seq = seq.concat(body.slice(j).map(function (x) { return x.slice(); }));
    }
    if (hasO) seq.push(f[f.length - 1].slice());
    var out = [], at = 0;
    for (var i = 0; i < seq.length && at < bars; i++) { var b = Math.min(seq[i][1], bars - at); out.push([seq[i][0], b, seq[i][2]]); at += b; }
    // end on an outro when there's room for one
    var last = out[out.length - 1];
    if (bars >= 16 && last && last[0] !== "o" && hasO) {
      var ob = Math.min(4, last[1]); if (last[1] > ob) { last[1] -= ob; out.push(["o", ob, Math.min(3, last[2])]); } else last[0] = "o";
    }
    // the same section twice in a row at the same energy reads as one longer section
    for (var m = out.length - 1; m > 0; m--) if (out[m][0] === out[m - 1][0] && out[m][2] === out[m - 1][2]) { out[m - 1][1] += out[m][1]; out.splice(m, 1); }
    // a very short last piece joins the one before
    if (out.length > 1 && out[out.length - 1][1] < 2) { var x = out.pop(); out[out.length - 1][1] += x[1]; }
    return out;
  }
  function arrange(opts) {
    var rule = ruleFor(opts.genre), L = clampBars(opts.loopBars || 2), N = clampBars(opts.bars), n = 16 * N;
    var rng = makeRng(seedOf("song", opts.seed == null ? 1 : opts.seed, rule.id, N));
    var picked = pickForm(rule, +opts.bpm || midBpm(rule), opts.sad == null ? 0.5 : +opts.sad, rng), form = fitForm(picked.form, N);
    var locked = opts.locked || {}, lockLoop = {}, s, i, k;
    SLOTS.forEach(function (x) { if (locked[x]) lockLoop[x] = true; });
    var pads = {}, lines = {}, sections = [], cache = {};
    SLOTS.forEach(function (x) { pads[x] = locked[x] ? normalize(locked[x], N) : empty(N); });
    var cx = opts.cx == null ? 0.5 : +opts.cx, at = 0;
    form.forEach(function (sec, si) {
      var code = sec[0], bars = sec[1], e = sec[2] / 9, key = code + ":" + sec[2];
      var part = cache[key];
      if (!part) {   // the same kind of section at the same energy plays the same pattern (verse 2 = verse 1)
        var ecx = Math.max(0, Math.min(1, cx + (e - 0.62) * 0.9));
        part = shape({ pads: opts.loop, lines: opts.loopLines || {}, locked: lockLoop, genre: rule.id, bars: L, bpm: opts.bpm, seed: seedOf(opts.seed, key), cx: ecx, sub: opts.sub808 ? "on" : "off" });
        var quiet = e < 0.5;
        if ((code === "i" || code === "k" || code === "b" || code === "o") && quiet) {   // no low end in a quiet intro / break / outro
          ["kick", "808"].forEach(function (x) { if (!lockLoop[x]) { part.pads[x] = empty(L); delete part.lines[x]; } });
          if (code !== "o" && !lockLoop.snare) for (i = 0; i < 16 * L; i++) if (part.pads.snare[i].v && rng.chance(0.5)) part.pads.snare[i] = off();
          var left = SLOTS.some(function (x) { return anyHit(part.pads[x]); });
          if (!left) { part.pads.hat_closed = empty(L); for (i = 0; i < 16 * L; i += 4) part.pads.hat_closed[i] = hit(80, 1); }
        }
        cache[key] = part;
      }
      var a = at * 16, len = bars * 16, src = part;
      SLOTS.forEach(function (x) {
        if (locked[x]) return;
        for (i = 0; i < len; i++) { var st = src.pads[x][i % (16 * L)]; pads[x][a + i] = st.v ? extras(hit(st.v, st.r), st) : off(); }
        (src.lines[x] || []).forEach(function (ln, li) {
          var arr = lines[x] = lines[x] || [];
          while (arr.length <= li) arr.push(empty(N));
          for (i = 0; i < len; i++) { var q = ln[i % (16 * L)]; arr[li][a + i] = q.v ? extras(hit(q.v, q.r), q) : off(); }
        });
      });
      // builds and pre-hooks climb: a snare run over their last bar(s)
      if ((code === "u" || code === "p") && !locked.snare && bars >= 2) {
        var runLen = bars >= 8 ? 32 : 16, rs = a + len - runLen;
        for (i = rs; i < a + len; i++) if (i >= a) pads.snare[i] = hit(60 + Math.round(60 * (i - rs) / runLen), (i - rs) > runLen * 0.75 ? 2 : 1);
      }
      // into a louder section: a fill on the last beat, then a crash (FX) on its first step
      var nx = form[si + 1];
      if (nx && nx[2] >= sec[2] && code !== "u" && code !== "p") {
        var f0 = a + len - 4, fs = locked.snare ? (locked.clap ? null : "clap") : "snare";
        if (fs) for (i = f0; i < a + len; i++) if (rng.chance(0.75)) pads[fs][i] = hit(84 + (i - f0) * 9, rng.chance(0.35) ? 2 : 1);
      }
      if (si > 0 && e >= 0.75 && !locked.fx && anyHit(opts.loop && opts.loop.fx || []) ) pads.fx[a] = hit(112, 1);
      sections.push({ code: code, name: SEC_NAME[code] || code, start: at, bars: bars, energy: sec[2] });
      at += bars;
    });
    // an outro ends on one big hit
    var lastSec = sections[sections.length - 1];
    if (lastSec && lastSec.code === "o" && lastSec.bars >= 2) {
      var e0 = (N - 1) * 16;
      SLOTS.forEach(function (x) { if (!locked[x]) for (i = e0; i < n; i++) pads[x][i] = off(); (lines[x] || []).forEach(function (ln) { for (i = e0; i < n; i++) ln[i] = off(); }); });
      if (!locked.kick) pads.kick[e0] = hit(120, 1);
      if (opts.sub808 && !locked["808"]) pads["808"][e0] = hit(116, 1);
      if (!locked.fx && anyHit(opts.loop && opts.loop.fx || [])) pads.fx[e0] = hit(110, 1);
    }
    for (s in lines) lines[s] = lines[s].filter(anyHit);
    return { pads: pads, lines: lines, sections: sections, from: picked.from };
  }

  var API = {
    GENRES: GENRES.map(function (g) { return { id: g.id, label: g.label, bpm: g.bpm.slice(), feel: g.feel, mood: OLD_LIST ? undefined : g.mood, b: g.b, vibe: g.vibe }; }),
    MOODS: OLD_LIST ? [] : MOODS.map(function (m) { return { id: m.id, title: m.title }; }), baseOf: baseOf,
    SLOTS: SLOTS.slice(),
    NOTE_OF: NOTE_OF,
    beat: beat,
    pad: pad,
    toNotes: toNotes,
    fromNotes: fromNotes,
    empty: empty,
    parse: parse,
    str: str,
    same: same,
    grooves: grooveList,
    shape: shape,
    arrange: arrange,
    SEC_NAME: SEC_NAME,
    SUB_ODDS: SUB_ODDS
  };
  if (typeof window !== "undefined") window.KillDrumPatterns = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
