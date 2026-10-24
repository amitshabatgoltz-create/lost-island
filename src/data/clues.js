// Booklet entries. Order = order of slots in the booklet. `part` groups them under a heading.
// `desc` may be a function of the game state (entries that fill in as the player discovers more).
import { CARVINGS, symbolName, SYMBOLS, WIRING_RULES } from './puzzles.js';

const notchWord = (n) => ['', 'one notch', 'two notches', 'three notches'][n];
export const BOOKLET_MESSAGE = 'If you are reading this, the plan went wrong.';
export const FINAL_ENTRY = 'Someone is still here.';
export const LOCKED_FUTURE_SLOTS = 2; // pages for Part 4

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

const FRAGMENT_SVG = `<svg viewBox="0 0 300 200" class="clue-art" role="img" aria-label="The missing northern piece of the booklet map">
  <path d="M8 196 L12 40 Q40 18 70 26 L118 10 L170 22 L232 8 L292 30 L288 120 L276 150 L292 196 Z" fill="#ddd0ae" stroke="#9a835f" stroke-width="2"/>
  <path d="M8 196 L40 188 L70 196 L96 186 L130 196 L160 188 L196 196 L230 186 L262 196 L292 196" fill="none" stroke="#9a835f" stroke-width="2" stroke-dasharray="2 3"/>
  <path d="M40 196 Q46 150 60 120 T70 60 M250 196 Q244 150 236 120 T228 60" fill="none" stroke="#5a4630" stroke-width="1.6"/>
  <path d="M70 60 Q150 40 228 60" fill="none" stroke="#5a4630" stroke-width="3"/>
  <g stroke="#5a4630" stroke-width="1.2"><path d="M80 56 l-4 -9 M100 51 l-3 -9 M120 48 l-2 -9 M140 46 l0 -9 M160 46 l1 -9 M180 47 l2 -9 M200 50 l3 -9 M220 55 l4 -9"/></g>
  <path d="M150 196 Q140 170 150 150 T146 110 Q150 90 150 74" fill="none" stroke="#7a5a35" stroke-width="1.6" stroke-dasharray="3 3"/>
  <rect x="142" y="62" width="16" height="10" fill="none" stroke="#3a2e20" stroke-width="2"/>
  <g stroke="#8a2c1f" stroke-width="3" stroke-linecap="round"><path d="M143 64 l14 14 M157 64 l-14 14"/></g>
  <text x="164" y="74" font-size="14" fill="#8a2c1f" font-weight="700" font-family="monospace">N-1</text>
  <line x1="168" y1="20" x2="168" y2="44" stroke="#3a2e20" stroke-width="2"/><circle cx="168" cy="18" r="3" fill="#8a2c1f"/>
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
  // ---------------- Part 3
  {
    id: 'fieldRecorder', part: 3, title: 'Field Recorder',
    desc: 'A battered field recorder on a crate at an abandoned tarp camp, the tape still inside. The last entry, in a tired voice: “Day 61. The north door still takes the old badges. GEN-2 has blown its main fuse again. Spares are in the crates on the slope. I am not going back inside. Not after what the screens showed.”',
    note: 'Someone camped here, next to a door they were afraid to open. A door that takes badges, and a generator that needs a fuse.',
  },
  {
    id: 'mapFragment', part: 3, title: 'The Missing Piece of the Map',
    desc: 'A soggy piece of paper, half-buried by the trail. Its torn edge matches my booklet map exactly: it is the missing northern part. It shows this valley, the cliff, a mast, and a small square drawn into the rock, crossed out in red: “N-1”.',
    note: 'Someone tore this off the booklet so that nobody would find the way here. Or so that only one person would.',
    art: FRAGMENT_SVG,
  },
  {
    id: 'memo', part: 3, title: 'NIGHTJAR — Internal Research Memorandum',
    desc: '“Project NIGHTJAR remains under restricted observation.<br>The island\'s anomalous conditions continue to interfere with external communications and long-range tracking.<br>All personnel must follow the revised observation protocol.<br>Unauthorized contact with individuals outside the project is prohibited.”<br><br>Distribution: N-1 staff only. Stamped RESTRICTED.',
    note: '“Anomalous conditions.” That is why no rescue has come. Nobody outside can even find this island.',
  },
  {
    id: 'passengerReport', part: 3, title: 'Passenger Classification Report',
    desc: '“Flight NV 2207 — Restricted Passenger Assessment.<br>Passenger records were reviewed before departure.<br>Several passengers were assigned internal observation classifications.<br>Flight route modification: approved (ref. 14 SEP).<br>Observation window opened: 02:40.<br>Seat 31A: classification restricted. See restricted archive.<br>Additional details require Level 4 authorization.”',
    note: 'Approved on September 14, the same date as the document by the tail. They sorted us before we even sat down. And 31A again: the empty seat next to mine.',
  },
  {
    id: 'fieldNote', part: 3, title: 'Unfiled Field Note',
    desc: 'A folded page in the pocket of a dark raincoat, left in a locker at the checkpoint. Pencil, pressed hard: “If the system is still active, someone is still watching. Do not trust a transmission simply because it uses a familiar voice. The observation room is not as isolated as the records claim.” Signed with one letter: “N.”',
    note: 'A dark raincoat, like the one in the photo from the camp. I still have never seen N.\'s face. And the voice on the radio: “do not trust anyone”... was that N.? Or someone using N.\'s voice?',
  },
  {
    id: 'discrepancies', part: 3, title: 'Personnel and Subject Discrepancies',
    desc: '“Several individuals listed as transferred remain unaccounted for.<br>Records contain overlapping dates and contradictory arrival reports.<br>Reconciliation of the archive is pending.”<br><br>Attached: a list of names with two arrival dates each, years apart. Some of the dates are after today.',
    note: 'Arrival dates that have not happened yet. That cannot be a typing mistake, not this many times.',
  },
  {
    id: 'file31a', part: 3, title: 'Restricted File — 31A',
    desc: '“Classification: OBSERVER.<br>Status: Unresolved.<br>Monitoring instructions: Do not disclose the classification to other subjects.<br>Additional records have been transferred to the restricted archive.”<br><br>The photo clip is empty. The name line is blacked out.',
    note: 'OBSERVER. The seat nobody sat in has the same title as the person who watched us from the ridge. Who was supposed to be in 31A?',
  },
  {
    id: 'recording', part: 3, title: 'Restricted Recording',
    desc: '“Observation log. Flight NV 2207 has entered the designated observation window. Passenger classifications have been confirmed. The observer designation remains restricted. If the subject reaches the facility, do not initiate direct contact. Repeat: do not initiate direct contact.”<br><br>The rest, recovered from the memory device: “...the subject\'s arrival at N-1 is anticipated. Observation continues from the secondary room. Phase 3 begins when the subject—”',
    note: 'They knew I would get here. They planned for it. “The subject” is me.',
  },
  {
    id: 'phase3', part: 3, title: 'Observation Active',
    desc: 'The big screen in the observation room: “NIGHTJAR SYSTEM · SUBJECT 31A · OBSERVATION ACTIVE · A NEW RECORDING HAS BEEN DETECTED.” Then one voice: “If you can hear this, they\'ve already found you.” Something knocked behind the sealed door. The screen went dark, and one last line stayed on it: NIGHTJAR PROTOCOL — PHASE 3 ACTIVATED.',
    note: 'Someone has been watching.',
    noteEn: true,
  },
];
