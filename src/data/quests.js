// The whole mission chain as data. Each quest becomes active after the previous one is done.
// Indices 0–5 are Part 1 and must keep their order (saved games store questIndex).
import { LAYOUT, ITEM_SPOTS } from '../zones/beach/layout.js';
import { FL } from '../zones/forest/layout.js';

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
    id: 'wake', part: 1, hints: ['Look around: something big and white is lying on the beach.', 'The fuselage is north-east of where I woke up.', 'Walk up to the fuselage or check its open end.'], title: 'Awakening', objective: 'Explore the crash site',
    done: (s) => s.flags.exploredWreck,
    target: () => at('beach', fuselageEnd),
  },
  {
    id: 'gear', part: 1, hints: ['Things from the plane are scattered in the wreckage. A small sparkle marks something you can pick up.', 'Search by the fuselage, the broken wing and the thrown seats.', 'Water: by the side of the fuselage. Flashlight: by the wing, to the west. Bandage: by the seats, to the east.'], title: 'Gathering Supplies', objective: 'Find supplies in the wreckage',
    sub: (s, I) => ['water', 'flashlight', 'bandage'].map((id) => ({ label: I[id].name, done: has(s, id) })),
    done: (s) => has(s, 'water') && has(s, 'flashlight') && has(s, 'bandage'),
    target: (s, pos) => nearest('beach', ['water', 'flashlight', 'bandage'].filter((id) => !has(s, id)).map((id) => ITEM_SPOTS[id]), pos),
    start: { thought: 'I need water, light and something for my arm. Maybe in the wreckage.', delay: 1.2 },
  },
  {
    id: 'suitcase', part: 1, hints: ['Something black is stuck between the rocks.', 'At the west end of the beach there is a gap between big rocks.', 'You need the flashlight to open the suitcase.'], title: 'The Black Suitcase', objective: 'Find the strange black suitcase and open it',
    done: (s) => s.flags.suitcaseOpened,
    target: () => at('beach', LAYOUT.blackSuitcase),
    start: { thought: 'I saw something black in the rocks at the west end of the beach.', delay: 1.2 },
  },
  {
    id: 'booklet', part: 1, title: 'The Booklet', objective: 'Take the booklet, open it (J) and read the message',
    sub: (s) => [{ label: 'Take the booklet', done: has(s, 'booklet') }, { label: 'Open it (J) and read', done: s.flags.bookletRead }],
    done: (s) => has(s, 'booklet') && s.flags.bookletRead,
    target: (s) => (has(s, 'booklet') ? null : at('beach', LAYOUT.blackSuitcase)),
  },
  {
    id: 'clues', part: 1, hints: ['The map in the booklet (J) has two X marks.', 'One near the west beach and one near the jungle trail.', 'The ticket: at the west end of the beach, by the water. The device: on the trail into the jungle, north of the fuselage.'], title: 'The Clues', objective: 'Find the places marked on the booklet map',
    sub: (s, I) => ['ticket', 'device'].map((id) => ({ label: I[id].name, done: has(s, id) })),
    done: (s) => has(s, 'ticket') && has(s, 'device'),
    target: (s, pos) => nearest('beach', ['ticket', 'device'].filter((id) => !has(s, id)).map((id) => ITEM_SPOTS[id]), pos),
    start: { thought: 'The booklet map has two X marks. Both are close to here.', delay: 0.8 },
  },
  {
    id: 'reveal', part: 1, hints: ['The label said CACHE / TAIL.', 'TAIL is the plane\'s tail, by the edge of the forest.', 'Search by the cargo container next to the tail.'], title: 'The Discovery', objective: 'Search near the tail for what the CACHE / TAIL label points to',
    done: (s) => has(s, 'document'),
    cinematic: 'reveal', // advancing waits for the "THE CRASH WAS NO ACCIDENT." sequence
    target: () => at('beach', ITEM_SPOTS.document),
    start: { thought: 'TAIL. The plane\'s tail. What is waiting there?', delay: 0.8 },
  },

  // ============================== PART 2
  {
    id: 'enter', part: 2, title: 'The Signal', en: 'Find the source of the signal in the forest.',
    objective: 'The north trail, behind the tail, leads into the forest',
    done: (s) => s.zone === 'forest',
    target: () => ({ zone: 'beach', x: 1, z: -97 }),
    hints: [
      'The red light appeared above the forest, to the north.',
      'A dirt trail starts behind the tail.',
      'Go north on the trail by the tail until it enters the trees.',
    ],
  },
  // From here on the forest has no compass: the player navigates by the red light, the trails and the booklet map.
  {
    id: 'follow', part: 2, title: 'The Red Light', objective: 'The red light blinks above the treetops',
    done: (s) => s.flags.reachedTransmitter,
    target: () => at('forest', FL.transmitter),
    start: { thought: 'The red light blinks above the treetops. Somewhere ahead of me.', delay: 1.5 },
    hints: [
      'Look up: the red light shows above the trees. When it gets bigger, I am getting closer.',
      'The trail winds, but it crosses the stream on a log bridge and keeps going toward the light.',
      'The transmitter is in a clearing to the north-west, at the end of the main trail after the bridge.',
    ],
  },
  {
    id: 'power', part: 2, title: 'Power Source', objective: 'The transmitter is dead. Something was taken from it.',
    sub: (s) => [
      { label: 'The supply crate', done: !!s.flags.crateOpen || has(s, 'powerCell') },
      { label: 'The power cell', done: has(s, 'powerCell') },
    ],
    done: (s) => has(s, 'powerCell'),
    target: () => at('forest', FL.powerCell),
    hints: [
      'Check the mud around the transmitter, and the tree bark along the tracks. Something is carved into it.',
      'Compare the carved symbols (booklet: “Carved Symbols”) with the symbols on the lock wheels. Notice the notches too.',
      'Each carved symbol has 1, 2 or 3 notches: that is its place in the lock. Order: wave (one notch), triangle (two), spiral (three).',
    ],
  },
  {
    id: 'activate', part: 2, title: 'The Transmitter', objective: 'Bring the transmitter back to life',
    sub: (s) => [
      { label: 'Power cell in place', done: !!s.flags.cellInserted || !!s.flags.powerInstalled },
      { label: 'Wiring', done: !!s.flags.wired || !!s.flags.powerInstalled },
      { label: 'Frequency', done: !!s.flags.powerInstalled },
    ],
    done: (s) => s.flags.powerInstalled,
    target: () => at('forest', FL.transmitter),
    hints: [
      'Read the service card in the booklet again. Each sentence sets one thing.',
      'Match each rule on the card to terminals 1–4, top to bottom. Start with the rule that points to only one terminal.',
      'Green on top (1). Blue next to green, so 2. Yellow not at the bottom, so 3. Red is 4. For the frequency: watch the signal meter and stop when it is full.',
    ],
  },
  {
    id: 'camp', part: 2, title: 'The Camp', objective: 'What was this place?',
    sub: (s) => [
      { label: 'The tent', done: s.flags.tentSeen },
      { label: 'The hut', done: s.flags.cabinSeen },
      { label: 'The table', done: s.flags.tableSeen },
    ],
    done: (s) => s.flags.tentSeen && s.flags.cabinSeen && s.flags.tableSeen,
    target: (s, pos) => nearest('forest', [
      !s.flags.tentSeen && FL.tent, !s.flags.cabinSeen && FL.cabin, !s.flags.tableSeen && FL.table,
    ].filter(Boolean), pos),
    start: { thought: 'The relay broadcast something about a camp.', delay: 6 },
    hints: [
      'The broadcast mentioned a camp. The trail goes on from the transmitter, deeper into the forest.',
      'Follow the trail north-east from the transmitter to a big clearing with a tent and a hut.',
      'There are three things to check in the camp: the tent, the table under the tarp, and the map on the wall inside the hut.',
    ],
  },
  {
    id: 'locker', part: 2, title: 'The Locked Locker', objective: 'A metal locker with a keypad',
    done: (s) => s.flags.lockerOpen,
    target: () => at('forest', FL.locker),
    hints: [
      'Read the sign on the locker: APPROVAL / ARRIVAL. Two words, two moments.',
      'Compare the calendar in the hut with the internal document from the beach and the boarding pass in the booklet.',
      'APPROVAL is the day the route change was approved: 14. ARRIVAL is the day we crashed: 23. The code: 1423.',
    ],
  },
  {
    id: 'docs', part: 2, title: 'Inside the Locker', objective: 'What did they keep here?',
    sub: (s, I) => ['researchDoc', 'schedule'].map((id) => ({ label: I[id].name, done: has(s, id) })),
    done: (s) => has(s, 'researchDoc') && has(s, 'schedule'),
    target: () => at('forest', FL.locker),
  },
  {
    id: 'evidence', part: 2, title: 'The Observer', objective: 'Someone watched the camp. From where?',
    done: (s) => has(s, 'routeChart') && s.flags.encounterDone,
    target: () => at('forest', FL.post),
    start: { thought: '“Observer: east ridge.” Where can you see the whole forest from here?', delay: 1.0 },
    hints: [
      'Read the shift schedule in the booklet: where did the observer sit?',
      'Compare the ridge in the schedule with what you see through the binoculars at the edge of camp, and with the fresh tracks heading east.',
      'The lookout is on the east ridge, above the cliff. There is one way up, south-east of the camp.',
    ],
  },
  {
    id: 'return', part: 2, title: 'The Call', objective: 'The transmitter is calling',
    done: (s) => s.flags.endingSeen,
    target: () => at('forest', FL.transmitter),
  },

  // ============================== PART 3 (teaser)
  {
    id: 'part3', part: 3, title: 'Lights in the Forest', en: 'Someone is still here.',
    objective: 'Part 3, coming soon', final: true,
    done: () => false,
    target: () => null,
  },
];

export const PART_SIZES = { 1: 6, 2: 9 };
export const questById = (id) => QUESTS.findIndex((q) => q.id === id);
