// Northern ridge height field: a narrow valley that climbs north between steep rock walls and ends
// at a cliff, where the bunker facade is set into the mountain.
import { fbm, smoothstep } from '../../noise.js';
import { RPATH, RCLEARINGS } from './layout.js';
import { distToPolyline } from '../forest/terrain.js';

export const distToTrail = (x, z) => distToPolyline(x, z, RPATH);

// valley walls: the floor is ~40 m wide, wandering a little with the trail
function wallRise(x, z) {
  const centre = Math.sin(z * 0.045) * 4;
  const half = 25 + (fbm(z * 0.05 + 4, 1.3, 2) - 0.5) * 8;
  return 16 * smoothstep(half, half + 7, Math.abs(x - centre));
}

// the mountain: a cliff north of z ≈ -48 (the bunker is cut into it)
export function cliffRise(x, z) {
  const edge = -48 - (fbm(x * 0.08 + 9, 2.1, 2) - 0.5) * 3 - Math.max(0, Math.abs(x) - 6) * 0.05;
  return 24 * smoothstep(edge, edge - 7, z);
}

function baseHeight(x, z) {
  let h = (fbm(x * 0.03 + 11, z * 0.03 - 5, 3) - 0.5) * 5;
  h += (fbm(x * 0.09 + 30, z * 0.09, 2) - 0.5) * 1.1;
  // the valley climbs toward the mountain
  h += (66 - z) * 0.085;
  return h;
}

const clearingBase = RCLEARINGS.map((c) => ({ ...c, h: baseHeight(c.x, c.z) }));

function rawHeight(x, z) {
  let h = baseHeight(x, z);
  for (const c of clearingBase) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r) h += (c.h - h) * (1 - smoothstep(c.r * 0.55, c.r, d));
  }
  h += wallRise(x, z) + cliffRise(x, z);
  const pd = distToTrail(x, z);
  if (pd < 2.2) h -= (1 - pd / 2.2) * 0.1;
  return h;
}

// the ground in front of the bunker door; the facade footprint is cut out of the cliff below it
export const DOOR_FLOOR = rawHeight(0, -44.5);
export function inFacade(x, z) { return Math.abs(x) < 4.45 && z < -46.15 && z > -52.4; }

export function heightAt(x, z) {
  const h = rawHeight(x, z);
  return inFacade(x, z) ? Math.min(h, DOOR_FLOOR - 0.3) : h;
}
