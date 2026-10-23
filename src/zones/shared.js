// Geometry, material and texture helpers shared by every zone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, mulberry32 } from '../noise.js';
import { toAtlas, scaleUV } from '../gfx/materials.js';
import { ATLAS, fabricTex } from '../gfx/textures.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const roundedBox = (w, h, d, r) => scaleUV(new RoundedBoxGeometry(w, h, d, 2, r), 3, 3);

export function jitterGeometry(geo, amount, freq = 1, seed = 1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = fbm(x * 0.37 * freq / 5 + seed, z * 0.37 * freq / 5 + y * 0.1, 2) - 0.5;
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    p.setXYZ(i, x + (x / len) * n * amount, y + (y / len) * n * amount, z + (z / len) * n * amount);
  }
  geo.computeVertexNormals();
}

export function colorize(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

export function cleanForMerge(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

export const merge = (list) => mergeGeometries(list.map(cleanForMerge));

export function shadowAll(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

export function makeSeat(color = 0x2a4a7a) {
  const g = new THREE.Group();
  const fab = fabricTex();
  const fabric = new THREE.MeshStandardMaterial({ color, roughness: 0.95, map: fab.map, normalMap: fab.normalMap });
  const frame = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.4, metalness: 0.6 });
  const base = new THREE.Mesh(roundedBox(0.5, 0.14, 0.5, 0.04), fabric);
  base.position.y = 0.45;
  const back = new THREE.Mesh(roundedBox(0.5, 0.75, 0.12, 0.04), fabric);
  back.position.set(0, 0.85, -0.22);
  back.rotation.x = -0.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.18, 0.1), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.9 }));
  head.position.set(0, 1.24, -0.27);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.38, 0.06), frame);
  legs.position.set(0, 0.2, 0.05);
  g.add(base, back, head, legs);
  return g;
}

export function makeSuitcaseMesh(color, scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.28, 0.5), mat);
  body.position.y = 0.14;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
  handle.position.set(0, 0.14, 0.26);
  handle.rotation.x = Math.PI / 2;
  const rib = new THREE.Mesh(new THREE.BoxGeometry(0.77, 0.04, 0.52), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.6 }));
  rib.position.y = 0.14;
  g.add(body, handle, rib);
  g.scale.setScalar(scale);
  shadowAll(g);
  return g;
}

export function softSprite(r = 255, gg = 255, b = 255) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grd.addColorStop(0.4, `rgba(${r},${gg},${b},0.5)`);
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  return t;
}

export function stencilTexture(text) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(25,25,25,0.85)';
  ctx.font = 'bold 72px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 90);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ vegetation geometry
// Leaves are alpha-tested cards that sample the foliage atlas (gfx/textures.js). Card normals point away
// from the crown centre, so a crown is shaded like one soft volume instead of a pile of flat facets.
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _Z = new THREE.Vector3(0, 0, 1);

function setNormals(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) { fn(_v.set(p.getX(i), p.getY(i), p.getZ(i))); n.setXYZ(i, _v.x, _v.y, _v.z); }
  return geo;
}
function shadeVertices(geo, fn) {
  const p = geo.attributes.position, cols = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const [r, g, b] = fn(p.getX(i), p.getY(i), p.getZ(i));
    cols[i * 3] = r; cols[i * 3 + 1] = g; cols[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

// leaf crown: dark core blob + leaf-cluster cards on its surface
function crown(parts, cx, cy, cz, radius, cards, cardSize, r, centre, tint = [1, 1, 1]) {
  const core = new THREE.IcosahedronGeometry(radius * 0.6, 0);
  jitterGeometry(core, radius * 0.18, 2, cx * 3 + cz);
  core.scale(1, 0.78, 1);
  core.translate(cx, cy, cz);
  toAtlas(core, ATLAS.leaf);
  const uv = core.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, ATLAS.leaf[0] + 0.25, ATLAS.leaf[1] + 0.25); // solid centre of the leaf cell
  shadeVertices(core, () => [0.85 * tint[0], 0.9 * tint[1], 0.85 * tint[2]]);
  parts.push(core);
  for (let k = 0; k < cards; k++) {
    // direction biased upward and outward
    const u = r() * 2 - 1, a = r() * Math.PI * 2;
    const dir = new THREE.Vector3(Math.sqrt(1 - u * u) * Math.cos(a), Math.abs(u) * 0.8 - 0.1, Math.sqrt(1 - u * u) * Math.sin(a)).normalize();
    const size = cardSize * (0.75 + r() * 0.5);
    const g = new THREE.PlaneGeometry(size, size);
    toAtlas(g, ATLAS.leaf);
    _q.setFromUnitVectors(_Z, dir);
    _q2.setFromAxisAngle(dir, r() * Math.PI * 2);
    _m.makeRotationFromQuaternion(_q2.multiply(_q));
    g.applyMatrix4(_m);
    g.translate(cx + dir.x * radius * 0.78, cy + dir.y * radius * 0.6, cz + dir.z * radius * 0.78);
    parts.push(g);
  }
  return parts;
}
function finishCrown(geo, centre, up = 0.6) {
  // soft volume normals + simple self-shadowing: lower and inner leaves are darker
  setNormals(geo, (p) => p.sub(centre).normalize().lerp(new THREE.Vector3(0, 1, 0), up).normalize());
  const cols = geo.attributes.color, p = geo.attributes.position;
  let maxD = 0;
  for (let i = 0; i < p.count; i++) maxD = Math.max(maxD, Math.hypot(p.getX(i) - centre.x, (p.getY(i) - centre.y) * 1.3, p.getZ(i) - centre.z));
  for (let i = 0; i < p.count; i++) {
    const dy = (p.getY(i) - centre.y) / maxD, dd = Math.hypot(p.getX(i) - centre.x, (p.getY(i) - centre.y) * 1.3, p.getZ(i) - centre.z) / maxD;
    const k = Math.min(1.25, 0.68 + dd * 0.42 + dy * 0.22);
    cols.setXYZ(i, cols.getX(i) * k, cols.getY(i) * k, cols.getZ(i) * k);
  }
  return geo;
}

export function palmGeometries() {
  const trunkParts = [];
  const segs = 9, H = 7.5;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const r0 = 0.26 - t0 * 0.1;
    const c = new THREE.CylinderGeometry(r0 - 0.012, r0, H / segs + 0.05, 10, 1);
    const bend = (t) => t * t * 1.6;
    const y = (i + 0.5) * (H / segs);
    c.rotateZ(-0.12 - t0 * 0.22);
    c.translate(bend(t0 + 0.5 / segs), y, 0);
    scaleUV(c, 1, 0.55);
    colorize(c, i % 2 ? 0xd8d0c4 : 0xc8c0b2);
    trunkParts.push(c);
  }
  const top = new THREE.Vector3(1.6, H, 0);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.SphereGeometry(0.17, 8, 6);
    s.translate(top.x + Math.cos(i * 1.3) * 0.25, top.y - 0.3, Math.sin(i * 1.3) * 0.25);
    colorize(s, 0x5a4a2a);
    trunkParts.push(s);
  }
  const fronds = [];
  const N = 11;
  for (let i = 0; i < N; i++) {
    const L = 3.6 + (i % 3) * 0.4, Wd = 2.3;
    const droop = 1.4 + (i % 2) * 0.9;
    const g = new THREE.PlaneGeometry(Wd, L, 4, 10);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k);
      const t = (y + L / 2) / L; // 0..1 along the leaf
      p.setXYZ(k, x * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.5 + 0.6)), t * L, -t * t * droop + Math.abs(x) * 0.45);
    }
    toAtlas(g, ATLAS.palm);
    g.rotateX(-Math.PI / 2 + 0.45 + (i % 2) * 0.15);
    g.rotateY((i / N) * Math.PI * 2 + (i % 2) * 0.2);
    g.translate(top.x, top.y, top.z);
    shadeVertices(g, (x, y) => { const k = 0.85 + Math.min(0.25, (y - top.y + 1) * 0.12); return [k, k, k * 0.95]; });
    fronds.push(g);
  }
  const leaves = merge(fronds);
  setNormals(leaves, (q) => q.sub(top).setY(0).normalize().multiplyScalar(0.5).add(new THREE.Vector3(0, 1, 0)).normalize());
  return { trunk: merge(trunkParts), leaves };
}

export function jungleTreeGeometries(seed) {
  const r = mulberry32(seed);
  const H = 7 + r() * 3;
  const trunk = new THREE.CylinderGeometry(0.26, 0.5, H, 10, 4);
  // flared, slightly irregular base
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i) / H + 0.5, flare = 1 + Math.max(0, 0.18 - y) * 3.2;
    const a = Math.atan2(tp.getZ(i), tp.getX(i)), wob = 1 + Math.sin(a * 3 + seed) * 0.06;
    tp.setX(i, tp.getX(i) * flare * wob); tp.setZ(i, tp.getZ(i) * flare * wob);
  }
  trunk.computeVertexNormals();
  trunk.translate(0, H / 2, 0);
  scaleUV(trunk, 2, H / 2.2);
  colorize(trunk, 0xc4bcb0);
  const parts = [trunk];
  const branch = new THREE.CylinderGeometry(0.08, 0.16, 2.4, 6);
  branch.rotateZ(0.9);
  branch.translate(0.8, H * 0.65, 0);
  scaleUV(branch, 1, 1);
  colorize(branch, 0xb4ac9e);
  parts.push(branch);
  const leafParts = [];
  const n = 4;
  const centre = new THREE.Vector3(0, H + 0.3, 0);
  const tint = [0.92 + r() * 0.16, 1, 0.9 + r() * 0.15];
  for (let i = 0; i < n; i++) {
    const s = 1.6 + r() * 1.3;
    const a = r() * Math.PI * 2, d = i === 0 ? 0 : 1.2 + r() * 1.0;
    const cx = Math.cos(a) * d, cy = H + (r() - 0.3) * 1.6, cz = Math.sin(a) * d;
    const before = leafParts.length;
    crown(leafParts, cx, cy, cz, s, 5 + Math.round(s * 2.2), s * 1.45, r, centre, tint);
    for (let k = before + 1; k < leafParts.length; k++) shadeVertices(leafParts[k], () => tint);
  }
  return { trunk: merge(parts), leaves: finishCrown(merge(leafParts), centre) };
}

export function bushGeometry(seed) {
  const r = mulberry32(seed);
  const parts = [];
  const centre = new THREE.Vector3(0, 0.5, 0);
  for (let i = 0; i < 3; i++) {
    const s = 0.6 + r() * 0.4;
    const before = parts.length;
    crown(parts, (r() - 0.5) * 0.9, 0.45 + r() * 0.3, (r() - 0.5) * 0.9, s, 5, s * 1.45, r, centre);
    for (let k = before + 1; k < parts.length; k++) shadeVertices(parts[k], () => [1, 1, 1]);
  }
  return finishCrown(merge(parts), centre, 0.45);
}

export function fernGeometry() {
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const g = new THREE.PlaneGeometry(0.75, 1.35, 2, 6);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const t = (p.getY(k) + 0.675) / 1.35;
      p.setXYZ(k, p.getX(k), t * 1.35, -t * t * 0.7 + Math.abs(p.getX(k)) * 0.25);
    }
    toAtlas(g, ATLAS.fern);
    g.rotateX(-0.95 + (i % 2) * 0.2);
    g.rotateY((i / 8) * Math.PI * 2 + (i % 3) * 0.2);
    shadeVertices(g, (x, y) => { const k = 0.7 + Math.min(0.4, y * 0.5); return [k, k, k]; });
    parts.push(g);
  }
  return setNormals(merge(parts), (q) => q.set(q.x * 0.3, 1, q.z * 0.3).normalize());
}

export function grassGeometry() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(0.85, 0.62, 1, 2);
    g.translate(0, 0.31, 0);
    toAtlas(g, ATLAS.grass);
    g.rotateX((Math.random() - 0.5) * 0.25);
    g.rotateY(i * (Math.PI / 3) + Math.random() * 0.3);
    shadeVertices(g, (x, y) => { const k = 0.65 + y * 0.6; return [k, k, k * 0.95]; });
    parts.push(g);
  }
  return setNormals(merge(parts), (q) => q.set(0, 1, 0));
}
