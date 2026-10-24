// Booklet entries. Order = order of slots in the booklet. `part` groups them under a heading.
// `desc` may be a function of the game state (entries that fill in as the player discovers more).
import { CARVINGS, symbolName, SYMBOLS, WIRING_RULES } from './puzzles.js';

const notchWord = (n) => ['', 'one notch', 'two notches', 'three notches'][n];
export const BOOKLET_MESSAGE = 'If you are reading this, the plan went wrong.';
export const FINAL_ENTRY = 'Someone is still here.';
export const LOCKED_FUTURE_SLOTS = 2; // pages for Part 3

const PHOTO_SVG = `<svg viewBox="0 0 300 200" class="clue-art" role="img" aria-label="Photo: the island from the sea and a person in a raincoat">
  <defs><filter id="grain"><feTurbulence baseFrequency="0.9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.18  0 0 0 0.22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>
  <rect x="6" y="6" width="288" height="188" fill="#c9b48e" stroke="#f1e8d4" stroke-width="10"/>
  <rect x="11" y="11" width="278" height="110" fill="#b39a72"/>
  <path d="M11 104 L60 74 L96 82 L130 50 L160 38 L188 56 L220 62 L250 84 L289 92 L289 121 L11 121 Z" fill="#6b5b43"/>
  <path d="M11 121 L289 121 L289 189 L11 189 Z" fill="#8f7a58"/>
  <path d="M30 140 q20 -4 40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="#a89070" stroke-width="2"/>
  <g stroke="#3c3226" stroke-width="2"><line x1="210" y1="120" x2="214" y2="40"/><line x1="222" y1="120" x2="215" y2="40"/><line x1="211" y1="100" x2="221" y2="100"/><line x1="212" y1="80" x2="219" y2="80"/><line x1="213" y1="60" x2="218" y2="60"/></g>
  <circle cx="214.5" cy="38" r="3" fill="#7a2a20"/>
  <path d="M170 189 L174 142 Q176 126 186 124 Q197 126 198 142 L202 189 Z" fill="#2c2a26"/>
  <ellipse cx="186" cy="116" rx="9" ry="10" fill="#2c2a26"/>
  <path d="M176 112 Q186 100 196 112" fill="#3a3832"/>
  <rect x="6" y="6" width="288" height="188" filter="url(#grain)" opacity="0.9"/>
</svg>`;

const CAMP_MAP_SVG = `<svg viewBox="0 0 300 220" class="clue-art" role="img" aria-label="Hand-drawn map of the forest">
  <rect x="4" y="4" width="292" height="212" rx="3" fill="#ddd0ae" stroke="#9a835f" stroke-width="2"/>
  <path d="M20 200 Q90 186 150 198 T282 192" fill="none" stroke="#5a4630" stroke-width="2" stroke-dasharray="5 4"/>
  <text x="200" y="212" font-size="10" fill="#5a4630" font-family="monospace">SHORE</text>
  <path d="M30 120 Q80 112 130 126 T270 116" fill="none" stroke="#4d6f86" stroke-width="3"/>
  <path d="M150 196 L148 160 L140 120 L120 90 L100 70" fill="none" stroke="#7a5a35" stroke-width="1.6" stroke-dasharray="3 3"/>
  <path d="M100 70 L130 54 L172 40" fill="none" stroke="#7a5a35" stroke-width="1.6" stroke-dasharray="3 3"/>
  <circle cx="98" cy="70" r="6" fill="none" stroke="#3a2e20" stroke-width="2"/><text x="60" y="66" font-size="11" fill="#3a2e20">RELAY</text>
  <rect x="168" y="30" width="16" height="12" fill="none" stroke="#3a2e20" stroke-width="2"/><text x="190" y="40" font-size="11" fill="#3a2e20">CAMP</text>
  <path d="M236 20 L236 150" stroke="#5a4630" stroke-width="1" /><path d="M236 20 l6 6 M236 40 l6 6 M236 60 l6 6 M236 80 l6 6 M236 100 l6 6 M236 120 l6 6" stroke="#5a4630"/>
  <text x="244" y="70" font-size="10" fill="#3a2e20">RIDGE</text>
  <g stroke="#8a2c1f" stroke-width="3" stroke-linecap="round"><path d="M142 188 l12 12 M154 188 l-12 12"/></g>
  <text x="96" y="178" font-size="12" fill="#8a2c1f" font-weight="700">LZ-2</text>
</svg>`;

export const CLUES = [
  // ---------------- Part 1
  {
    id: 'booklet', part: 1, title: 'The Booklet',
    desc: 'A black leather cover with a symbol I have never seen: a broken circle, a vertical line and two dots. Inside: a partial map of the island and one handwritten line.',
    note: 'Who carries a map of an island nobody is supposed to know?',
  },
  {
    id: 'ticket', part: 1, title: 'Torn Boarding Pass',
    desc: 'A boarding pass, flight NV 2207, seat 31A. The part with the passenger\'s name is torn off.',
    note: '31A is the seat next to mine. It was empty the whole flight. Someone booked it and never boarded.',
  },
  {
    id: 'device', part: 1, title: 'Memory Device',
    desc: 'A small device with the same symbol engraved on it. A blue light is still blinking. A label on the side says: CACHE / TAIL.',
    note: 'TAIL: the tail. The back of the plane fell near the edge of the forest.',
  },
  {
    id: 'document', part: 1, title: 'Internal Document',
    desc: 'A printed page in a plastic sleeve, carrying the symbol. Date: September 14, nine days before the flight. Subject: NV 2207 / 23 SEP. “Route deviation approved.” The rest is blacked out.',
    note: 'They knew about my flight nine days ahead. They knew where it would end up.',
  },
  // ---------------- Part 2
  {
    id: 'carvings', part: 2, title: 'Carved Symbols',
    desc: (s) => {
      const found = CARVINGS.filter((c) => s.flags[c.id]);
      const lines = found.map((c) => `${SYMBOLS.find((x) => x.id === c.symbol).svg.replace('<svg', '<svg class="glyph"')} ${symbolName(c.symbol)} — ${notchWord(c.notches)}`);
      return 'Symbols carved into tree bark along the tracks leading from the transmitter. Under each symbol: notches.<br><br>' +
        (lines.length ? lines.join('<br>') : '') + (found.length < CARVINGS.length ? `<br><br><i>Found ${found.length} of ${CARVINGS.length}.</i>` : '');
    },
    note: 'The same symbols are on the supply crate\'s lock. The notches... maybe an order?',
  },
  {
    id: 'serviceCard', part: 2, title: 'Service Card: RELAY 04',
    desc: 'A laminated card from the supply crate, next to the power cell: “Reconnecting the feed panel. Four terminals, numbered from top (1) to bottom (4).”<br><br>' + WIRING_RULES.map((r, i) => `${i + 1}. ${r}`).join('<br>'),
    note: 'Only three sentences. Read them right and there is only one way.',
  },
  {
    id: 'radioLog', part: 2, title: 'Damaged Radio Log',
    desc: 'When the transmitter woke up, the display printed what was left of its log. Most lines are erased. What remains: “Day 41 — crew left per protocol. One observer remains.” · “Day 52 — window confirmed 02:40. Relay NIGHTJAR, frequency 417.9.” · “Day 53 — do not answer civilian channels.”',
    note: '417.9, the same number engraved on the transmitter panel. And “one observer”. Someone stayed here on purpose.',
  },
  {
    id: 'photo', part: 2, title: 'Photograph',
    desc: 'A faded photo taken from the sea: the island, the transmitter mast, and in front a person in a dark raincoat with their back to the camera. On the back, in pen: “N. — first week. All according to plan.”',
    note: 'They stood by the mast where I stood an hour ago. No face, just one letter.',
    art: PHOTO_SVG,
  },
  {
    id: 'campMap', part: 2, title: 'Hand-drawn Map',
    desc: 'A map pinned to the wall of the hut. It marks the camp, the relay and the east ridge. At the south end, on the shoreline: a red X and the words LZ-2.',
    note: 'LZ-2 is exactly where the plane went down. The paper is yellowed: this map was drawn weeks ago.',
    art: CAMP_MAP_SVG,
  },
  {
    id: 'calendar', part: 2, title: 'Calendar from the Hut',
    desc: 'A calendar on the hut wall, open to September. Two days are circled in red: 14, with “APPROVED” next to it. 23, with “ARRIVAL · LZ-2”.',
    note: 'September 23 is the day we crashed. And 14... the date on the internal document from the beach.',
  },
  {
    id: 'researchDoc', part: 2, title: 'Research Protocol',
    desc: 'PROJECT NIGHTJAR — Phase 3 protocol. Date: August 2, seven weeks before the flight. “Phase goal: record the behavior of subjects in full isolation, without their knowledge. Method of entry: unplanned descent. Expected survivors: low. Do not make contact.”',
    note: 'Subjects. “Unplanned descent.” They call the crash an entry. This island is a lab.',
  },
  {
    id: 'schedule', part: 2, title: 'Lookout Shift Schedule',
    desc: 'A muddy shift sheet: “Observer — east ridge. Night shift. Report any movement at LZ-2.” The last line, handwritten: “23/9 · 02:41 — contact.”',
    note: '02:41. One minute after we crashed. Someone sat on the ridge waiting for us.',
  },
  {
    id: 'routeChart', part: 2, title: 'Flight Route Chart',
    desc: 'A printed chart of the NV 2207 route, date-stamped before takeoff. Over the original route someone drew a second line in pencil that turns south, to the island. Next to the turn: “02:14 — systems. 02:40 — descent.” In the margin: “31A — escort. Do not board.”',
    note: 'They knew the route before the plane took off. And the empty seat next to me: someone bought it so it would stay empty.',
  },
  {
    id: 'stillHere', part: 2, title: 'Last Entry',
    desc: 'After the broadcast, the lights in the forest came on one after another, and the red signal moved somewhere else. I wrote in the booklet what I can no longer deny:',
    note: 'Someone is still here.',
    noteEn: true,
  },
];
