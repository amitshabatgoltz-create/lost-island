// Every item in the game, one registry for everything.
//   kind 'key'      — tools the player always carries (never stored, no slot)
//   kind 'gear'     — carried items with a quantity; can be stored (stack = max per slot)
//   kind 'resource' — materials for future crafting; stackable and storable
//   kind 'clue'     — booklet entries (not physical inventory)
export const ITEMS = {
  // ---- Part 1 (beach)
  water: { name: 'Water Bottle', kind: 'gear', stack: 5, toast: 'Picked up: water bottle', desc: 'A sealed bottle, almost full. It will last me a day, maybe two.' },
  flashlight: { name: 'Flashlight', kind: 'key', toast: 'Picked up: flashlight. Press F to turn it on', desc: 'A small metal flashlight. The battery is still alive.' },
  bandage: { name: 'Bandage', kind: 'gear', stack: 5, toast: 'Picked up: bandage', desc: 'A small first aid kit. I bandaged the cut on my arm.' },
  booklet: { name: 'The Mysterious Booklet', kind: 'key', clue: true, toast: 'Picked up: the mysterious booklet. Press J to open it' },
  ticket: { name: 'Torn Boarding Pass', kind: 'clue', toast: 'New clue: torn boarding pass' },
  device: { name: 'Memory Device', kind: 'clue', toast: 'New clue: memory device' },
  document: { name: 'Internal Document', kind: 'clue', toast: 'New clue: internal document' },
  // ---- Part 2 (forest)
  powerCell: { name: 'Power Cell', kind: 'key', toast: 'Picked up: power cell', desc: 'A heavy industrial battery with the same symbol. The gauge shows it is still charged.' },
  // ---- resources (base camp update)
  wood: { name: 'Scrap Wood', kind: 'resource', stack: 20, desc: 'Planks and dry branches. You can build something with them.' },
  rope: { name: 'Rope', kind: 'resource', stack: 10, desc: 'Strong nylon rope from suitcase straps and cargo ties.' },
  cloth: { name: 'Cloth', kind: 'resource', stack: 10, desc: 'Seat padding and blankets. Good for bandages, a roof or insulation.' },
  battery: { name: 'Batteries', kind: 'resource', stack: 12, desc: 'AA and 9-volt batteries. Some of them still work.' },
  electronics: { name: 'Electronics', kind: 'resource', stack: 12, desc: 'Circuits, wires and connectors. Maybe you can fix something with them.' },
  carvings: { name: 'Carved Symbols', kind: 'clue', toast: 'Added to the booklet: carved symbols' },
  serviceCard: { name: 'Service Card', kind: 'clue', toast: 'New clue: service card, RELAY 04' },
  calendar: { name: 'Calendar', kind: 'clue', toast: 'Added to the booklet: the calendar from the hut' },
  radioLog: { name: 'Damaged Radio Log', kind: 'clue', toast: 'New clue: damaged radio log' },
  photo: { name: 'Photograph', kind: 'clue', toast: 'New clue: photograph' },
  campMap: { name: 'Camp Map', kind: 'clue', toast: 'New clue: hand-drawn map' },
  researchDoc: { name: 'Research Protocol', kind: 'clue', toast: 'New clue: research protocol' },
  schedule: { name: 'Lookout Schedule', kind: 'clue', toast: 'New clue: lookout shift schedule' },
  routeChart: { name: 'Flight Route Chart', kind: 'clue', toast: 'New clue: flight route chart' },
  stillHere: { name: 'Last Entry', kind: 'clue', toast: 'A new entry was added to the booklet' },
  // ---- Part 3 (the northern ridge and the observation facility)
  badge: { name: 'Access Badge', kind: 'key', toast: 'Picked up: NIGHTJAR access badge', desc: 'A muddy NIGHTJAR badge: “FIELD STATION N-1 · LEVEL 2”. The photo has been torn off.' },
  fuse: { name: 'Main Fuse', kind: 'key', toast: 'Picked up: main fuse, 40 A', desc: 'A heavy cartridge fuse in its packing, stamped “GEN-2 · MAIN · 40 A”.' },
  fieldRecorder: { name: 'Field Recorder', kind: 'clue', toast: 'New clue: field recorder' },
  mapFragment: { name: 'Map Fragment', kind: 'clue', toast: 'New clue: the missing piece of the map' },
  memo: { name: 'Internal Memorandum', kind: 'clue', toast: 'New document: NIGHTJAR internal memorandum' },
  passengerReport: { name: 'Passenger Classification Report', kind: 'clue', toast: 'New document: passenger classification report' },
  fieldNote: { name: 'Unfiled Field Note', kind: 'clue', toast: 'New document: unfiled field note' },
  discrepancies: { name: 'Personnel and Subject Discrepancies', kind: 'clue', toast: 'New document: personnel and subject discrepancies' },
  file31a: { name: 'Restricted File: 31A', kind: 'clue', toast: 'New document: restricted file 31A' },
  recording: { name: 'Restricted Recording', kind: 'clue', toast: 'Added to the booklet: the restricted recording' },
  phase3: { name: 'Observation Active', kind: 'clue', toast: 'A new entry was added to the booklet' },
};

export const KEY_ORDER = ['flashlight', 'booklet', 'powerCell', 'badge', 'fuse'];
export const isStorable = (id) => !!ITEMS[id] && (ITEMS[id].kind === 'gear' || ITEMS[id].kind === 'resource');

export const SUITCASE_THOUGHTS = [
  'Wet clothes and sneakers. Nothing that will help me.',
  'Someone packed books for a vacation. None of them will save me.',
  'Swimsuits, sunscreen and a photo of a little girl. I close it fast.',
  'Empty. Did someone already open it? Or did it burst open in the fall?',
  'A flight attendant\'s carry-on: a uniform, safety lists. The name on the tag is smudged.',
  'A locked suitcase. The lock is crushed, it won\'t open.',
  'Bags of coffee, birthday presents. Someone else\'s vacation.',
];
