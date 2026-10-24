// Gameplay clarity: the main goal, and for each mission what the player knows, what is still unknown,
// the next action, and why it matters. Everything is derived from saved state, so nothing appears
// before the player has actually discovered it.
import { T } from '../i18n/index.js';

const has = (s, id) => s.collected.includes(id);
const f = (s, k) => !!s.flags[k];
const when = (cond, text) => (cond ? [text] : []);

// one short sentence for the whole current chapter of the story
export function mainGoal(s) {
  if (s.questIndex >= 26) return T('Someone has been watching, and NIGHTJAR Phase 3 has begun. The story continues in Part 4.');
  if (s.questIndex >= 19) return T('Find out what NIGHTJAR watched from inside the mountain, and what “OBSERVER” means.');
  if (s.questIndex >= 15) return T('The signal moved north. Someone is still here. Follow it and find out who.');
  if (s.questIndex >= 7) return T('The red signal may lead to someone who knows what happened. Find its source.');
  if (s.questIndex >= 6 || f(s, 'revealSeen')) return T('Someone knew about the crash before it happened. Find out who knew, and why.');
  return T('You survived the crash. Find supplies and figure out where you are.');
}

export const QUEST_INFO = {
  // ------------------------------------------------------------------ Part 1
  wake: {
    know: () => [T('The plane crashed near an island I don\'t know.'), T('I woke up on the beach. I can\'t see anyone.')],
    question: T('What is left of the plane, and where is everyone else?'),
    objective: () => T('Go to the plane wreckage and search it.'),
    why: T('There may be supplies in the wreckage, and maybe answers too.'),
  },
  gear: {
    know: (s) => [
      T('The fuselage is empty. No sign of the other passengers.'),
      ...when(has(s, 'water'), T('I have a bottle of water.')),
      ...when(has(s, 'flashlight'), T('I found a working flashlight.')),
      ...when(has(s, 'bandage'), T('I bandaged the cut on my arm.')),
    ],
    question: T('How will I survive here until someone comes?'),
    objective: () => T('Collect water, a flashlight and a bandage from the wreckage.'),
    why: T('Without water and light I won\'t last, and the flashlight lets me go into dark places.'),
  },
  suitcase: {
    know: () => [T('I have water, a flashlight and a bandage.'), T('I saw something black stuck between the rocks, on the west side of the beach.')],
    question: T('Why is a black suitcase in the rocks, far from all the wreckage?'),
    objective: () => T('Find the black suitcase in the rocks and open it.'),
    why: T('It doesn\'t look like an ordinary passenger\'s suitcase.'),
  },
  booklet: {
    know: (s) => [
      T('The black suitcase doesn\'t belong to any passenger.'),
      T('Inside there was only one booklet, wrapped in plastic.'),
      ...when(has(s, 'booklet'), T('The cover has a symbol I have never seen.')),
    ],
    question: T('What does the booklet say?'),
    objective: (s) => (has(s, 'booklet') ? T('Open the booklet (J) and read the first page.') : T('Take the booklet from the suitcase.')),
    why: T('Whoever left it here knew something about this flight.'),
  },
  clues: {
    know: (s) => [
      T('The booklet says: “If you are reading this, the plan went wrong.”'),
      T('The partial map in the booklet has two X marks.'),
      ...when(has(s, 'ticket'), T('A boarding pass for seat 31A, the empty seat next to mine.')),
      ...when(has(s, 'device'), T('A memory device with the same symbol and a CACHE / TAIL label.')),
    ],
    question: T('What “plan” went wrong, and what is marked on the map?'),
    objective: () => T('Check both places marked with an X on the booklet\'s map.'),
    why: T('The marks were drawn before we crashed. Someone planned something here.'),
  },
  reveal: {
    know: () => [
      T('Someone booked seat 31A and never boarded.'),
      T('The device says CACHE / TAIL.'),
      T('The plane\'s tail fell near the edge of the forest.'),
    ],
    question: T('What was hidden by the tail?'),
    objective: () => T('Search near the tail for what the CACHE / TAIL label points to.'),
    why: T('It may explain how someone knew about the flight in advance.'),
  },
  // ------------------------------------------------------------------ Part 2
  enter: {
    know: () => [
      T('The crash was no accident: a document from September 14 mentioned my flight.'),
      T('A red light is blinking above the forest, to the north.'),
    ],
    question: T('Who is transmitting from the forest, and why?'),
    objective: () => T('Enter the forest on the trail behind the tail.'),
    why: T('The signal may lead to whoever knew about the crash.'),
  },
  follow: {
    know: (s) => [
      T('The red light blinks above the treetops.'),
      T('The trail winds deep into the forest.'),
      ...when(f(s, 'figure1'), T('I saw someone, or something, moving between the trees.')),
    ],
    question: T('Where exactly is the signal coming from?'),
    objective: () => T('Follow the red light through the trees to its source.'),
    why: T('The signal may be the only way to reach someone on the island.'),
  },
  power: {
    know: (s) => {
      const carvings = ['carveA', 'carveB', 'carveC'].filter((k) => f(s, k)).length;
      return [
        T('The signal comes from a transmitter in a clearing, and it is dead.'),
        T('Someone pulled out its power cell.'),
        ...when(f(s, 'printsPower'), T('Boot prints lead west from the transmitter.')),
        ...when(f(s, 'crateSeen'), T('A supply crate is locked with a three-symbol lock.')),
        ...when(carvings > 0, T`I found ${carvings} of 3 symbols carved into trees, with notches under them.`),
      ];
    },
    question: T('Who took the power cell, and where?'),
    objective: (s) => (f(s, 'crateOpen') ? T('Take the power cell from the crate.')
      : f(s, 'crateSeen') ? T('Open the symbol lock on the supply crate.')
        : T('Find the power cell taken from the transmitter.')),
    why: T('Without power the transmitter is silent, and I won\'t learn what it says.'),
  },
  activate: {
    know: (s) => [
      T('I have the power cell.'),
      ...when(has(s, 'serviceCard'), T('The service card from the crate explains how to connect the wires (in the booklet).')),
      ...when(f(s, 'cellInserted'), T('The cell is in, but four wires are disconnected.')),
      ...when(f(s, 'wired'), T('The screen lit up, only static. The transmitter is searching for a station.')),
    ],
    question: T('What did this transmitter send, and to whom?'),
    objective: (s) => (f(s, 'wired') ? T('Tune the frequency until the signal comes in.')
      : f(s, 'cellInserted') ? T('Connect the wires on the panel following the service card.')
        : T('Put the power cell into the transmitter.')),
    why: T('The broadcast is the first link to whoever is behind all this.'),
  },
  camp: {
    know: (s) => [
      T('Transmitter log: “Crew has left. One observer remains.”'),
      T('The broadcast mentioned a camp.'),
      ...when(f(s, 'campRadio'), T('A radio in the camp turned on by itself: “...movement at LZ-2...”')),
      ...when(f(s, 'tentSeen'), T('The tent was torn from the inside. One boot was left in it.')),
      ...when(has(s, 'photo'), T('A photo: someone in a raincoat by the mast, signed “N.”')),
      ...when(has(s, 'campMap'), T('An old map marks the crash site: LZ-2.')),
    ],
    question: T('Who lived here, and what were they studying?'),
    objective: () => T('Search the camp: the tent, the hut and the table.'),
    why: T('The camp may explain who knew about the flight, and why.'),
  },
  locker: {
    know: (s) => [
      T('The camp was abandoned in a hurry.'),
      T('By the hut there is a metal locker with a keypad. On the lid: “ACCESS: APPROVAL / ARRIVAL”.'),
      ...when(has(s, 'calendar'), T('On the calendar in the hut, September 14 and 23 are circled.')),
      ...when(has(s, 'document'), T('The document from the beach, dated September 14, approved the route change.')),
    ],
    question: T('What is the code, and what did they lock inside?'),
    objective: () => T('Find the code for the locker by the hut.'),
    why: T('Whatever is locked here must be worth hiding.'),
  },
  docs: {
    know: () => [T('The locker is open. There are documents inside.')],
    question: T('What did they keep in the locker?'),
    objective: () => T('Take the documents from the locker.'),
    why: T('Internal documents could explain what they did at the camp.'),
  },
  evidence: {
    know: (s) => [
      T('The protocol: the island is used for an experiment, and the passengers are “subjects” who arrive by “unplanned descent”.'),
      T('The shift schedule: an observer on the east ridge. “23/9 · 02:41 — contact.”'),
      ...when(f(s, 'postSpotted'), T('Through the binoculars I saw a lens glint on the ridge.')),
      ...when(f(s, 'printsRidge'), T('Fresh tracks lead east from the camp.')),
    ],
    question: T('Who watched the crash, and from where?'),
    objective: () => T('Find the lookout post on the east ridge.'),
    why: T('The observer saw the crash. They may still be on the island.'),
  },
  return: {
    know: () => [
      T('The route chart: they knew the flight path before takeoff.'),
      T('Someone stood on the ridge, and ran when I came close.'),
      T('The radio in the transmitter woke up. Someone is broadcasting.'),
    ],
    question: T('Who is broadcasting now, and what do they want?'),
    objective: () => T('Go back to the transmitter and listen to the broadcast.'),
    why: T('This is the first time someone is speaking to me directly.'),
  },
  // ------------------------------------------------------------------ Part 3
  north: {
    know: () => [
      T('“We know you survived. Do not trust anyone coming to the island.”'),
      T('The red signal moved north-east, and lights came on deep in the forest.'),
      T('The figure from the ridge got away.'),
    ],
    question: T('Who switched the lights on, and where is the signal now?'),
    objective: () => T('Follow the northbound signal out of the forest.'),
    why: T('Someone is still here. The signal is the only lead to them.'),
  },
  search: {
    know: (s) => [
      T('The trail climbs a narrow valley toward a mountain. The red light blinks on top of the cliff.'),
      ...when(s.flags.cableSeen, T('A thick black cable runs along the trail, northward.')),
      ...when(s.collected.includes('fieldRecorder'), T('A field recorder: “The north door still takes the old badges.”')),
      ...when(s.flags.cameraSeen, T('A NIGHTJAR camera on a pole, pointed at the trail.')),
      ...when(s.collected.includes('mapFragment'), T('The missing piece of my booklet map marks “N-1” in the cliff.')),
    ],
    question: T('Where does the trail, and the cable, lead?'),
    objective: () => T('Search the northern ridge. Follow the trail, the cable and the prints.'),
    why: T('Whoever left the prints walked here tonight.'),
  },
  restore: {
    know: (s) => {
      const f = s.flags;
      return [
        T('A steel door is set into the cliff, marked NIGHTJAR N-1. Its access panel is dead.'),
        T('The panel label: “FEED: GEN-2”.'),
        ...when(f.genSeen, T('The generator shed: GEN-2 has an empty main fuse holder.')),
        ...when(f.junctionSeen, T('A junction box between the shed and the door has four loose wires.')),
        ...when(s.collected.includes('fuse') || f.fuseInstalled, T('I found a spare main fuse in a NIGHTJAR crate.')),
        ...when(f.fuseInstalled, T('The fuse is in place.')),
        ...when(f.junctionWired, T('The junction box is wired.')),
      ];
    },
    question: T('How do I get power back to the door?'),
    objective: (s) => {
      const f = s.flags;
      if (!f.fuseInstalled) return s.collected.includes('fuse') ? T('Put the main fuse into the generator.') : T('Find a main fuse for the generator.');
      if (!f.junctionWired) return T('Reconnect the wires in the junction box.');
      return T('Start the generator.');
    },
    why: T('Without power the door will not open.'),
  },
  door: {
    know: (s) => [
      T('The access panel is on: “SWIPE BADGE · LEVEL 2”.'),
      ...when(s.collected.includes('badge'), T('I have a NIGHTJAR Level 2 badge from the trail.')),
    ],
    question: T('Will the door still open after all this time?'),
    objective: (s) => (s.collected.includes('badge') ? T('Swipe the badge at the access panel.') : T('Find a NIGHTJAR access badge.')),
    why: T('Whatever NIGHTJAR hid in this mountain is behind that door.'),
  },
  enter: {
    know: () => [T('The door is open. A corridor goes down into the mountain.'), T('Dim emergency lights. Cold air.')],
    question: T('What is inside N-1?'),
    objective: () => T('Go inside.'),
    why: T('This is where the signal led me.'),
  },
  observe: {
    know: (s) => [
      T('N-1 is an observation facility, abandoned in a hurry.'),
      ...when(s.collected.includes('memo'), T('The memo: “anomalous conditions” block communications and tracking.')),
      ...when(!!s.flags.monitorsSeen, T('The monitor wall still shows the island: the beach, the camp, the trail.')),
      ...when(s.collected.includes('fieldNote'), T('N.\'s note: “Do not trust a transmission simply because it uses a familiar voice.”')),
      ...when(s.collected.includes('passengerReport'), T('The passengers were classified before departure. Seat 31A is restricted.')),
    ],
    question: T('What did they watch from here, and who were they watching?'),
    objective: () => T('Search the checkpoint and the observation room.'),
    why: T('The records here may explain why the flight was sent to the island.'),
  },
  archive: {
    know: (s) => [
      T('Passenger report: “Seat 31A: classification restricted. See restricted archive.”'),
      T('Passenger report: “Observation window opened: 02:40.”'),
      ...when(s.collected.includes('discrepancies'), T('People listed as “transferred” are missing, with arrival dates that make no sense.')),
      ...when(!!s.flags.archiveTried, T('The archive terminal wants a WINDOW CODE: DDHHMM.')),
    ],
    question: T('What is in the restricted record of seat 31A?'),
    objective: (s) => (s.collected.includes('discrepancies') ? T('Unlock the archive terminal.') : T('Search the records archive.')),
    why: T('31A is the empty seat next to mine. Someone booked it and never boarded.'),
  },
  file31a: {
    know: () => [T('The archive terminal accepted the code and released a restricted cabinet.')],
    question: T('What does the file say about 31A?'),
    objective: () => T('Take the file from the restricted cabinet.'),
    why: T('The answer about the empty seat should be inside.'),
  },
  recording: {
    know: (s) => [
      T('File 31A: classification OBSERVER. Status: unresolved.'),
      T('“Additional records have been transferred to the restricted archive.”'),
      ...when(!!s.flags.recordingPart1, T('The recording cut off. The deck reports data on a SECONDARY INPUT.')),
    ],
    question: T('What is on the restricted recording?'),
    objective: (s) => (s.flags.recordingPart1 ? T('Recover the rest of the recording.') : T('Find the playback deck in the control room and play the recording.')),
    why: T('It may be the only record of what OBSERVER means.'),
  },
  blackout: {
    know: () => [
      T('The recording: “If the subject reaches the facility, do not initiate direct contact.”'),
      T('The rest: “The subject\'s arrival at N-1 is anticipated.”'),
      T('Then the power failed. Only emergency lights are on.'),
    ],
    question: T('Why did one screen turn on by itself?'),
    objective: () => T('Check the backup monitor that came on.'),
    why: T('Something in this facility is still running.'),
  },
  final: {
    know: () => [
      T('The backup monitor shows the observation room live. It shows me.'),
      T('Someone, somewhere, is watching this room right now.'),
    ],
    question: T('Who is watching, and what did they record?'),
    objective: () => T('Activate the final monitor.'),
    why: T('A new recording was detected, and it is meant for me.'),
  },
  part4: {
    know: () => [
      T('“If you can hear this, they\'ve already found you.”'),
      T('Something is behind the sealed door to the lower level.'),
      'NIGHTJAR PROTOCOL — PHASE 3 ACTIVATED.',
    ],
    question: T('Who is OBSERVER, and what is Phase 3?'),
    objective: () => T('Part 4, coming soon.'),
    why: 'Someone has been watching.',
  },
};

// what a newly found clue adds, in one line (no spoilers beyond the clue itself)
export const CLUE_LEARNED = {
  booklet: T('The booklet carries a message: “the plan went wrong”. Someone planned something.'),
  ticket: T('The seat next to mine was booked, and the passenger never boarded.'),
  device: T('The device points to TAIL, the plane\'s tail.'),
  document: T('Someone knew about my flight nine days in advance.'),
  carvings: T('Symbols carved along the tracks, with notches under them.'),
  serviceCard: T('A service card with three rules for wiring the transmitter.'),
  radioLog: T('The crew left the island, and one observer stayed.'),
  photo: T('Someone stood by this transmitter, back in the first week.'),
  campMap: T('The crash site was marked on a map before it happened.'),
  calendar: T('Two days are marked: 14, APPROVED, and 23, ARRIVAL.'),
  researchDoc: T('The island is used for an experiment, and the passengers are “subjects”.'),
  schedule: T('Someone watched from the east ridge at the moment of the crash.'),
  routeChart: T('They knew the flight path before takeoff.'),
  stillHere: 'Someone is still here.',
  fieldRecorder: T('The door takes old badges, and the generator needs a fuse.'),
  mapFragment: T('The torn-off part of the booklet map leads to “N-1”.'),
  memo: T('The island interferes with communications and tracking. Nobody outside can find it.'),
  passengerReport: T('The passengers were classified before the flight. Seat 31A is restricted.'),
  fieldNote: T('N. warns: a familiar voice is not proof of anything.'),
  discrepancies: T('People are missing, and their dates do not add up.'),
  file31a: T('Seat 31A was classified as OBSERVER.'),
  recording: T('NIGHTJAR expected me to reach this facility.'),
  phase3: 'Someone has been watching.',
};
