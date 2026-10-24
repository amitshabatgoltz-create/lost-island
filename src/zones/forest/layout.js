// Fixed positions in the forest zone (its own coordinate space; the beach trail enters at the south edge, +Z).
export const FL = {
  entry: { x: 0, z: 97 },
  transmitter: { x: -42, z: -14, rot: 0.5 },   // equipment cabinet
  mast: { x: -45.5, z: -17.5 },
  powerSite: { x: -74, z: -47 },               // fallen supply drop
  powerCell: { x: -73.3, z: -46.0 },             // in front of the (locked) supply crate
  campScope: { x: 34.5, z: -54.5, yaw: -1.2 },     // spotting scope at the camp's eastern edge
  camp: { x: 19, z: -62 },
  tent: { x: 10, z: -70, rot: 0.35 },
  cabin: { x: 28, z: -71, rot: -0.25 },        // 5m x 4m, door faces the camp
  table: { x: 16, z: -56, rot: 0.2 },
  crates: { x: 6, z: -57 },
  generator: { x: 33, z: -62 },
  dish: { x: 3, z: -64 },
  locker: { x: 22.6, z: -65.6, rot: -0.25 },
  post: { x: 74, z: -38 },
  routeChart: { x: 72.6, z: -36.9 },
  scope: { x: 75.5, z: -41.2 },
  bridge: { x: -6, z: 42.4 },
  lookout: { x: 8, z: -40, rot: 0.5 },          // climbable rock between the relay and the camp
  newSignal: { x: 64, z: -150, y: 30 },
  farLights: [[-58, -112], [-40, -122], [-20, -128], [2, -134], [22, -138], [40, -142], [56, -146]],
};

// walking trails (dirt)
export const FPATHS = [
  [[0, 108], [2, 88], [-4, 68], [-6, 52], [-6, 34], [-16, 20], [-30, 4], [-40, -10]],
  [[-42, -16], [-36, -30], [-20, -44], [0, -55], [16, -60]],
  // Part 3: from the camp, north-east out of the forest toward the mountain
  [[22, -76], [27, -84], [33, -91], [40, -98], [44, -108]],
];

// the way north (Part 3): walking off the north edge here leads to the ridge
export const NORTH_EXIT = { x: 40, z: -95.5, hw: 9 };

// footprint trails (no path, just prints)
export const PRINTS = {
  toPower: [[-44, -20], [-52, -27], [-58, -34], [-64, -40], [-70, -44]],
  toRidge: [[30, -60], [38, -62], [46, -63], [54, -60], [62, -54], [68, -47], [72, -41]],
  // fresh prints that circle the camp and walk off the cliff edge toward the dark forest
  stray: [[60, -30], [57, -24], [53, -18], [50, -12]],
};

export const CLEARINGS = [
  { x: 0, z: 96, r: 9 },
  { x: -43, z: -15, r: 13 },
  { x: -73, z: -46, r: 7 },
  { x: 19, z: -63, r: 19 },
  { x: 74, z: -38, r: 8 },
  { x: 8, z: -40, r: 8 }, // lookout rock
];

// fallen trunks: [x, z, length, rotation, radius]; each can be climbed over in the middle
export const FLOGS = [[8, 62, 7, 0.4, 0.45], [-24, 32, 6, 1.2, 0.4], [-54, -6, 8, -0.3, 0.5], [30, -28, 6, 0.9, 0.42], [-30, -52, 7, 2.1, 0.5], [48, 20, 9, 0.2, 0.55], [-70, 60, 6, 1.6, 0.4], [10, -86, 7, 0.1, 0.45]];

export const BOUNDS = { minX: -96, maxX: 96, minZ: -96, maxZ: 104 };
