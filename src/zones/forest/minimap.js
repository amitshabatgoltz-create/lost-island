// Minimap description of the forest: stream, ridge cliffs, clearings and trails from the zone's own data.
// Places appear only after the story has led the player to them (the forest has no compass on purpose).
import { streamZ } from './terrain.js';
import { FL, FPATHS, CLEARINGS } from './layout.js';

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const FLOOR = [46, 78, 44], CLEAR = [96, 104, 64], WATER = [40, 92, 112], ROCK = [118, 114, 104];
const has = (s, id) => s.collected.includes(id);

export const MINIMAP = {
  margin: 24,
  ground(x, z, h, slope) {
    if (Math.abs(z - streamZ(x)) < 2.6) return WATER;
    let c = FLOOR;
    for (const cl of CLEARINGS) {
      const d = Math.hypot(x - cl.x, z - cl.z);
      if (d < cl.r) c = mix(c, CLEAR, clamp01((cl.r - d) / (cl.r * 0.45)));
    }
    return mix(c, ROCK, clamp01((slope - 0.55) / 0.5));
  },
  paths: FPATHS,
  landmarks: [
    { x: 0, z: 101, label: 'BEACH' },
    { x: FL.transmitter.x, z: FL.transmitter.z, label: 'RELAY', found: (s) => !!s.flags.reachedTransmitter },
    { x: FL.powerSite.x, z: FL.powerSite.z, label: 'SUPPLY', found: (s) => !!s.flags.crateSeen || has(s, 'powerCell') },
    { x: FL.camp.x, z: FL.camp.z, label: 'CAMP', kind: 'camp', found: (s) => !!(s.flags.tentSeen || s.flags.cabinSeen || s.flags.tableSeen) },
    { x: FL.post.x, z: FL.post.z, label: 'POST', found: (s) => !!(s.flags.postSpotted || s.flags.encounterDone) || has(s, 'routeChart') },
  ],
};
