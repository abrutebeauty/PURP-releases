/*
  TOY MACHINE ARP library: named step patterns and the dice.
  Shared by the ARP page (ui/toymachine.js) and the drop zone's ARP mode (ui/toymachine-dropzone.js).
  A pattern is what goes into the preset's "arp" (format in Source/dsp/toymachine/TmArp.h):
    { name, family, about, order, rate, octaves?, swing?, gate?, steps: [{ n, oct?, gate?, vel?, ratchet?, slide?, prob? }] }
  n = which held note (0 = first after `order`, wraps an octave up), "next" = the order's next
  note (classic arp), null = a rest. The first 49 come from the Splice thread's
  toy-machine-arps.json (Classic ones turned into "next" runs), the rest were added here.
*/
(function () {
  "use strict";
  const PATTERNS = [
    {"name":"Up 1 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"up","rate":"1/16","steps":[{"n":"next"}]},
    {"name":"Up 2 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"up","rate":"1/16","steps":[{"n":"next"}],"octaves":2},
    {"name":"Up 3 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"up","rate":"1/16","steps":[{"n":"next"}],"octaves":3},
    {"name":"Down 1 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"down","rate":"1/16","steps":[{"n":"next"}]},
    {"name":"Down 2 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"down","rate":"1/16","steps":[{"n":"next"}],"octaves":2},
    {"name":"Down 3 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"down","rate":"1/16","steps":[{"n":"next"}],"octaves":3},
    {"name":"Up/Down 1 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"updown","rate":"1/16","steps":[{"n":"next"}]},
    {"name":"Up/Down 2 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"updown","rate":"1/16","steps":[{"n":"next"}],"octaves":2},
    {"name":"Up/Down 3 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"updown","rate":"1/16","steps":[{"n":"next"}],"octaves":3},
    {"name":"Down/Up 1 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"downup","rate":"1/16","steps":[{"n":"next"}]},
    {"name":"Down/Up 2 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"downup","rate":"1/16","steps":[{"n":"next"}],"octaves":2},
    {"name":"Down/Up 3 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"downup","rate":"1/16","steps":[{"n":"next"}],"octaves":3},
    {"name":"Random 1 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"random","rate":"1/16","steps":[{"n":"next"}]},
    {"name":"Random 2 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"random","rate":"1/16","steps":[{"n":"next"}],"octaves":2},
    {"name":"Random 3 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"random","rate":"1/16","steps":[{"n":"next"}],"octaves":3},
    {"name":"As Played 1 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"asplayed","rate":"1/16","steps":[{"n":"next"}]},
    {"name":"As Played 2 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"asplayed","rate":"1/16","steps":[{"n":"next"}],"octaves":2},
    {"name":"As Played 3 Oct","family":"Classic","about":"Classic hardware arp mode (Juno-60 / Jupiter-8 style).","order":"asplayed","rate":"1/16","steps":[{"n":"next"}],"octaves":3},
    {"name":"Converge","family":"Classic","about":"Outside notes in toward the middle.","order":"converge","rate":"1/16","steps":[{"n":"next"}]},
    {"name":"Diverge","family":"Classic","about":"Middle notes out to the edges.","order":"diverge","rate":"1/16","steps":[{"n":"next"}]},
    {"name":"Pinky Up","family":"Classic","about":"Alternates every note with the top note (Pinky mode).","order":"pinky","rate":"1/16","steps":[{"n":"next"}]},
    {"name":"Thumb Up","family":"Classic","about":"Alternates every note with the bottom note.","order":"thumb","rate":"1/16","steps":[{"n":"next"}]},
    {"name":"Chord Stabs 1/8","family":"Classic","about":"Whole chord retriggered on 8ths.","order":"chord","rate":"1/8","steps":[{"n":0,"gate":0.35}]},
    {"name":"Berlin School","family":"Famous","about":"Tangerine-Dream-style 16-step sequencer run, octave bounce.","order":"up","rate":"1/16","steps":[{"n":0},{"n":0,"oct":1},{"n":1},{"n":2},{"n":0},{"n":2,"oct":1},{"n":1},{"n":2},{"n":0},{"n":0,"oct":1},{"n":1},{"n":3},{"n":2},{"n":1,"oct":1},{"n":1},{"n":2}]},
    {"name":"Disco Octaves","family":"Famous","about":"Moroder-style 8th octave bass: root, octave, root, octave.","order":"up","rate":"1/16","steps":[{"n":0,"gate":0.5},{"n":0,"oct":1,"gate":0.4},{"n":0,"gate":0.5},{"n":0,"oct":1,"gate":0.4}]},
    {"name":"Retro Pulse","family":"Famous","about":"80s synthwave 16ths with accents on 1 and 3 (Stranger-Things-like pulse).","order":"up","rate":"1/16","steps":[{"n":0,"vel":1},{"n":1,"vel":0.6},{"n":2,"vel":0.7},{"n":3,"vel":0.6},{"n":2,"vel":0.9},{"n":1,"vel":0.6},{"n":2,"vel":0.7},{"n":3,"vel":0.6}]},
    {"name":"Acid 303","family":"Famous","about":"TB-303 style: accents, slides and octave jumps on one or two notes.","order":"asplayed","rate":"1/16","steps":[{"n":0,"gate":0.5,"vel":1},{"n":0,"oct":1,"gate":0.5,"vel":0.6,"slide":true},{"n":0,"gate":1.1,"vel":0.7,"slide":true},{"n":null},{"n":1,"gate":0.5,"vel":1},{"n":0,"gate":0.5,"vel":0.6},{"n":0,"oct":-1,"gate":0.9,"slide":true},{"n":1,"oct":1,"gate":0.5,"vel":0.7},{"n":0,"gate":0.5,"vel":1},{"n":null},{"n":2,"gate":0.5,"vel":0.6,"slide":true},{"n":0,"oct":1,"gate":0.5,"vel":0.9},{"n":0,"gate":0.5,"vel":0.6},{"n":1,"gate":1.1,"slide":true},{"n":0,"gate":0.5,"vel":0.7},{"n":null}],"swing":0.1},
    {"name":"Trance Gate","family":"Famous","about":"Classic trance 16th gate on the held chord.","order":"chord","rate":"1/16","steps":[{"n":0,"gate":0.5},{"n":0,"gate":0.3,"vel":0.6},{"n":null},{"n":0,"gate":0.3,"vel":0.7},{"n":0,"gate":0.5},{"n":null},{"n":0,"gate":0.3,"vel":0.7},{"n":0,"gate":0.3,"vel":0.6}]},
    {"name":"Blade Runner Drift","family":"Famous","about":"Slow Vangelis-like 8th-triplet broken chord with long gates.","order":"up","rate":"1/8t","steps":[{"n":0,"gate":1.2,"vel":0.6},{"n":1,"gate":1.2,"vel":0.5},{"n":2,"gate":1.2,"vel":0.6},{"n":3,"gate":1.2,"vel":0.5},{"n":2,"oct":1,"gate":1.4,"vel":0.7},{"n":1,"gate":1.2,"vel":0.5}]},
    {"name":"Minimal Techno Stab","family":"Famous","about":"Offbeat 16th stabs with ghost notes.","order":"chord","rate":"1/16","steps":[{"n":null},{"n":null},{"n":0,"gate":0.25,"vel":0.9},{"n":null},{"n":null},{"n":0,"gate":0.2,"vel":0.5,"prob":0.6},{"n":0,"gate":0.25,"vel":0.9},{"n":null}],"swing":0.15},
    {"name":"Garage Skip","family":"Famous","about":"UK garage 2-step shuffle: notes on the skippy 16ths.","order":"up","rate":"1/16","steps":[{"n":0,"vel":1},{"n":null},{"n":null},{"n":1,"vel":0.7},{"n":null},{"n":2},{"n":null},{"n":0,"oct":1,"vel":0.6},{"n":null},{"n":null},{"n":1,"vel":0.9},{"n":null},{"n":3,"vel":0.7},{"n":null},{"n":2,"vel":0.6},{"n":null}],"swing":0.55},
    {"name":"Overmono Roll","family":"Famous","about":"UK bass/breaks style rolling 16ths with ratchets at bar end.","order":"updown","rate":"1/16","steps":[{"n":0},{"n":1},{"n":2},{"n":1},{"n":0},{"n":1},{"n":2},{"n":3},{"n":0},{"n":1},{"n":2},{"n":1},{"n":0,"ratchet":2},{"n":1,"ratchet":2},{"n":2,"ratchet":3},{"n":3,"oct":1,"ratchet":4}],"swing":0.2},
    {"name":"Rage Bounce","family":"Famous","about":"Carti/rage-style syncopated synth: root heavy, octave pops.","order":"asplayed","rate":"1/16","steps":[{"n":0,"gate":0.8,"vel":1},{"n":null},{"n":null},{"n":0,"oct":1,"gate":0.4},{"n":null},{"n":null},{"n":1,"vel":0.9},{"n":null},{"n":0,"gate":0.8,"vel":1},{"n":null},{"n":0,"oct":1,"gate":0.3,"vel":0.7},{"n":null},{"n":2,"vel":0.9},{"n":null},{"n":1,"oct":1,"gate":0.3,"vel":0.7},{"n":null}],"swing":0.05},
    {"name":"Crystal Bleeps","family":"Famous","about":"Crystal-Castles-like hyperfast chip arpeggio, 32nds, 2 octaves.","order":"up","rate":"1/32","steps":[{"n":0,"gate":0.4},{"n":1,"gate":0.4},{"n":2,"gate":0.4},{"n":3,"gate":0.4},{"n":0,"oct":1,"gate":0.4},{"n":1,"oct":1,"gate":0.4},{"n":2,"oct":1,"gate":0.4},{"n":3,"oct":1,"gate":0.4}]},
    {"name":"Sad Hours Drift","family":"Ambient","about":"Slow, sparse, muffled-friendly: long gates, missing notes, gentle octave lifts.","order":"up","rate":"1/8","steps":[{"n":0,"gate":1.3,"vel":0.6},{"n":null},{"n":2,"gate":1.2,"vel":0.5,"prob":0.8},{"n":1,"gate":1.2,"vel":0.5},{"n":null},{"n":3,"gate":1.4,"vel":0.45,"prob":0.7},{"n":2,"oct":1,"gate":1.4,"vel":0.4,"prob":0.5},{"n":null}],"swing":0.1},
    {"name":"Snowfall Plucks","family":"Ambient","about":"Øneheart/reidenshi-like 1/8 pluck pattern with a lift on the 4th step.","order":"up","rate":"1/8","steps":[{"n":0,"gate":0.7,"vel":0.7},{"n":2,"gate":0.7,"vel":0.55},{"n":1,"gate":0.7,"vel":0.6},{"n":3,"gate":0.9,"vel":0.75},{"n":0,"oct":1,"gate":0.7,"vel":0.55},{"n":2,"gate":0.7,"vel":0.5},{"n":1,"gate":0.7,"vel":0.55},{"n":null}],"swing":0.08},
    {"name":"Music Box","family":"Ambient","about":"Delicate 1/16 rising with random skips.","order":"up","rate":"1/16","steps":[{"n":0,"gate":0.5,"vel":0.5,"prob":0.85},{"n":1,"gate":0.5,"vel":0.6,"prob":0.85},{"n":2,"gate":0.5,"vel":0.7,"prob":0.85},{"n":3,"gate":0.5,"vel":0.5,"prob":0.85},{"n":0,"oct":1,"gate":0.5,"vel":0.6,"prob":0.85},{"n":1,"oct":1,"gate":0.5,"vel":0.7,"prob":0.85},{"n":2,"oct":1,"gate":0.5,"vel":0.5,"prob":0.85},{"n":3,"oct":1,"gate":0.5,"vel":0.6,"prob":0.85}]},
    {"name":"Euclid Tresillo","family":"Modular","about":"Euclidean rhythm E(3,8) walking up the chord.","order":"up","rate":"1/16","steps":[{"n":0,"gate":0.5},{"n":null},{"n":null},{"n":1,"gate":0.5},{"n":null},{"n":null},{"n":2,"gate":0.5},{"n":null}]},
    {"name":"Euclid Cinquillo","family":"Modular","about":"Euclidean rhythm E(5,8) walking up the chord.","order":"up","rate":"1/16","steps":[{"n":0,"gate":0.5},{"n":null},{"n":1,"gate":0.5},{"n":null},{"n":2,"gate":0.5},{"n":3,"gate":0.5},{"n":null},{"n":0,"oct":1,"gate":0.5}]},
    {"name":"Euclid West African 5/12","family":"Modular","about":"Euclidean rhythm E(5,12) walking up the chord.","order":"up","rate":"1/16","steps":[{"n":0,"gate":0.5},{"n":null},{"n":null},{"n":1,"gate":0.5},{"n":null},{"n":2,"gate":0.5},{"n":null},{"n":null},{"n":3,"gate":0.5},{"n":null},{"n":0,"oct":1,"gate":0.5},{"n":null}]},
    {"name":"Euclid Samba 7/16","family":"Modular","about":"Euclidean rhythm E(7,16) walking up the chord.","order":"up","rate":"1/16","steps":[{"n":0,"gate":0.5},{"n":null},{"n":null},{"n":1,"gate":0.5},{"n":null},{"n":2,"gate":0.5},{"n":null},{"n":3,"gate":0.5},{"n":null},{"n":null},{"n":0,"oct":1,"gate":0.5},{"n":null},{"n":1,"oct":1,"gate":0.5},{"n":null},{"n":2,"oct":1,"gate":0.5},{"n":null}]},
    {"name":"Euclid 9/16","family":"Modular","about":"Euclidean rhythm E(9,16) walking up the chord.","order":"up","rate":"1/16","steps":[{"n":0,"gate":0.5},{"n":null},{"n":1,"gate":0.5},{"n":null},{"n":2,"gate":0.5},{"n":null},{"n":3,"gate":0.5},{"n":null},{"n":0,"oct":1,"gate":0.5},{"n":1,"oct":1,"gate":0.5},{"n":null},{"n":2,"oct":1,"gate":0.5},{"n":null},{"n":3,"oct":1,"gate":0.5},{"n":null},{"n":0,"gate":0.5}]},
    {"name":"Euclid Bossa 5/16","family":"Modular","about":"Euclidean rhythm E(5,16) walking up the chord.","order":"up","rate":"1/16","steps":[{"n":0,"gate":0.5},{"n":null},{"n":null},{"n":null},{"n":1,"gate":0.5},{"n":null},{"n":null},{"n":2,"gate":0.5},{"n":null},{"n":null},{"n":3,"gate":0.5},{"n":null},{"n":null},{"n":0,"oct":1,"gate":0.5},{"n":null},{"n":null}]},
    {"name":"Turing Loop","family":"Modular","about":"Turing-Machine-style locked random loop: 16 fixed random steps (reroll with dice).","order":"asplayed","rate":"1/16","steps":[{"n":2,"gate":0.5,"vel":0.67},{"n":1,"oct":1,"gate":0.5,"vel":0.9},{"n":3,"gate":0.5,"vel":0.91},{"n":0,"oct":1,"gate":0.5,"vel":0.62},{"n":3,"gate":0.5,"vel":0.94},{"n":3,"oct":-1,"gate":0.5,"vel":0.91},{"n":2,"oct":1,"gate":0.5,"vel":0.85},{"n":0,"oct":1,"gate":0.5,"vel":0.61},{"n":1,"gate":0.5,"vel":0.65},{"n":2,"gate":0.5,"vel":0.81},{"n":3,"oct":1,"gate":0.5,"vel":0.75},{"n":1,"oct":-1,"gate":0.5,"vel":0.85},{"n":0,"gate":0.5,"vel":0.72},{"n":1,"oct":-1,"gate":0.5,"vel":0.76},{"n":1,"oct":1,"gate":0.5,"vel":0.91},{"n":1,"gate":0.5,"vel":0.81}]},
    {"name":"Marbles Drift","family":"Modular","about":"Marbles-style probabilistic: notes fire 70% of the time, octave wanders.","order":"random","rate":"1/16","steps":[{"n":0,"oct":-1,"gate":0.45,"vel":0.7,"prob":0.7},{"n":1,"gate":0.45,"vel":0.7,"prob":0.7},{"n":2,"gate":0.45,"vel":0.7,"prob":0.7},{"n":3,"gate":0.45,"vel":0.7,"prob":0.7},{"n":4,"gate":0.45,"vel":0.7,"prob":0.7},{"n":5,"oct":1,"gate":0.45,"vel":0.7,"prob":0.7},{"n":6,"gate":0.45,"vel":0.7,"prob":0.7},{"n":7,"gate":0.45,"vel":0.7,"prob":0.7}],"swing":0.1},
    {"name":"Polymeter 5 over 4","family":"Modular","about":"5-step pattern against the 4/4 bar — shifts every bar.","order":"up","rate":"1/16","steps":[{"n":0,"vel":1},{"n":1},{"n":2},{"n":1,"oct":1},{"n":3}]},
    {"name":"Polymeter 7","family":"Modular","about":"7-step cycle for slow phasing.","order":"updown","rate":"1/16","steps":[{"n":0,"vel":1},{"n":1},{"n":2},{"n":3},{"n":2,"oct":1},{"n":1},{"n":null}]},
    {"name":"Ratchet Rolls","family":"Modular","about":"Ratchet bursts (2–4 hits per step) for glitchy rolls.","order":"up","rate":"1/8","steps":[{"n":0},{"n":1,"ratchet":2},{"n":2,"ratchet":3},{"n":3,"ratchet":4},{"n":2,"oct":1,"ratchet":2},{"n":1}]},
    {"name":"Pendulum Fifths","family":"Modular","about":"Root, fifth-ish, octave pendulum (uses note 0 and 2 of the chord).","order":"up","rate":"1/16","steps":[{"n":0},{"n":2},{"n":0,"oct":1},{"n":2},{"n":0},{"n":2,"oct":-1}]},
    {"name":"Up 4 Oct","family":"Classic","about":"Up through four octaves: big sweeping runs.","order":"up","rate":"1/16","steps":[{"n":"next"}],"octaves":4},
    {"name":"Up/Down 4 Oct","family":"Classic","about":"Up and back down over four octaves.","order":"updown","rate":"1/16","steps":[{"n":"next"}],"octaves":4},
    {"name":"Converge 2 Oct","family":"Classic","about":"Outside in, over two octaves.","order":"converge","rate":"1/16","steps":[{"n":"next"}],"octaves":2},
    {"name":"Diverge 2 Oct","family":"Classic","about":"Inside out, over two octaves.","order":"diverge","rate":"1/16","steps":[{"n":"next"}],"octaves":2},
    {"name":"Pinky 2 Oct","family":"Classic","about":"Every note answered by the top one, two octaves.","order":"pinky","rate":"1/16","steps":[{"n":"next"}],"octaves":2},
    {"name":"Thumb 2 Oct","family":"Classic","about":"Every note answered by the bottom one, two octaves.","order":"thumb","rate":"1/16","steps":[{"n":"next"}],"octaves":2},
    {"name":"Up 1/8","family":"Classic","about":"Plain up in 8ths, the Juno default.","order":"up","rate":"1/8","steps":[{"n":"next"}]},
    {"name":"Up 1/16 Triplets","family":"Classic","about":"Up in 16th triplets: rolling, a bit urgent.","order":"up","rate":"1/16t","steps":[{"n":"next"}],"octaves":2},
    {"name":"Down 1/8 Triplets","family":"Classic","about":"Falling 8th triplets.","order":"down","rate":"1/8t","steps":[{"n":"next"}],"octaves":2},
    {"name":"Chord 1/4","family":"Classic","about":"The whole chord on every beat.","order":"chord","rate":"1/4","steps":[{"n":0,"gate":0.5}]},
    {"name":"Chord Offbeats","family":"Classic","about":"Chord on the offbeats (house / Icona Pop pump).","order":"chord","rate":"1/8","steps":[{"n":null},{"n":0,"gate":0.45,"vel":0.9}]},
    {"name":"Chord Dotted 8ths","family":"Classic","about":"Chord every dotted 8th: rolls across the bar.","order":"chord","rate":"1/8d","steps":[{"n":0,"gate":0.4}]},
    {"name":"SH-101 Run","family":"Famous","about":"Roland SH-101 style mono run: accent on every 4th, short gates.","order":"up","rate":"1/16","steps":[{"n":"next","gate":0.45,"vel":1},{"n":"next","gate":0.45,"vel":0.6},{"n":"next","gate":0.45,"vel":0.7},{"n":"next","gate":0.45,"vel":0.6}],"octaves":2},
    {"name":"Volca Flux","family":"Famous","about":"Volca-style loop that leans on the root and pops up on the last step.","order":"up","rate":"1/16","steps":[{"n":0,"vel":1},{"n":1},{"n":0,"gate":0.3},{"n":2},{"n":0,"vel":1},{"n":1,"gate":0.3},{"n":3},{"n":0,"oct":1,"vel":0.9}]},
    {"name":"Odyssey Down-Up","family":"Famous","about":"ARP Odyssey style down/up in 16th triplets.","order":"downup","rate":"1/16t","steps":[{"n":"next","gate":0.5}],"octaves":2},
    {"name":"Moroder Bass","family":"Famous","about":"Galloping 16th bass: root, root, octave, root.","order":"up","rate":"1/16","steps":[{"n":0,"gate":0.4,"vel":1},{"n":0,"gate":0.4,"vel":0.6},{"n":0,"oct":1,"gate":0.4},{"n":0,"gate":0.4,"vel":0.6}]},
    {"name":"808 Roll","family":"Famous","about":"Trap 808 / hat roll feel: hits double, triple, then quadruple through the bar.","order":"up","rate":"1/8","steps":[{"n":0,"gate":0.8,"vel":1},{"n":0,"gate":0.5},{"n":0,"vel":0.7,"ratchet":2},{"n":0,"vel":0.7,"ratchet":2},{"n":0,"vel":0.75,"ratchet":3},{"n":0,"ratchet":3},{"n":0,"vel":0.85,"ratchet":4},{"n":0,"oct":1,"vel":0.95,"ratchet":4}]},
    {"name":"Rage Stutter","family":"Famous","about":"Playboi Carti / rage lead: stuttered root, octave pop, dirty triplet ratchets.","order":"up","rate":"1/16","steps":[{"n":0,"vel":1,"ratchet":2},{"n":null},{"n":0,"oct":1,"gate":0.4},{"n":0,"vel":0.9,"ratchet":3},{"n":null},{"n":1,"gate":0.5},{"n":0,"oct":1,"vel":1,"ratchet":2},{"n":null}],"swing":0.05},
    {"name":"Carti Bells","family":"Famous","about":"Plinky bell 8ths with missing notes, two octaves up.","order":"up","rate":"1/8","steps":[{"n":0,"oct":1,"gate":0.4},{"n":2,"oct":1,"gate":0.4,"prob":0.8},{"n":1,"oct":1,"gate":0.4},{"n":3,"oct":1,"gate":0.4,"prob":0.6}]},
    {"name":"Mike Dean Run","family":"Famous","about":"Gliding 16th triplet climb with slides, big analog lead energy.","order":"up","rate":"1/16t","steps":[{"n":0,"gate":1.0},{"n":1,"gate":1.0,"slide":true},{"n":2,"gate":1.0},{"n":3,"gate":1.0,"slide":true},{"n":2,"oct":1,"gate":1.1},{"n":1,"oct":1,"gate":1.0,"slide":true}]},
    {"name":"Tame Swirl","family":"Famous","about":"Tame Impala style swirly 8th triplets: up and down, long overlapping notes.","order":"updown","rate":"1/8t","steps":[{"n":"next","gate":1.4,"vel":0.7}],"octaves":2},
    {"name":"Gorillaz Plink","family":"Famous","about":"Lazy, behind-the-beat 8ths with a skipped note.","order":"up","rate":"1/8","steps":[{"n":0,"gate":0.5},{"n":2,"gate":0.5},{"n":null},{"n":1,"gate":0.5},{"n":3,"gate":0.5,"vel":0.6},{"n":2,"gate":0.5}],"swing":0.35},
    {"name":"Skrillex Gate","family":"Famous","about":"Chopped chord gate with ratchet bursts (brostep style).","order":"chord","rate":"1/16","steps":[{"n":0,"gate":0.9,"vel":1},{"n":0,"gate":0.3},{"n":null},{"n":0,"vel":0.9,"ratchet":3},{"n":0,"gate":0.9,"vel":1},{"n":null},{"n":0,"ratchet":2},{"n":0,"vel":1,"ratchet":4}]},
    {"name":"Kraftwerk Robot","family":"Famous","about":"Stiff, even 8ths, all the same: robotic.","order":"up","rate":"1/8","steps":[{"n":"next","gate":0.35,"vel":0.85}]},
    {"name":"Daft Octave Funk","family":"Famous","about":"Swung octave bass with a ghost note.","order":"up","rate":"1/16","steps":[{"n":0,"gate":0.5,"vel":1},{"n":0,"oct":1,"gate":0.3,"vel":0.6},{"n":null},{"n":0,"oct":1,"gate":0.4},{"n":0,"gate":0.5,"vel":0.9},{"n":1,"gate":0.3,"vel":0.5,"prob":0.7},{"n":0,"oct":1,"gate":0.4},{"n":null}],"swing":0.4},
    {"name":"Trance Pluck 3/16","family":"Famous","about":"The 3-against-4 trance pluck: dotted-8th accents rolling over the bar.","order":"up","rate":"1/16","steps":[{"n":0,"vel":1},{"n":1,"vel":0.5},{"n":2,"vel":0.6},{"n":0,"oct":1,"vel":1},{"n":1,"vel":0.5},{"n":2,"vel":0.6},{"n":3,"vel":1},{"n":1,"vel":0.5},{"n":2,"vel":0.6},{"n":0,"oct":1,"vel":1},{"n":2,"vel":0.5},{"n":1,"vel":0.6},{"n":3,"vel":1},{"n":2,"vel":0.5},{"n":1,"vel":0.6},{"n":0,"vel":0.7}]},
    {"name":"Glass Pulse","family":"Famous","about":"Philip Glass style: 3 notes against a 4 pulse, slowly shifting.","order":"up","rate":"1/8","steps":[{"n":0},{"n":1},{"n":2}]},
    {"name":"Reich Phase","family":"Famous","about":"Steve Reich style 12-step cell for phasing against itself.","order":"up","rate":"1/16","steps":[{"n":0},{"n":1},{"n":3},{"n":1},{"n":0},{"n":2},{"n":1},{"n":0},{"n":3},{"n":2},{"n":1},{"n":2}]},
    {"name":"Blue Hour Drift","family":"Ambient","about":"Blue Hour tonality: slow 8ths up and down, long soft notes, some missing.","order":"updown","rate":"1/8","steps":[{"n":"next","gate":1.6,"vel":0.55,"prob":0.75}],"octaves":2},
    {"name":"Snowfall Bloom","family":"Ambient","about":"Quarter notes that ring into each other like snow settling.","order":"up","rate":"1/4","steps":[{"n":0,"gate":1.8,"vel":0.6},{"n":2,"gate":1.8,"vel":0.5},{"n":1,"oct":1,"gate":1.8,"vel":0.55},{"n":3,"gate":1.8,"vel":0.45,"prob":0.8}]},
    {"name":"Half Bar Swells","family":"Ambient","about":"One note every half bar, held long: pads that breathe.","order":"up","rate":"1/2","steps":[{"n":"next","gate":1.9,"vel":0.6}],"octaves":2},
    {"name":"Whole Notes Up","family":"Ambient","about":"One note a bar, climbing: slow evolving drones.","order":"up","rate":"1 bar","steps":[{"n":"next","gate":1.0,"vel":0.6}],"octaves":2},
    {"name":"Two Bar Drift","family":"Ambient","about":"A note every two bars, random from the chord.","order":"random","rate":"2 bars","steps":[{"n":"next","gate":1.0,"vel":0.55}],"octaves":2},
    {"name":"Tape Lullaby","family":"Ambient","about":"Gentle triplet lullaby, soft and a little lazy.","order":"up","rate":"1/8t","steps":[{"n":0,"gate":0.9,"vel":0.5},{"n":2,"gate":0.9,"vel":0.45},{"n":1,"oct":1,"gate":0.9,"vel":0.5},{"n":2,"gate":0.9,"vel":0.4},{"n":3,"gate":0.9,"vel":0.45},{"n":1,"gate":0.9,"vel":0.4,"prob":0.7}],"swing":0.15},
    {"name":"Rain on Glass","family":"Ambient","about":"Sparse high droplets: random notes two octaves up, half of them missing.","order":"random","rate":"1/16","steps":[{"n":"next","oct":1,"gate":0.5,"vel":0.45,"prob":0.45}],"octaves":2},
    {"name":"Muffled Heartbeat","family":"Ambient","about":"Root-root, pause: a slow heartbeat under a pad.","order":"up","rate":"1/8","steps":[{"n":0,"gate":0.5},{"n":0,"gate":0.5,"vel":0.5},{"n":null},{"n":null}]},
    {"name":"Euclid 4/11","family":"Modular","about":"Euclidean E(4,11): a limping, odd loop.","order":"up","rate":"1/16","steps":[{"n":0},{"n":null},{"n":null},{"n":1},{"n":null},{"n":null},{"n":2},{"n":null},{"n":null},{"n":3},{"n":null}]},
    {"name":"Euclid 5/13","family":"Modular","about":"Euclidean E(5,13): never lands the same way twice in a bar.","order":"up","rate":"1/16","steps":[{"n":0},{"n":null},{"n":null},{"n":1},{"n":null},{"n":null},{"n":2},{"n":null},{"n":3},{"n":null},{"n":null},{"n":0,"oct":1},{"n":null}]},
    {"name":"Euclid 3/7","family":"Modular","about":"Euclidean E(3,7): short odd cycle.","order":"up","rate":"1/16","steps":[{"n":0},{"n":null},{"n":null},{"n":1},{"n":null},{"n":2},{"n":null}]},
    {"name":"Fibonacci Steps","family":"Modular","about":"Gaps of 1, 1, 2, 3, 5 steps between notes.","order":"up","rate":"1/16","steps":[{"n":0},{"n":1},{"n":null},{"n":2},{"n":null},{"n":null},{"n":3},{"n":null},{"n":null},{"n":null},{"n":null},{"n":0,"oct":1}]},
    {"name":"Prime Skips","family":"Modular","about":"Notes on steps 2, 3, 5, 7, 11, 13 of 16.","order":"up","rate":"1/16","steps":[{"n":null},{"n":0},{"n":1},{"n":null},{"n":2},{"n":null},{"n":3},{"n":null},{"n":null},{"n":null},{"n":0,"oct":1},{"n":null},{"n":1,"oct":1},{"n":null},{"n":null},{"n":null}]},
    {"name":"Ratchet Accelerando","family":"Modular","about":"Each step hits more times: 1, 2, 3, 4, then back.","order":"up","rate":"1/8","steps":[{"n":0},{"n":1,"ratchet":2},{"n":2,"ratchet":3},{"n":3,"ratchet":4},{"n":2,"ratchet":3},{"n":1,"ratchet":2}]},
    {"name":"Ghost Notes","family":"Modular","about":"Accented notes with quiet ghost notes that come and go.","order":"up","rate":"1/16","steps":[{"n":0,"vel":1},{"n":1,"vel":0.3,"prob":0.6},{"n":2,"vel":0.35,"prob":0.5},{"n":0,"vel":0.9},{"n":3,"vel":0.3,"prob":0.6},{"n":2,"vel":1},{"n":1,"vel":0.3,"prob":0.5},{"n":0,"oct":1,"vel":0.35,"prob":0.6}]},
    {"name":"Glitch Stack","family":"Modular","about":"Chord ratchets and dropouts: broken machine.","order":"chord","rate":"1/16","steps":[{"n":0,"vel":0.9,"ratchet":4},{"n":null},{"n":0,"gate":0.2,"prob":0.7},{"n":0,"ratchet":3},{"n":null},{"n":null},{"n":0,"ratchet":2,"prob":0.8},{"n":0,"gate":0.9,"vel":1}]},
    {"name":"Stairs Down 4 Oct","family":"Modular","about":"Long fall from four octaves up.","order":"down","rate":"1/32","steps":[{"n":"next","gate":0.4}],"octaves":4},
    {"name":"Golden Drift","family":"Modular","about":"Random notes, random octaves, 60% chance: a slow-changing cloud.","order":"random","rate":"1/16","steps":[{"n":"next","gate":0.7,"prob":0.6},{"n":"next","oct":1,"gate":0.5,"prob":0.6},{"n":"next","oct":-1,"gate":0.9,"prob":0.5}],"swing":0.2},
    {"name":"Acid Slides","family":"Modular","about":"303 slides everywhere: every second note glides in.","order":"up","rate":"1/16","steps":[{"n":0,"gate":1.05,"vel":1},{"n":1,"gate":1.05,"slide":true},{"n":0,"oct":1,"gate":0.5,"vel":0.9},{"n":2,"gate":1.05,"slide":true},{"n":0,"gate":0.5},{"n":0,"oct":-1,"gate":1.05,"vel":1,"slide":true}]},
    {"name":"Pendulum 3 Oct","family":"Modular","about":"Swings low to high and back over three octaves, triplet feel.","order":"updown","rate":"1/16t","steps":[{"n":"next","gate":0.5}],"octaves":3}
  ];
  const FAMILIES = ["Classic", "Famous", "Ambient", "Modular"];
  // [label, beats]
  const RATES = [["4 bars", 16], ["2 bars", 8], ["1 bar", 4], ["1/2", 2], ["1/4", 1], ["1/8d", 0.75], ["1/8", 0.5], ["1/8t", 1 / 3], ["1/16", 0.25], ["1/16t", 1 / 6], ["1/32", 0.125]];
  const ORDERS = [["up", "Up"], ["down", "Down"], ["updown", "Up/Down"], ["downup", "Down/Up"], ["asplayed", "As played"], ["converge", "Converge"],
                  ["diverge", "Diverge"], ["pinky", "Pinky"], ["thumb", "Thumb"], ["random", "Random"], ["chord", "Chord"]];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const WORDS_A = ["Neon", "Glass", "Velvet", "Rust", "Ghost", "Static", "Hollow", "Acid", "Frozen", "Broken", "Liquid", "Dust", "Chrome", "Midnight", "Paper",
                   "Wired", "Lunar", "Bent", "Feral", "Quiet", "Toxic", "Pale", "Electric", "Sunken", "Crooked", "Violet", "Iron", "Soft", "Blind", "Wild"];
  const WORDS_B = ["Moth", "Spiral", "Ladder", "Engine", "Rain", "Circuit", "Spider", "Comet", "Stairs", "Pulse", "Bloom", "Orbit", "Maze", "Signal", "Tide",
                   "Clock", "Wasp", "Lantern", "Glitch", "Fern", "Prism", "Siren", "Knot", "Echo", "Swarm", "Crane", "Machine", "Drift", "Coil", "Flicker"];

  /** A brand-new pattern from a seed. wild 0..1: 0 = tidy and musical, 1 = very experimental. */
  function roll(seed, wild) {
    seed = (seed >>> 0) || 1;
    wild = Math.max(0, Math.min(1, wild == null ? 0.5 : wild));
    const r = mulberry32(seed), pick = (a) => a[Math.floor(r() * a.length)], lerp = (a, b) => a + (b - a) * wild;
    const lens = wild < 0.35 ? [8, 8, 16, 16, 6, 12] : wild < 0.7 ? [5, 6, 7, 8, 12, 16, 16] : [5, 7, 9, 11, 13, 6, 12, 16];
    const rates = wild < 0.35 ? ["1/8", "1/16", "1/16", "1/8t"] : wild < 0.7 ? ["1/8", "1/16", "1/16", "1/16", "1/8t", "1/16t", "1/32"] : ["1/8", "1/16", "1/16t", "1/32", "1/8d", "1/8t", "1/4"];
    const orders = wild < 0.35 ? ["up", "up", "asplayed", "updown"] : ["asplayed", "up", "down", "updown", "random", "converge", "pinky", "thumb"];
    const len = pick(lens);
    const rest = lerp(0.05, 0.4) * r() + 0.04;
    const jump = lerp(0.08, 0.45) * r();
    const ratchet = lerp(0, 0.3) * r();
    const slide = lerp(0, 0.3) * r();
    const chance = lerp(0, 0.4) * r();
    const accent = pick([0, 2, 3, 4, 4, 5, 7]);
    const reach = Math.round(lerp(3, 7));
    const useNext = r() < lerp(0.3, 0.1);
    const baseGate = 0.25 + r() * 0.7;
    const steps = [];
    for (let i = 0; i < len; i++) {
      if (i > 0 && r() < rest) { steps.push({ n: null }); continue; }
      const s = { n: useNext ? "next" : Math.floor(r() * (reach + 1)) };
      if (r() < jump) s.oct = pick(wild > 0.6 ? [-1, 1, 1, 2] : [1, 1, -1]);
      const g = baseGate * (0.6 + r() * 0.8) + (r() < lerp(0.05, 0.2) ? 0.6 : 0);
      if (Math.abs(g - 0.6) > 0.02) s.gate = +Math.min(lerp(0.95, 1.6), g).toFixed(2);
      const v = accent && i % accent === 0 ? 1 : 0.45 + r() * 0.45;
      if (Math.abs(v - 0.8) > 0.02) s.vel = +v.toFixed(2);
      if (r() < ratchet) s.ratchet = 2 + Math.floor(r() * 3);
      if (i > 0 && r() < slide) s.slide = true;
      if (i > 0 && r() < chance) s.prob = +(0.45 + r() * 0.5).toFixed(2);
      steps.push(s);
    }
    if (steps.filter((s) => s.n != null).length < 2) steps[Math.min(len - 1, 2)] = { n: 1 };
    const p = {
      name: pick(WORDS_A) + " " + pick(WORDS_B), family: "Dice", about: "Rolled with the dice (seed " + seed + ", " + Math.round(wild * 100) + "% wild).",
      order: pick(orders), rate: pick(rates), steps, seed, wild: +wild.toFixed(2),
    };
    const sw = r() < lerp(0.3, 0.6) ? +(r() * lerp(0.3, 0.6)).toFixed(2) : 0;
    if (sw) p.swing = sw;
    if (p.order !== "random" && r() < 0.3) p.octaves = 2;
    return p;
  }
  const newSeed = () => (((Date.now() & 0xfffff) * 4099) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0 || 1;

  /** The preset's "arp" for a library (or rolled) pattern: on, with the pattern's own settings. */
  function toPreset(p, on) {
    const a = { on: on !== false, name: p.name, family: p.family, order: p.order || "up", rate: p.rate || "1/16", octaves: p.octaves || 1,
                swing: p.swing || 0, gate: p.gate || 1, steps: JSON.parse(JSON.stringify(p.steps || [{ n: "next" }])) };
    if (p.seed) a.seed = p.seed;
    if (p.wild != null) a.wild = p.wild;
    return a;
  }
  /** The order's run over a pretend 4-note chord (indices 0..4*octaves-1): for pictures, and for
      places that can't follow held notes (the drop zone plays root, fifth, octave, octave + fifth). */
  function runOf(order, octaves) {
    const k = (octaves || 1) * 4, up = [];
    for (let i = 0; i < k; i++) up.push(i);
    switch (order) {
      case "down": return up.reverse();
      case "updown": return up.concat(up.slice(1, -1).reverse());
      case "downup": return up.slice().reverse().concat(up.slice(1, -1));
      case "converge": case "diverge": { const r = []; for (let lo = 0, hi = k - 1; lo <= hi; lo++, hi--) { r.push(lo); if (hi !== lo) r.push(hi); } return order === "diverge" ? r.reverse() : r; }
      case "pinky": return up.slice(0, -1).flatMap((x) => [x, k - 1]);
      case "thumb": return up.slice(1).flatMap((x) => [0, x]);
      case "random": return up.map((x, i) => (i * 7 + 3) % k);
      default: return up;
    }
  }
  /** A classic run pattern ("next" steps) written out as fixed steps on that 4-note chord.
      octaves overrides the pattern's own (the drop zone uses 1: its 4 notes already span 1.5 octaves). */
  function expand(p, octaves) {
    const steps = p.steps || [];
    if (!steps.length || !steps.every((x) => x.n === "next")) return JSON.parse(JSON.stringify(steps));
    return runOf(p.order, octaves || p.octaves).map((k, i) => Object.assign({}, steps[i % steps.length], { n: k % 4, oct: Math.floor(k / 4) + (steps[i % steps.length].oct || 0) }));
  }
  const find = (name) => PATTERNS.find((p) => p.name === name) || null;
  const beatsOf = (rate) => { const r = RATES.find((x) => x[0] === rate); return r ? r[1] : typeof rate === "number" ? rate : 0.25; };

  // Kept dice patterns ("My arps"), in this browser.
  const KEY = "tm-arps-kept";
  const kept = {
    get() { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } },
    add(p) { const l = kept.get().filter((x) => x.name !== p.name); l.unshift(Object.assign({}, p, { family: "Mine" })); try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, 200))); } catch (e) { /* private window */ } return l; },
    remove(name) { const l = kept.get().filter((x) => x.name !== name); try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { /* private window */ } return l; },
  };

  window.ToyMachineArps = { PATTERNS, FAMILIES, RATES, ORDERS, roll, newSeed, toPreset, find, beatsOf, kept, runOf, expand };
})();
