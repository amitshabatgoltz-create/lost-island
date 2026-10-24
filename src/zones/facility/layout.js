// The NIGHTJAR observation facility N-1 (Part 3), inside the mountain behind the bunker door.
// Own coordinate space: floor at y = 0, the entrance corridor runs north (-Z) from the door at z = 16.
export const H = 3.0; // ceiling height

// rooms: axis-aligned rectangles [minX, maxX, minZ, maxZ]
export const ROOMS = {
  corridor: { name: 'Entrance corridor', r: [-1.5, 1.5, 0, 16] },
  checkpoint: { name: 'Security checkpoint', r: [-6, 6, -6, 0] },
  observation: { name: 'Observation room', r: [-8, 8, -20, -6] },
  archive: { name: 'Records archive', r: [6, 16, -5, 4] },
  control: { name: 'Restricted control', r: [-18, -8, -20, -10] },
};

// doors between rooms: wall axis, position along the wall, half width, and what opens them
export const DOORS = {
  entrance: { axis: 'z', at: 16, c: 0, hw: 1.2, label: 'N-1 · MAIN ENTRANCE', open: () => true },
  observation: { axis: 'z', at: -6, c: 0, hw: 1.0, label: 'OBSERVATION · LEVEL 2', badge: true },
  archive: { axis: 'x', at: 6, c: -2.5, hw: 1.0, label: 'RECORDS · LEVEL 2', badge: true },
  control: { axis: 'x', at: -8, c: -14, hw: 1.0, label: 'CONTROL · LEVEL 4', flag: 'controlReleased' },
  sealed: { axis: 'x', at: -6, c: -3, hw: 1.0, label: 'B-2 · LOWER LEVEL · SEALED', sealed: true },
};

export const FX = {
  spawn: { x: 0, z: 14.2 },
  // checkpoint
  desk: { x: 3.4, z: -2.6 },
  secTerminal: { x: 3.4, z: -3.3 },
  memo: { x: 2.6, z: -2.4 },
  lockers: { x: -3.6, z: -0.45 },
  openLocker: { x: -2.4, z: -0.45 },
  secCam: { x: 5.6, y: 2.7, z: -5.6 },
  // observation room
  monitorWall: { z: -19.4 },
  finalMonitor: { x: 0, z: -18.6 },
  centralDesk: { x: 0, z: -13 },
  report: { x: -0.7, z: -12.8 },
  reel: { x: 4.6, z: -8.2 },
  islandMap: { x: -7.85, z: -10 },
  corkboard: { x: 7.85, z: -10 },
  backup: { x: 6.8, z: -15 },
  obsCam: { x: -7.6, y: 2.75, z: -6.5 },
  // archive
  archTerminal: { x: 10.5, z: 3.3 },
  drawer: { x: 12.2, z: -4.3 },
  cabinet: { x: 15.4, z: -0.5 },
  // control area
  powerPanel: { x: -14.5, z: -19.6 },
  lockedTerminal: { x: -10.5, z: -19.2 },
  deck: { x: -17.4, z: -15 },
};

export const FBOUNDS = { minX: -17.6, maxX: 15.6, minZ: -19.6, maxZ: 15.8 };
