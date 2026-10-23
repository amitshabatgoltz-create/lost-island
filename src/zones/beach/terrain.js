// Island height function — shared by the terrain mesh, collision and placement.
// Coordinate convention: +Z is the sea (south), -Z is the jungle (north).
import { fbm, smoothstep } from '../../noise.js';

export const WATER_LEVEL = 0;

// Playable bounds (the rest of the island is scenery for later parts).
export const BOUNDS = { minX: -92, maxX: 92, minZ: -100, maxZ: 60 };

export function shoreZ(x) {
  return 28 + 7 * Math.sin(x * 0.045 + 1.3) + 3 * Math.sin(x * 0.12);
}

export const PATHS = [
  // main trail: beach -> wreck -> into the jungle
  [[-4, 27], [0, 14], [2, 2], [-3, -14], [-5, -30], [0, -48], [6, -66], [3, -86], [0, -104], [2, -125]],
  // branch to the tail section
  [[2, 2], [14, -6], [26, -12], [33, -17]],
  // branch west to the rocks
  [[0, 14], [-14, 8], [-24, -2], [-28, -8]],
];

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  const cx = ax + dx * t - px, cz = az + dz * t - pz;
  return Math.sqrt(cx * cx + cz * cz);
}

export function distToPaths(x, z) {
  let best = 1e9;
  for (const p of PATHS) {
    for (let i = 0; i < p.length - 1; i++) {
      const d = segDist(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
      if (d < best) best = d;
    }
  }
  return best;
}

export function heightAt(x, z) {
  const d = shoreZ(x) - z; // > 0 means inland
  let h;
  if (d < 0) h = Math.max(-9, d * 0.14);
  else if (d < 22) h = d * 0.045;
  else h = 0.99 + (d - 22) * 0.018;

  const inland = smoothstep(18, 45, d);
  h += (fbm(x * 0.03, z * 0.03, 4) - 0.5) * 3.2 * inland;
  h += (fbm(x * 0.13 + 50, z * 0.13, 2) - 0.5) * 0.22;

  // rocky headlands on both sides form a natural bay
  const ax = Math.abs(x);
  h += smoothstep(70, 112, ax) * 17 * (0.7 + 0.6 * fbm(x * 0.05, z * 0.05 + 9, 3));
  // the island rises toward the deep jungle
  h += smoothstep(-95, -160, z) * 11 * (0.6 + 0.8 * fbm(x * 0.04 + 3, z * 0.04, 3));

  // trails are slightly worn into the ground
  if (d > 0) {
    const pd = distToPaths(x, z);
    if (pd < 2.5) h -= (1 - pd / 2.5) * 0.12;
  }
  return h;
}

// distance inland from the waterline
export function inlandDist(x, z) {
  return shoreZ(x) - z;
}
