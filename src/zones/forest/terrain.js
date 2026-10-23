// Forest height field: rolling hills, a stream, an eastern ridge with one walkable ramp, flattened clearings.
import { fbm, smoothstep } from '../../noise.js';
import { FPATHS, CLEARINGS } from './layout.js';

export function streamZ(x) {
  return 42 + 8 * Math.sin(x * 0.035 + 0.5) + 3 * Math.sin(x * 0.11);
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  const cx = ax + dx * t - px, cz = az + dz * t - pz;
  return Math.sqrt(cx * cx + cz * cz);
}

export function distToPolyline(x, z, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < best) best = d;
  }
  return best;
}

export function distToPaths(x, z) {
  let best = 1e9;
  for (const p of FPATHS) best = Math.min(best, distToPolyline(x, z, p));
  return best;
}

// Ridge: 10 m plateau east of x≈56. Steep (unclimbable) everywhere except a ramp around z = -60.
export function ridgeHeight(x, z) {
  const ramp = 1 - smoothstep(9, 15, Math.abs(z + 60));
  const steep = smoothstep(54.5, 57.5, x);
  const gentle = smoothstep(36, 66, x);
  return 10 * (steep + (gentle - steep) * ramp);
}

function baseHeight(x, z) {
  let h = (fbm(x * 0.018 + 7, z * 0.018 - 3, 3) - 0.5) * 9;
  h += (fbm(x * 0.07 + 20, z * 0.07, 2) - 0.5) * 1.4;
  // the land rises gently toward the north, away from the beach
  h += smoothstep(80, -90, z) * 3;
  return h;
}

const clearingBase = CLEARINGS.map((c) => ({ ...c, h: baseHeight(c.x, c.z) + ridgeHeight(c.x, c.z) }));

export function heightAt(x, z) {
  let h = baseHeight(x, z) + ridgeHeight(x, z);
  // clearings are flattened so camps and props sit level
  for (const c of clearingBase) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r) h += (c.h - h) * (1 - smoothstep(c.r * 0.55, c.r, d));
  }
  // stream channel
  const sd = Math.abs(z - streamZ(x));
  if (sd < 4.5) h -= 1.35 * (1 - smoothstep(0.8, 4.5, sd));
  // worn trails
  const pd = distToPaths(x, z);
  if (pd < 2.2) h -= (1 - pd / 2.2) * 0.1;
  return h;
}

// water surface of the stream at x (constant across its width)
export function streamLevel(x) {
  const z = streamZ(x);
  return baseHeight(x, z) + ridgeHeight(x, z) - 0.85;
}
