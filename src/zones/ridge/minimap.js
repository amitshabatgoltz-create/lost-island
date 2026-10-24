// Minimap description of the northern ridge: the trail, its clearings and cliff rock from the zone's own data.
import { RL, RPATH, RCLEARINGS } from './layout.js';

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const FLOOR = [52, 76, 46], CLEAR = [98, 100, 70], ROCK = [116, 112, 104];

export const MINIMAP = {
  margin: 18,
  ground(x, z, h, slope) {
    let c = FLOOR;
    for (const cl of RCLEARINGS) {
      const d = Math.hypot(x - cl.x, z - cl.z);
      if (d < cl.r) c = mix(c, CLEAR, clamp01((cl.r - d) / (cl.r * 0.45)));
    }
    return mix(c, ROCK, clamp01((slope - 0.55) / 0.5));
  },
  paths: [RPATH],
  landmarks: [
    { x: RL.entry.x, z: RL.entry.z + 4, label: 'FOREST' },
    { x: RL.camera.x, z: RL.camera.z, label: 'CAMERA', found: (s) => !!s.flags.cameraSeen },
    { x: RL.shed.x, z: RL.shed.z, label: 'SHED', found: (s) => !!(s.flags.genSeen || s.flags.genRunning) },
    { x: RL.door.x, z: RL.door.z + 1, label: 'BUNKER', kind: 'danger', found: (s) => !!(s.flags.entranceFound || s.flags.doorOpen || s.flags.panelSeen) },
  ],
};
