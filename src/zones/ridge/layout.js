// Fixed positions on the northern ridge (Part 3). Own coordinate space: the trail from the forest
// enters at the south edge (+Z) and climbs north to the bunker door in the cliff.
export const RL = {
  entry: { x: 0, z: 60 },
  // the tarp camp where someone waited for the door
  tarp: { x: -15, z: 33, rot: 0.4 },
  recorder: { x: -13.4, z: 31.2 },
  radio: { x: -16.6, z: 31.6 },
  sign: { x: -5.2, z: 17.5, rot: 0.15 },
  camera: { x: 7.6, z: 5.4 },          // pole with a broken camera facing the trail
  badge: { x: 6.2, z: 3.4 },           // dropped in the mud under it
  crate: { x: -19, z: -12, rot: -0.5 }, // split NIGHTJAR crate on the west slope: the fuse
  fragment: { x: 4.2, z: -24.5 },      // half-buried paper: the missing piece of the booklet map
  disturbed: { x: -1.5, z: -33 },      // freshly dug ground over the cable
  bunker: { x: 0, z: -46, w: 9, d: 6 },  // concrete facade, front face at z = -46, door in its middle
  door: { x: 0, z: -46.1 },
  panel: { x: 2.35, z: -45.7 },        // access panel right of the door
  junction: { x: 8.6, z: -43.6, rot: -0.35 },
  shed: { x: 17, z: -36, rot: -0.6 },  // generator shed
  generator: { x: 17, z: -36 },
  mast: { x: 6, z: -63, y: 30 },       // the relocated red signal, on the cliff top
  lamps: [[-2, 52], [-9, 38], [-4, 22], [5, 6], [6, -10], [0, -26], [-3, -38]],
};

// walking trail (dirt) from the forest to the door
export const RPATH = [[0, 66], [-2, 52], [-9, 38], [-7, 26], [-2, 14], [5, 4], [8, -6], [4, -18], [0, -28], [-1, -38], [0, -44]];
// cable from the forest, along the trail, under the rocks and up to the door
export const RCABLE = [[2.2, 66], [0.4, 52], [-6.6, 38], [-4.8, 26], [0.2, 14], [7.2, 4.6], [10.2, -6], [6.4, -18], [2.4, -28], [1.4, -36]];
// generator feed: shed → junction box → access panel
export const RFEED = [[15.4, -37.5], [12, -41], [8.6, -43.6], [5.2, -45.4], [2.6, -45.6]];
// boot prints: fresh, from the camp to the door
export const RPRINTS = [[-11, 30], [-8, 24], [-3, 15], [3, 5], [7, -4], [5, -16], [1, -27], [-0.5, -36], [0, -43]];

export const RCLEARINGS = [
  { x: 0, z: 60, r: 7 },
  { x: -15, z: 33, r: 7 },
  { x: 6, z: 5, r: 6 },
  { x: -19, z: -12, r: 5 },
  { x: 2, z: -40, r: 11 },
  { x: 17, z: -36, r: 6 },
];

export const RBOUNDS = { minX: -34, maxX: 34, minZ: -47.6, maxZ: 66 };
