// Minimap description of the beach: ground colours from the same shore/trail functions the terrain uses,
// and the story places, each shown once the player knows about it.
import { inlandDist, distToPaths, PATHS } from './terrain.js';
import { LAYOUT } from './layout.js';
import { T } from '../../i18n/index.js';

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const SEA = [38, 104, 128], DEEP = [20, 56, 82], SAND = [214, 196, 146], GRASS = [116, 136, 70], JUNGLE = [52, 86, 46], ROCK = [124, 122, 112];

export const MINIMAP = {
  title: T('THE BEACH'),
  margin: 34,
  ground(x, z, h, slope) {
    const d = inlandDist(x, z);
    if (h < 0) return mix(SEA, DEEP, clamp01(-d / 16));
    let c = mix(SAND, GRASS, clamp01((d - 15) / 13));
    c = mix(c, JUNGLE, clamp01((d - 38) / 24));
    return mix(c, ROCK, clamp01((slope - 0.45) / 0.5));
  },
  paths: PATHS,
  landmarks: [
    { x: LAYOUT.fuselage.x, z: LAYOUT.fuselage.z, label: 'WRECK' },
    { x: LAYOUT.base.x, z: LAYOUT.base.z, label: 'CAMP', kind: 'camp', found: (s) => !!(s.base && s.base.found) },
    { x: LAYOUT.crevice.x, z: LAYOUT.crevice.z, label: 'ROCKS', found: (s) => s.questIndex >= 2 },
    { x: LAYOUT.tail.x, z: LAYOUT.tail.z, label: 'TAIL', found: (s) => s.questIndex >= 5 },
    { x: 1, z: -97, label: 'TRAIL', found: (s) => s.questIndex >= 6 },
    // far away, seen above the trees
    { x: LAYOUT.signal.x, z: LAYOUT.signal.z, label: 'SIGNAL', kind: 'danger', found: (s) => s.questIndex >= 6 },
    { x: -40, z: -300, label: 'MOUNTAIN', kind: 'far' },
  ],
};
