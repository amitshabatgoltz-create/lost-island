// Gameplay clarity: the main goal, and for each mission what the player knows, what is still unknown,
// the next action, and why it matters. Everything is derived from saved state, so nothing appears
// before the player has actually discovered it.

const has = (s, id) => s.collected.includes(id);
const f = (s, k) => !!s.flags[k];
const when = (cond, text) => (cond ? [text] : []);

// one short sentence for the whole current chapter of the story
export function mainGoal(s) {
  if (s.questIndex >= 26) return 'Someone has been watching, and NIGHTJAR Phase 3 has begun. The story continues in Part 4.';
  if (s.questIndex >= 19) return 'Find out what NIGHTJAR watched from inside the mountain, and what “OBSERVER” means.';
  if (s.questIndex >= 15) return 'The signal moved north. Someone is still here. Follow it and find out who.';
  if (s.questIndex >= 7) return 'The red signal may lead to someone who knows what happened. Find its source.';
  if (s.questIndex >= 6 || f(s, 'revealSeen')) return 'Someone knew about the crash before it happened. Find out who knew, and why.';
  return 'You survived the crash. Find supplies and figure out where you are.';
}

export const QUEST_INFO = {
  // ------------------------------------------------------------------ Part 1
  wake: {
    know: () => ['The plane crashed near an island I don\'t know.', 'I woke up on the beach. I can\'t see anyone.'],
    question: 'What is left of the plane, and where is everyone else?',
    objective: () => 'Go to the plane wreckage and search it.',
    why: 'There may be supplies in the wreckage, and maybe answers too.',
  },
  gear: {
    know: (s) => [
      'The fuselage is empty. No sign of the other passengers.',
      ...when(has(s, 'water'), 'I have a bottle of water.'),
      ...when(has(s, 'flashlight'), 'I found a working flashlight.'),
      ...when(has(s, 'bandage'), 'I bandaged the cut on my arm.'),
    ],
    question: 'How will I survive here until someone comes?',
    objective: () => 'Collect water, a flashlight and a bandage from the wreckage.',
    why: 'Without water and light I won\'t last, and the flashlight lets me go into dark places.',
  },
  suitcase: {
    know: () => ['I have water, a flashlight and a bandage.', 'I saw something black stuck between the rocks, on the west side of the beach.'],
    question: 'Why is a black suitcase in the rocks, far from all the wreckage?',
    objective: () => 'Find the black suitcase in the rocks and open it.',
    why: 'It doesn\'t look like an ordinary passenger\'s suitcase.',
  },
  booklet: {
    know: (s) => [
      'The black suitcase doesn\'t belong to any passenger.',
      'Inside there was only one booklet, wrapped in plastic.',
      ...when(has(s, 'booklet'), 'The cover has a symbol I have never seen.'),
    ],
    question: 'What does the booklet say?',
    objective: (s) => (has(s, 'booklet') ? 'Open the booklet (J) and read the first page.' : 'Take the booklet from the suitcase.'),
    why: 'Whoever left it here knew something about this flight.',
  },
  clues: {
    know: (s) => [
      'The booklet says: “If you are reading this, the plan went wrong.”',
      'The partial map in the booklet has two X marks.',
      ...when(has(s, 'ticket'), 'A boarding pass for seat 31A, the empty seat next to mine.'),
      ...when(has(s, 'device'), 'A memory device with the same symbol and a CACHE / TAIL label.'),
    ],
    question: 'What “plan” went wrong, and what is marked on the map?',
    objective: () => 'Check both places marked with an X on the booklet\'s map.',
    why: 'The marks were drawn before we crashed. Someone planned something here.',
  },
  reveal: {
    know: () => [
      'Someone booked seat 31A and never boarded.',
      'The device says CACHE / TAIL.',
      'The plane\'s tail fell near the edge of the forest.',
    ],
    question: 'What was hidden by the tail?',
    objective: () => 'Search near the tail for what the CACHE / TAIL label points to.',
    why: 'It may explain how someone knew about the flight in advance.',
  },
  // ------------------------------------------------------------------ Part 2
  enter: {
    know: () => [
      'The crash was no accident: a document from September 14 mentioned my flight.',
      'A red light is blinking above the forest, to the north.',
    ],
    question: 'Who is transmitting from the forest, and why?',
    objective: () => 'Enter the forest on the trail behind the tail.',
    why: 'The signal may lead to whoever knew about the crash.',
  },
  follow: {
    know: (s) => [
      'The red light blinks above the treetops.',
      'The trail winds deep into the forest.',
      ...when(f(s, 'figure1'), 'I saw someone, or something, moving between the trees.'),
    ],
    question: 'Where exactly is the signal coming from?',
    objective: () => 'Follow the red light through the trees to its source.',
    why: 'The signal may be the only way to reach someone on the island.',
  },
  power: {
    know: (s) => {
      const carvings = ['carveA', 'carveB', 'carveC'].filter((k) => f(s, k)).length;
      return [
        'The signal comes from a transmitter in a clearing, and it is dead.',
        'Someone pulled out its power cell.',
        ...when(f(s, 'printsPower'), 'Boot prints lead west from the transmitter.'),
        ...when(f(s, 'crateSeen'), 'A supply crate is locked with a three-symbol lock.'),
        ...when(carvings > 0, `I found ${carvings} of 3 symbols carved into trees, with notches under them.`),
      ];
    },
    question: 'Who took the power cell, and where?',
    objective: (s) => (f(s, 'crateOpen') ? 'Take the power cell from the crate.'
      : f(s, 'crateSeen') ? 'Open the symbol lock on the supply crate.'
        : 'Find the power cell taken from the transmitter.'),
    why: 'Without power the transmitter is silent, and I won\'t learn what it says.',
  },
  activate: {
    know: (s) => [
      'I have the power cell.',
      ...when(has(s, 'serviceCard'), 'The service card from the crate explains how to connect the wires (in the booklet).'),
      ...when(f(s, 'cellInserted'), 'The cell is in, but four wires are disconnected.'),
      ...when(f(s, 'wired'), 'The screen lit up, only static. The transmitter is searching for a station.'),
    ],
    question: 'What did this transmitter send, and to whom?',
    objective: (s) => (f(s, 'wired') ? 'Tune the frequency until the signal comes in.'
      : f(s, 'cellInserted') ? 'Connect the wires on the panel following the service card.'
        : 'Put the power cell into the transmitter.'),
    why: 'The broadcast is the first link to whoever is behind all this.',
  },
  camp: {
    know: (s) => [
      'Transmitter log: “Crew has left. One observer remains.”',
      'The broadcast mentioned a camp.',
      ...when(f(s, 'campRadio'), 'A radio in the camp turned on by itself: “...movement at LZ-2...”'),
      ...when(f(s, 'tentSeen'), 'The tent was torn from the inside. One boot was left in it.'),
      ...when(has(s, 'photo'), 'A photo: someone in a raincoat by the mast, signed “N.”'),
      ...when(has(s, 'campMap'), 'An old map marks the crash site: LZ-2.'),
    ],
    question: 'Who lived here, and what were they studying?',
    objective: () => 'Search the camp: the tent, the hut and the table.',
    why: 'The camp may explain who knew about the flight, and why.',
  },
  locker: {
    know: (s) => [
      'The camp was abandoned in a hurry.',
      'By the hut there is a metal locker with a keypad. On the lid: “ACCESS: APPROVAL / ARRIVAL”.',
      ...when(has(s, 'calendar'), 'On the calendar in the hut, September 14 and 23 are circled.'),
      ...when(has(s, 'document'), 'The document from the beach, dated September 14, approved the route change.'),
    ],
    question: 'What is the code, and what did they lock inside?',
    objective: () => 'Find the code for the locker by the hut.',
    why: 'Whatever is locked here must be worth hiding.',
  },
  docs: {
    know: () => ['The locker is open. There are documents inside.'],
    question: 'What did they keep in the locker?',
    objective: () => 'Take the documents from the locker.',
    why: 'Internal documents could explain what they did at the camp.',
  },
  evidence: {
    know: (s) => [
      'The protocol: the island is used for an experiment, and the passengers are “subjects” who arrive by “unplanned descent”.',
      'The shift schedule: an observer on the east ridge. “23/9 · 02:41 — contact.”',
      ...when(f(s, 'postSpotted'), 'Through the binoculars I saw a lens glint on the ridge.'),
      ...when(f(s, 'printsRidge'), 'Fresh tracks lead east from the camp.'),
    ],
    question: 'Who watched the crash, and from where?',
    objective: () => 'Find the lookout post on the east ridge.',
    why: 'The observer saw the crash. They may still be on the island.',
  },
  return: {
    know: () => [
      'The route chart: they knew the flight path before takeoff.',
      'Someone stood on the ridge, and ran when I came close.',
      'The radio in the transmitter woke up. Someone is broadcasting.',
    ],
    question: 'Who is broadcasting now, and what do they want?',
    objective: () => 'Go back to the transmitter and listen to the broadcast.',
    why: 'This is the first time someone is speaking to me directly.',
  },
  // ------------------------------------------------------------------ Part 3
  north: {
    know: () => [
      '“We know you survived. Do not trust anyone coming to the island.”',
      'The red signal moved north-east, and lights came on deep in the forest.',
      'The figure from the ridge got away.',
    ],
    question: 'Who switched the lights on, and where is the signal now?',
    objective: () => 'Follow the northbound signal out of the forest.',
    why: 'Someone is still here. The signal is the only lead to them.',
  },
  search: {
    know: (s) => [
      'The trail climbs a narrow valley toward a mountain. The red light blinks on top of the cliff.',
      ...when(s.flags.cableSeen, 'A thick black cable runs along the trail, northward.'),
      ...when(s.collected.includes('fieldRecorder'), 'A field recorder: “The north door still takes the old badges.”'),
      ...when(s.flags.cameraSeen, 'A NIGHTJAR camera on a pole, pointed at the trail.'),
      ...when(s.collected.includes('mapFragment'), 'The missing piece of my booklet map marks “N-1” in the cliff.'),
    ],
    question: 'Where does the trail, and the cable, lead?',
    objective: () => 'Search the northern ridge. Follow the trail, the cable and the prints.',
    why: 'Whoever left the prints walked here tonight.',
  },
  restore: {
    know: (s) => {
      const f = s.flags;
      return [
        'A steel door is set into the cliff, marked NIGHTJAR N-1. Its access panel is dead.',
        'The panel label: “FEED: GEN-2”.',
        ...when(f.genSeen, 'The generator shed: GEN-2 has an empty main fuse holder.'),
        ...when(f.junctionSeen, 'A junction box between the shed and the door has four loose wires.'),
        ...when(s.collected.includes('fuse') || f.fuseInstalled, 'I found a spare main fuse in a NIGHTJAR crate.'),
        ...when(f.fuseInstalled, 'The fuse is in place.'),
        ...when(f.junctionWired, 'The junction box is wired.'),
      ];
    },
    question: 'How do I get power back to the door?',
    objective: (s) => {
      const f = s.flags;
      if (!f.fuseInstalled) return s.collected.includes('fuse') ? 'Put the main fuse into the generator.' : 'Find a main fuse for the generator.';
      if (!f.junctionWired) return 'Reconnect the wires in the junction box.';
      return 'Start the generator.';
    },
    why: 'Without power the door will not open.',
  },
  door: {
    know: (s) => [
      'The access panel is on: “SWIPE BADGE · LEVEL 2”.',
      ...when(s.collected.includes('badge'), 'I have a NIGHTJAR Level 2 badge from the trail.'),
    ],
    question: 'Will the door still open after all this time?',
    objective: (s) => (s.collected.includes('badge') ? 'Swipe the badge at the access panel.' : 'Find a NIGHTJAR access badge.'),
    why: 'Whatever NIGHTJAR hid in this mountain is behind that door.',
  },
  enter: {
    know: () => ['The door is open. A corridor goes down into the mountain.', 'Dim emergency lights. Cold air.'],
    question: 'What is inside N-1?',
    objective: () => 'Go inside.',
    why: 'This is where the signal led me.',
  },
  observe: {
    know: (s) => [
      'N-1 is an observation facility, abandoned in a hurry.',
      ...when(s.collected.includes('memo'), 'The memo: “anomalous conditions” block communications and tracking.'),
      ...when(!!s.flags.monitorsSeen, 'The monitor wall still shows the island: the beach, the camp, the trail.'),
      ...when(s.collected.includes('fieldNote'), 'N.\'s note: “Do not trust a transmission simply because it uses a familiar voice.”'),
      ...when(s.collected.includes('passengerReport'), 'The passengers were classified before departure. Seat 31A is restricted.'),
    ],
    question: 'What did they watch from here, and who were they watching?',
    objective: () => 'Search the checkpoint and the observation room.',
    why: 'The records here may explain why the flight was sent to the island.',
  },
  archive: {
    know: (s) => [
      'Passenger report: “Seat 31A: classification restricted. See restricted archive.”',
      'Passenger report: “Observation window opened: 02:40.”',
      ...when(s.collected.includes('discrepancies'), 'People listed as “transferred” are missing, with arrival dates that make no sense.'),
      ...when(!!s.flags.archiveTried, 'The archive terminal wants a WINDOW CODE: DDHHMM.'),
    ],
    question: 'What is in the restricted record of seat 31A?',
    objective: (s) => (s.collected.includes('discrepancies') ? 'Unlock the archive terminal.' : 'Search the records archive.'),
    why: '31A is the empty seat next to mine. Someone booked it and never boarded.',
  },
  file31a: {
    know: () => ['The archive terminal accepted the code and released a restricted cabinet.'],
    question: 'What does the file say about 31A?',
    objective: () => 'Take the file from the restricted cabinet.',
    why: 'The answer about the empty seat should be inside.',
  },
  recording: {
    know: (s) => [
      'File 31A: classification OBSERVER. Status: unresolved.',
      '“Additional records have been transferred to the restricted archive.”',
      ...when(!!s.flags.recordingPart1, 'The recording cut off. The deck reports data on a SECONDARY INPUT.'),
    ],
    question: 'What is on the restricted recording?',
    objective: (s) => (s.flags.recordingPart1 ? 'Recover the rest of the recording.' : 'Find the playback deck in the control room and play the recording.'),
    why: 'It may be the only record of what OBSERVER means.',
  },
  blackout: {
    know: () => [
      'The recording: “If the subject reaches the facility, do not initiate direct contact.”',
      'The rest: “The subject\'s arrival at N-1 is anticipated.”',
      'Then the power failed. Only emergency lights are on.',
    ],
    question: 'Why did one screen turn on by itself?',
    objective: () => 'Check the backup monitor that came on.',
    why: 'Something in this facility is still running.',
  },
  final: {
    know: () => [
      'The backup monitor shows the observation room live. It shows me.',
      'Someone, somewhere, is watching this room right now.',
    ],
    question: 'Who is watching, and what did they record?',
    objective: () => 'Activate the final monitor.',
    why: 'A new recording was detected, and it is meant for me.',
  },
  part4: {
    know: () => [
      '“If you can hear this, they\'ve already found you.”',
      'Something is behind the sealed door to the lower level.',
      'NIGHTJAR PROTOCOL — PHASE 3 ACTIVATED.',
    ],
    question: 'Who is OBSERVER, and what is Phase 3?',
    objective: () => 'Part 4, coming soon.',
    why: 'Someone has been watching.',
  },
};

// what a newly found clue adds, in one line (no spoilers beyond the clue itself)
export const CLUE_LEARNED = {
  booklet: 'The booklet carries a message: “the plan went wrong”. Someone planned something.',
  ticket: 'The seat next to mine was booked, and the passenger never boarded.',
  device: 'The device points to TAIL, the plane\'s tail.',
  document: 'Someone knew about my flight nine days in advance.',
  carvings: 'Symbols carved along the tracks, with notches under them.',
  serviceCard: 'A service card with three rules for wiring the transmitter.',
  radioLog: 'The crew left the island, and one observer stayed.',
  photo: 'Someone stood by this transmitter, back in the first week.',
  campMap: 'The crash site was marked on a map before it happened.',
  calendar: 'Two days are marked: 14, APPROVED, and 23, ARRIVAL.',
  researchDoc: 'The island is used for an experiment, and the passengers are “subjects”.',
  schedule: 'Someone watched from the east ridge at the moment of the crash.',
  routeChart: 'They knew the flight path before takeoff.',
  stillHere: 'Someone is still here.',
  fieldRecorder: 'The door takes old badges, and the generator needs a fuse.',
  mapFragment: 'The torn-off part of the booklet map leads to “N-1”.',
  memo: 'The island interferes with communications and tracking. Nobody outside can find it.',
  passengerReport: 'The passengers were classified before the flight. Seat 31A is restricted.',
  fieldNote: 'N. warns: a familiar voice is not proof of anything.',
  discrepancies: 'People are missing, and their dates do not add up.',
  file31a: 'Seat 31A was classified as OBSERVER.',
  recording: 'NIGHTJAR expected me to reach this facility.',
  phase3: 'Someone has been watching.',
};
