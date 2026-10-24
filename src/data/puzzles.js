// All Part 2 puzzle definitions. Solutions live only here.

const svg = (d) => `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const sym = (id, name, path) => ({ id, name, path, svg: svg(path) });
// paths are drawn both as SVG (UI) and with canvas Path2D (bark carvings), on a 40×40 grid
export const SYMBOLS = [
  sym('circle', 'Circle', 'M8 20 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0'),
  sym('triangle', 'Triangle', 'M20 7 L33 31 H7 Z'),
  sym('wave', 'Wave', 'M5 20 q5 -9 10 0 t10 0 t10 0'),
  sym('eye', 'Eye', 'M5 20 Q20 6 35 20 Q20 34 5 20 Z M16 20 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0'),
  sym('spiral', 'Spiral', 'M20 20 m0 -2 a2 2 0 1 1 -2 2 a5 5 0 1 1 5 5 a8 8 0 1 1 -8 -8 a11 11 0 1 1 11 11'),
  sym('cross', 'Cross', 'M20 7 V33 M7 20 H33'),
];
export const symbolName = (id) => (SYMBOLS.find((s) => s.id === id) || {}).name;

// Carvings on trees along the boot prints from the transmitter to the supply drop.
// The notches give the order on the crate's lock; the trees are deliberately not in that order along the trail.
export const CARVINGS = [
  { id: 'carveA', symbol: 'triangle', notches: 2, tree: { x: -47.0, z: -24.6 }, look: { x: -48, z: -23.5 } },
  { id: 'carveB', symbol: 'spiral', notches: 3, tree: { x: -59.9, z: -38.1 }, look: { x: -61, z: -37 } },
  { id: 'carveC', symbol: 'wave', notches: 1, tree: { x: -66.4, z: -44.9 }, look: { x: -67.6, z: -43.4 } },
];
export const CRATE_CODE = ['wave', 'triangle', 'spiral'];

// Wiring logic puzzle: four wires, four terminals (1 = top). The service card states three rules
// that leave exactly one arrangement: green 1, blue 2, yellow 3, red 4.
export const WIRES = [
  { id: 'red', name: 'Red', color: '#d0453a' },
  { id: 'yellow', name: 'Yellow', color: '#e3b82d' },
  { id: 'green', name: 'Green', color: '#3fa55b' },
  { id: 'blue', name: 'Blue', color: '#3f7fd0' },
];
export const WIRING_RULES = [
  'Green goes on the top terminal.',
  'Blue sits right next to green.',
  'Yellow is never at the bottom.',
];
export const WIRING_SOLUTION = { green: 1, blue: 2, yellow: 3, red: 4 };

// Tuning: no number is written anywhere; the player listens for the signal.
export const TUNE = { min: 400, max: 430, target: 417.9, lock: 0.15, hold: 1.2 };

// Locker: “APPROVAL / ARRIVAL” — the flight was approved on 14 Sep (Part 1 document), the plane arrived on 23 Sep.
export const LOCKER_CODE = '1423';

// ---------------------------------------------------------------- Part 3
// Junction box outside the bunker door: the label inside the cover leaves one arrangement:
// green 1, orange 2, black 3, white 4.
export const JUNCTION_WIRES = [
  { id: 'black', name: 'Black', color: '#2b2b2b' },
  { id: 'white', name: 'White', color: '#e8e4da' },
  { id: 'orange', name: 'Orange', color: '#e07a2a' },
  { id: 'green', name: 'Green', color: '#3fa55b' },
];
export const JUNCTION_RULES = [
  'Green (earth) goes on the top terminal.',
  'White never sits next to green.',
  'Orange (feed) sits directly above black.',
];
export const JUNCTION_SOLUTION = { green: 1, orange: 2, black: 3, white: 4 };

// Archive terminal: “WINDOW CODE = DAY OF ARRIVAL + TIME THE WINDOW OPENED (DDHHMM)”.
// Arrival is the 23rd (calendar, schedule, document); the passenger report says the window opened at 02:40.
export const ARCHIVE_CODE = '230240';
