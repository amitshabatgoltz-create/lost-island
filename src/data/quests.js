// The whole mission chain as data. Each quest becomes active after the previous one is done.
// Indices 0–5 are Part 1 and must keep their order (saved games store questIndex).
import { LAYOUT, ITEM_SPOTS } from '../zones/beach/layout.js';
import { FL } from '../zones/forest/layout.js';
import { RL } from '../zones/ridge/layout.js';
import { FX } from '../zones/facility/layout.js';
import { T } from '../i18n/index.js';

const has = (s, id) => s.collected.includes(id);
const at = (zone, p) => ({ zone, x: p.x, z: p.z });
const nearest = (zone, list, pos) => {
  let best = null, bd = 1e9;
  for (const p of list) {
    const d = pos ? Math.hypot(p.x - pos.x, p.z - pos.z) : 0;
    if (d < bd) { bd = d; best = p; }
  }
  return best ? at(zone, best) : null;
};
const fuselageEnd = { x: LAYOUT.fuselage.x + Math.cos(LAYOUT.fuselage.rot) * 10.4, z: LAYOUT.fuselage.z - Math.sin(LAYOUT.fuselage.rot) * 10.4 };

export const QUESTS = [
  // ============================== PART 1
  {
    id: 'wake', part: 1, hints: [T('Look around: something big and white is lying on the beach.'), T('The fuselage is north-east of where I woke up.'), T('Walk up to the fuselage or check its open end.')], title: T('Awakening'), objective: T('Explore the crash site'),
    done: (s) => s.flags.exploredWreck,
    target: () => at('beach', fuselageEnd),
  },
  {
    id: 'gear', part: 1, hints: [T('Things from the plane are scattered in the wreckage. A small sparkle marks something you can pick up.'), T('Search by the fuselage, the broken wing and the thrown seats.'), T('Water: by the side of the fuselage. Flashlight: by the wing, to the west. Bandage: by the seats, to the east.')], title: T('Gathering Supplies'), objective: T('Find supplies in the wreckage'),
    sub: (s, I) => ['water', 'flashlight', 'bandage'].map((id) => ({ label: I[id].name, done: has(s, id) })),
    done: (s) => has(s, 'water') && has(s, 'flashlight') && has(s, 'bandage'),
    target: (s, pos) => nearest('beach', ['water', 'flashlight', 'bandage'].filter((id) => !has(s, id)).map((id) => ITEM_SPOTS[id]), pos),
    start: { thought: T('I need water, light and something for my arm. Maybe in the wreckage.'), delay: 1.2 },
  },
  {
    id: 'suitcase', part: 1, hints: [T('Something black is stuck between the rocks.'), T('At the west end of the beach there is a gap between big rocks.'), T('You need the flashlight to open the suitcase.')], title: T('The Black Suitcase'), objective: T('Find the strange black suitcase and open it'),
    done: (s) => s.flags.suitcaseOpened,
    target: () => at('beach', LAYOUT.blackSuitcase),
    start: { thought: T('I saw something black in the rocks at the west end of the beach.'), delay: 1.2 },
  },
  {
    id: 'booklet', part: 1, title: T('The Booklet'), objective: T('Take the booklet, open it (J) and read the message'),
    sub: (s) => [{ label: T('Take the booklet'), done: has(s, 'booklet') }, { label: T('Open it (J) and read'), done: s.flags.bookletRead }],
    done: (s) => has(s, 'booklet') && s.flags.bookletRead,
    target: (s) => (has(s, 'booklet') ? null : at('beach', LAYOUT.blackSuitcase)),
  },
  {
    id: 'clues', part: 1, hints: [T('The map in the booklet (J) has two X marks.'), T('One near the west beach and one near the jungle trail.'), T('The ticket: at the west end of the beach, by the water. The device: on the trail into the jungle, north of the fuselage.')], title: T('The Clues'), objective: T('Find the places marked on the booklet map'),
    sub: (s, I) => ['ticket', 'device'].map((id) => ({ label: I[id].name, done: has(s, id) })),
    done: (s) => has(s, 'ticket') && has(s, 'device'),
    target: (s, pos) => nearest('beach', ['ticket', 'device'].filter((id) => !has(s, id)).map((id) => ITEM_SPOTS[id]), pos),
    start: { thought: T('The booklet map has two X marks. Both are close to here.'), delay: 0.8 },
  },
  {
    id: 'reveal', part: 1, hints: [T('The label said CACHE / TAIL.'), T('TAIL is the plane\'s tail, by the edge of the forest.'), T('Search by the cargo container next to the tail.')], title: T('The Discovery'), objective: T('Search near the tail for what the CACHE / TAIL label points to'),
    done: (s) => has(s, 'document'),
    cinematic: 'reveal', // advancing waits for the "THE CRASH WAS NO ACCIDENT." sequence
    target: () => at('beach', ITEM_SPOTS.document),
    start: { thought: T('TAIL. The plane\'s tail. What is waiting there?'), delay: 0.8 },
  },

  // ============================== PART 2
  {
    id: 'enter', part: 2, title: T('The Signal'), en: 'Find the source of the signal in the forest.',
    objective: T('The north trail, behind the tail, leads into the forest'),
    done: (s) => s.zone === 'forest',
    target: () => ({ zone: 'beach', x: 1, z: -97 }),
    hints: [
      T('The red light appeared above the forest, to the north.'),
      T('A dirt trail starts behind the tail.'),
      T('Go north on the trail by the tail until it enters the trees.'),
    ],
  },
  // From here on the forest has no compass: the player navigates by the red light, the trails and the booklet map.
  {
    id: 'follow', part: 2, title: T('The Red Light'), objective: T('The red light blinks above the treetops'),
    done: (s) => s.flags.reachedTransmitter,
    target: () => at('forest', FL.transmitter),
    start: { thought: T('The red light blinks above the treetops. Somewhere ahead of me.'), delay: 1.5 },
    hints: [
      T('Look up: the red light shows above the trees. When it gets bigger, I am getting closer.'),
      T('The trail winds, but it crosses the stream on a log bridge and keeps going toward the light.'),
      T('The transmitter is in a clearing to the north-west, at the end of the main trail after the bridge.'),
    ],
  },
  {
    id: 'power', part: 2, title: T('Power Source'), objective: T('The transmitter is dead. Something was taken from it.'),
    sub: (s) => [
      { label: T('The supply crate'), done: !!s.flags.crateOpen || has(s, 'powerCell') },
      { label: T('The power cell'), done: has(s, 'powerCell') },
    ],
    done: (s) => has(s, 'powerCell'),
    target: () => at('forest', FL.powerCell),
    hints: [
      T('Check the mud around the transmitter, and the tree bark along the tracks. Something is carved into it.'),
      T('Compare the carved symbols (booklet: “Carved Symbols”) with the symbols on the lock wheels. Notice the notches too.'),
      T('Each carved symbol has 1, 2 or 3 notches: that is its place in the lock. Order: wave (one notch), triangle (two), spiral (three).'),
    ],
  },
  {
    id: 'activate', part: 2, title: T('The Transmitter'), objective: T('Bring the transmitter back to life'),
    sub: (s) => [
      { label: T('Power cell in place'), done: !!s.flags.cellInserted || !!s.flags.powerInstalled },
      { label: T('Wiring'), done: !!s.flags.wired || !!s.flags.powerInstalled },
      { label: T('Frequency'), done: !!s.flags.powerInstalled },
    ],
    done: (s) => s.flags.powerInstalled,
    target: () => at('forest', FL.transmitter),
    hints: [
      T('Read the service card in the booklet again. Each sentence sets one thing.'),
      T('Match each rule on the card to terminals 1–4, top to bottom. Start with the rule that points to only one terminal.'),
      T('Green on top (1). Blue next to green, so 2. Yellow not at the bottom, so 3. Red is 4. For the frequency: watch the signal meter and stop when it is full.'),
    ],
  },
  {
    id: 'camp', part: 2, title: T('The Camp'), objective: T('What was this place?'),
    sub: (s) => [
      { label: T('The tent'), done: s.flags.tentSeen },
      { label: T('The hut'), done: s.flags.cabinSeen },
      { label: T('The table'), done: s.flags.tableSeen },
    ],
    done: (s) => s.flags.tentSeen && s.flags.cabinSeen && s.flags.tableSeen,
    target: (s, pos) => nearest('forest', [
      !s.flags.tentSeen && FL.tent, !s.flags.cabinSeen && FL.cabin, !s.flags.tableSeen && FL.table,
    ].filter(Boolean), pos),
    start: { thought: T('The relay broadcast something about a camp.'), delay: 6 },
    hints: [
      T('The broadcast mentioned a camp. The trail goes on from the transmitter, deeper into the forest.'),
      T('Follow the trail north-east from the transmitter to a big clearing with a tent and a hut.'),
      T('There are three things to check in the camp: the tent, the table under the tarp, and the map on the wall inside the hut.'),
    ],
  },
  {
    id: 'locker', part: 2, title: T('The Locked Locker'), objective: T('A metal locker with a keypad'),
    done: (s) => s.flags.lockerOpen,
    target: () => at('forest', FL.locker),
    hints: [
      T('Read the sign on the locker: APPROVAL / ARRIVAL. Two words, two moments.'),
      T('Compare the calendar in the hut with the internal document from the beach and the boarding pass in the booklet.'),
      T('APPROVAL is the day the route change was approved: 14. ARRIVAL is the day we crashed: 23. The code: 1423.'),
    ],
  },
  {
    id: 'docs', part: 2, title: T('Inside the Locker'), objective: T('What did they keep here?'),
    sub: (s, I) => ['researchDoc', 'schedule'].map((id) => ({ label: I[id].name, done: has(s, id) })),
    done: (s) => has(s, 'researchDoc') && has(s, 'schedule'),
    target: () => at('forest', FL.locker),
  },
  {
    id: 'evidence', part: 2, title: T('The Observer'), objective: T('Someone watched the camp. From where?'),
    done: (s) => has(s, 'routeChart') && s.flags.encounterDone,
    target: () => at('forest', FL.post),
    start: { thought: T('“Observer: east ridge.” Where can you see the whole forest from here?'), delay: 1.0 },
    hints: [
      T('Read the shift schedule in the booklet: where did the observer sit?'),
      T('Compare the ridge in the schedule with what you see through the binoculars at the edge of camp, and with the fresh tracks heading east.'),
      T('The lookout is on the east ridge, above the cliff. There is one way up, south-east of the camp.'),
    ],
  },
  {
    id: 'return', part: 2, title: T('The Call'), objective: T('The transmitter is calling'),
    done: (s) => s.flags.endingSeen,
    target: () => at('forest', FL.transmitter),
  },

  // ============================== PART 3 — THE OBSERVER
  // Index 15 used to be the Part 3 teaser: saves that finished Part 2 continue here.
  {
    id: 'north', part: 3, title: T('Follow the Signal'), en: 'The signal has moved north.',
    objective: T('Follow the northbound signal'),
    done: (s) => !!s.flags.reachedRidge,
    target: () => ({ zone: 'forest', x: 42, z: -96 }),
    start: { thought: T('The red light moved north-east. And the lights deep in the forest... someone switched them on for me.'), delay: 1.5 },
    hints: [
      T('Look for the red light above the trees, to the north-east. The lights that came on point the same way.'),
      T('A new trail leaves the camp toward the north-east, past the hut.'),
      T('From the camp, follow the trail north-east to the edge of the forest. It climbs out of the trees toward the mountain.'),
    ],
  },
  {
    id: 'search', part: 3, title: T('The Northern Ridge'), objective: T('Someone came this way. Where does the trail lead?'),
    done: (s) => !!s.flags.entranceFound,
    target: () => at('ridge', RL.door),
    hints: [
      T('The black cable along the trail goes somewhere. So do the fresh boot prints.'),
      T('The trail climbs north up the valley, toward the cliff under the red light.'),
      T('Follow the cable and the prints all the way to the foot of the cliff. Something is built into the rock.'),
    ],
  },
  {
    id: 'restore', part: 3, title: T('Restore Power'), objective: T('The door is dead. Where does its power come from?'),
    sub: (s) => [
      { label: T('Main fuse in the generator'), done: !!s.flags.fuseInstalled },
      { label: T('Junction box wired'), done: !!s.flags.junctionWired },
      { label: T('Generator running'), done: !!s.flags.genRunning },
    ],
    done: (s) => !!s.flags.genRunning && !!s.flags.junctionWired,
    target: (s, pos) => nearest('ridge', [
      !s.flags.fuseInstalled && !s.collected.includes('fuse') && RL.crate,
      !s.flags.genRunning && RL.generator,
      !s.flags.junctionWired && RL.junction,
    ].filter(Boolean), pos),
    hints: [
      T('The panel by the door says where its power comes from. Follow the cable from the panel.'),
      T('The feed cable runs to a junction box and on to a generator shed east of the door. The generator is missing a part: look for NIGHTJAR crates on the slopes. The junction box has a label inside its cover.'),
      T('The fuse is in the split crate on the west slope. Junction box: green 1, orange 2, black 3, white 4. Then start the generator.'),
    ],
  },
  {
    id: 'door', part: 3, title: T('The Hidden Entrance'), objective: T('The panel has power. Now it wants something.'),
    done: (s) => !!s.flags.doorOpen,
    target: () => at('ridge', RL.panel),
    hints: [
      T('Read the access panel: it is not asking for a code.'),
      T('A NIGHTJAR door wants a NIGHTJAR badge. Did anyone drop one on the trail?'),
      T('The badge is in the mud under the broken camera on the trail, halfway up the valley. Swipe it at the panel.'),
    ],
  },
  {
    id: 'enter', part: 3, title: T('Enter the Facility'), objective: T('A dark corridor leads into the mountain'),
    done: (s) => !!s.flags.enteredFacility,
    target: () => at('ridge', RL.door),
    start: { thought: T('Stairs and a corridor, going down into the mountain. Cold air comes out of it.'), delay: 1.2 },
  },
  {
    id: 'observe', part: 3, title: T('The Observation Room'), objective: T('What did they watch from here?'),
    sub: (s, I) => [
      { label: I.memo.name, done: has(s, 'memo') },
      { label: T('The monitor wall'), done: !!s.flags.monitorsSeen },
      { label: I.passengerReport.name, done: has(s, 'passengerReport') },
    ],
    done: (s) => has(s, 'memo') && has(s, 'passengerReport') && !!s.flags.monitorsSeen,
    target: (s, pos) => nearest('facility', [!has(s, 'memo') && FX.memo, !s.flags.monitorsSeen && FX.finalMonitor, !has(s, 'passengerReport') && FX.report].filter(Boolean), pos),
    hints: [
      T('Search the checkpoint desk, then go through the observation door with your badge.'),
      T('The monitor wall is on the far wall of the observation room. The papers on the central desk look important.'),
      T('The memo is on the checkpoint desk. In the observation room: look at the monitor wall, then take the report from the central desk.'),
    ],
  },
  {
    id: 'archive', part: 3, title: T('The Archive'), objective: T('Seat 31A has a restricted record. Find it.'),
    sub: (s) => [
      { label: T('Search the filing cabinets'), done: has(s, 'discrepancies') },
      { label: T('Unlock the archive terminal'), done: !!s.flags.archiveAccess },
    ],
    done: (s) => has(s, 'discrepancies') && !!s.flags.archiveAccess,
    target: (s) => at('facility', has(s, 'discrepancies') ? FX.archTerminal : FX.drawer),
    start: { thought: T('“Seat 31A: see restricted archive.” The records room is off the checkpoint.'), delay: 1.0 },
    hints: [
      T('The terminal asks for a WINDOW CODE, and explains its format. You have already read both parts of it.'),
      T('DDHHMM: a day, then a time. Which day did we arrive? When did the observation window open? (Passenger report.)'),
      T('The day of arrival is the 23rd, and the window opened at 02:40. The code is 230240.'),
    ],
  },
  {
    id: 'file31a', part: 3, title: T('Subject 31A'), objective: T('The terminal released something'),
    done: (s) => has(s, 'file31a'),
    target: () => at('facility', FX.cabinet),
    hints: [
      T('Something unlocked in the archive when the terminal accepted the code.'),
      T('A red steel cabinet, against the far wall of the archive.'),
      T('Open the restricted cabinet on the east wall of the archive and take the file.'),
    ],
  },
  {
    id: 'recording', part: 3, title: T('The Restricted Recording'), objective: T('“Additional records transferred to the restricted archive.”'),
    sub: (s) => [
      { label: T('Play the recording'), done: !!s.flags.recordingPart1 },
      { label: T('Recover the rest of it'), done: !!s.flags.recordingDone },
    ],
    done: (s) => !!s.flags.recordingDone,
    target: () => at('facility', FX.deck),
    start: { thought: T('The terminal also unlocked the control room. West of the observation room.'), delay: 1.0 },
    hints: [
      T('The control room is through the LEVEL 4 door on the west side of the observation room. There is a playback deck in it.'),
      T('The recording cuts off. The deck says the rest of the data is on a SECONDARY INPUT. Do you carry anything that stores data?'),
      T('Insert the memory device from the beach (CACHE / TAIL) into the deck\'s secondary input, then play it again.'),
    ],
  },
  {
    id: 'blackout', part: 3, title: T('Power Failure'), objective: T('The lights went out. One screen came on.'),
    done: (s) => !!s.flags.watchedSeen,
    target: () => at('facility', FX.backup),
    hints: [
      T('The flashlight still works (F). Something lit up in the observation room.'),
      T('One backup monitor turned on by itself in the observation room.'),
      T('Go to the small monitor on the east side of the observation room and look at it.'),
    ],
  },
  {
    id: 'final', part: 3, title: T('Observation Active'), objective: T('A new recording has been detected'),
    done: (s) => !!s.flags.chapter3Done,
    target: () => at('facility', FX.finalMonitor),
    start: { thought: T('The big screen on the monitor wall is blinking. It wants me to see something.'), delay: 2.0 },
    hints: [
      T('The monitor wall in the observation room woke up.'),
      T('The big screen in the middle of the monitor wall.'),
      T('Go to the middle of the monitor wall in the observation room and press E.'),
    ],
  },

  // ============================== PART 4 (teaser)
  {
    id: 'part4', part: 4, title: T('Phase 3'), en: 'Someone has been watching.',
    objective: T('Part 4, coming soon'), final: true,
    done: () => false,
    target: () => null,
  },
];

export const PART_SIZES = { 1: 6, 2: 9, 3: 11 };
export const PART_START = { 1: 0, 2: 6, 3: 15, 4: 26 };
export const PART_TITLES = { 1: T('The Crash'), 2: T('The Signal'), 3: T('The Observer') };
export const questById = (id) => QUESTS.findIndex((q) => q.id === id);
