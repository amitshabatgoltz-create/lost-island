// Every item in the game, one registry for everything.
//   kind 'key'      — tools the player always carries (never stored, no slot)
//   kind 'gear'     — carried items with a quantity; can be stored (stack = max per slot)
//   kind 'resource' — materials for future crafting; stackable and storable
//   kind 'clue'     — booklet entries (not physical inventory)
import { T } from '../i18n/index.js';
export const ITEMS = {
  // ---- Part 1 (beach)
  water: { name: T('Water Bottle'), kind: 'gear', stack: 5, toast: T('Picked up: water bottle'), desc: T('A sealed bottle, almost full. It will last me a day, maybe two.') },
  flashlight: { name: T('Flashlight'), kind: 'key', toast: T('Picked up: flashlight. Press F to turn it on'), desc: T('A small metal flashlight. The battery is still alive.') },
  bandage: { name: T('Bandage'), kind: 'gear', stack: 5, toast: T('Picked up: bandage'), desc: T('A small first aid kit. I bandaged the cut on my arm.') },
  booklet: { name: T('The Mysterious Booklet'), kind: 'key', clue: true, toast: T('Picked up: the mysterious booklet. Press J to open it') },
  ticket: { name: T('Torn Boarding Pass'), kind: 'clue', toast: T('New clue: torn boarding pass') },
  device: { name: T('Memory Device'), kind: 'clue', toast: T('New clue: memory device') },
  document: { name: T('Internal Document'), kind: 'clue', toast: T('New clue: internal document') },
  // ---- Part 2 (forest)
  powerCell: { name: T('Power Cell'), kind: 'key', toast: T('Picked up: power cell'), desc: T('A heavy industrial battery with the same symbol. The gauge shows it is still charged.') },
  // ---- resources (base camp update)
  wood: { name: T('Scrap Wood'), kind: 'resource', stack: 20, desc: T('Planks and dry branches. You can build something with them.') },
  rope: { name: T('Rope'), kind: 'resource', stack: 10, desc: T('Strong nylon rope from suitcase straps and cargo ties.') },
  cloth: { name: T('Cloth'), kind: 'resource', stack: 10, desc: T('Seat padding and blankets. Good for bandages, a roof or insulation.') },
  battery: { name: T('Batteries'), kind: 'resource', stack: 12, desc: T('AA and 9-volt batteries. Some of them still work.') },
  electronics: { name: T('Electronics'), kind: 'resource', stack: 12, desc: T('Circuits, wires and connectors. Maybe you can fix something with them.') },
  carvings: { name: T('Carved Symbols'), kind: 'clue', toast: T('Added to the booklet: carved symbols') },
  serviceCard: { name: T('Service Card'), kind: 'clue', toast: T('New clue: service card, RELAY 04') },
  calendar: { name: T('Calendar'), kind: 'clue', toast: T('Added to the booklet: the calendar from the hut') },
  radioLog: { name: T('Damaged Radio Log'), kind: 'clue', toast: T('New clue: damaged radio log') },
  photo: { name: T('Photograph'), kind: 'clue', toast: T('New clue: photograph') },
  campMap: { name: T('Camp Map'), kind: 'clue', toast: T('New clue: hand-drawn map') },
  researchDoc: { name: T('Research Protocol'), kind: 'clue', toast: T('New clue: research protocol') },
  schedule: { name: T('Lookout Schedule'), kind: 'clue', toast: T('New clue: lookout shift schedule') },
  routeChart: { name: T('Flight Route Chart'), kind: 'clue', toast: T('New clue: flight route chart') },
  stillHere: { name: T('Last Entry'), kind: 'clue', toast: T('A new entry was added to the booklet') },
  // ---- Part 3 (the northern ridge and the observation facility)
  badge: { name: T('Access Badge'), kind: 'key', toast: T('Picked up: NIGHTJAR access badge'), desc: T('A muddy NIGHTJAR badge: “FIELD STATION N-1 · LEVEL 2”. The photo has been torn off.') },
  fuse: { name: T('Main Fuse'), kind: 'key', toast: T('Picked up: main fuse, 40 A'), desc: T('A heavy cartridge fuse in its packing, stamped “GEN-2 · MAIN · 40 A”.') },
  fieldRecorder: { name: T('Field Recorder'), kind: 'clue', toast: T('New clue: field recorder') },
  mapFragment: { name: T('Map Fragment'), kind: 'clue', toast: T('New clue: the missing piece of the map') },
  memo: { name: T('Internal Memorandum'), kind: 'clue', toast: T('New document: NIGHTJAR internal memorandum') },
  passengerReport: { name: T('Passenger Classification Report'), kind: 'clue', toast: T('New document: passenger classification report') },
  fieldNote: { name: T('Unfiled Field Note'), kind: 'clue', toast: T('New document: unfiled field note') },
  discrepancies: { name: T('Personnel and Subject Discrepancies'), kind: 'clue', toast: T('New document: personnel and subject discrepancies') },
  file31a: { name: T('Restricted File: 31A'), kind: 'clue', toast: T('New document: restricted file 31A') },
  recording: { name: T('Restricted Recording'), kind: 'clue', toast: T('Added to the booklet: the restricted recording') },
  phase3: { name: T('Observation Active'), kind: 'clue', toast: T('A new entry was added to the booklet') },
};

export const KEY_ORDER = ['flashlight', 'booklet', 'powerCell', 'badge', 'fuse'];
export const isStorable = (id) => !!ITEMS[id] && (ITEMS[id].kind === 'gear' || ITEMS[id].kind === 'resource');

export const SUITCASE_THOUGHTS = [
  T('Wet clothes and sneakers. Nothing that will help me.'),
  T('Someone packed books for a vacation. None of them will save me.'),
  T('Swimsuits, sunscreen and a photo of a little girl. I close it fast.'),
  T('Empty. Did someone already open it? Or did it burst open in the fall?'),
  T('A flight attendant\'s carry-on: a uniform, safety lists. The name on the tag is smudged.'),
  T('A locked suitcase. The lock is crushed, it won\'t open.'),
  T('Bags of coffee, birthday presents. Someone else\'s vacation.'),
];
