// Fixed positions for story-relevant places. All coordinates are world XZ.
export const LAYOUT = {
  spawn: { x: -6, z: 19, yaw: Math.PI * 0.86 },
  fuselage: { x: 10, z: 5, rot: 0.45 },
  wing: { x: -14, z: 1, rot: -0.3 },
  engine: { x: 24, z: 14 },
  seatsCluster: { x: 18, z: 9 },
  tail: { x: 37, z: -20, rot: 1.05 },
  container: { x: 30.5, z: -14.5, rot: 0.3 },
  crevice: { x: -31, z: -13 },
  blackSuitcase: { x: -30.2, z: -12.2 },
  signal: { x: 8, z: -178 },
  base: { x: -25, z: 12, rot: 0.2 },
  lobby: { x: 6, z: 29, yaw: 0.15 }, // main menu: where the chosen survivor stands // player base camp (open side faces the sea)
};

// Interactive items (positions tuned so every one is reachable on foot)
export const ITEM_SPOTS = {
  water: { x: 4.2, z: 10.6 },
  flashlight: { x: -10.6, z: 5.2 },
  bandage: { x: 19.6, z: 6.4 },
  booklet: { x: -30.2, z: -12.2 },
  ticket: { x: -40, z: 9.5 },
  device: { x: -9.2, z: -26 },
  document: { x: 30.2, z: -12.3 },
};
