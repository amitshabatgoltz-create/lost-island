// Geometry, material and texture helpers shared by every zone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, mulberry32 } from '../noise.js';

export function grainTexture() {
  const s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(s, s);
  const r = mulberry32(7);
  for (let i = 0; i < s * s; i++) {
    const v = 200 + r() * 55;
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(90, 90);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

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
  const fabric = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.4, metalness: 0.6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), fabric);
  base.position.y = 0.45;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.12), fabric);
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

export function swayMaterial(params, shared, strength = 0.05) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float hh = max(position.y - 0.4, 0.0);
        float sw = sin(uTime*1.25 + ip.x*0.31 + ip.z*0.17) + 0.4*sin(uTime*2.7 + ip.z*0.5);
        transformed.x += sw * ${strength.toFixed(3)} * hh;
        transformed.z += cos(uTime*1.05 + ip.x*0.21) * ${(strength * 0.6).toFixed(3)} * hh;`);
  };
  return m;
}

export function palmGeometries() {
  const trunkParts = [];
  const segs = 9, H = 7.5;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const r0 = 0.26 - t0 * 0.1;
    const c = new THREE.CylinderGeometry(r0 - 0.012, r0, H / segs + 0.05, 8, 1);
    const bend = (t) => t * t * 1.6;
    const y = (i + 0.5) * (H / segs);
    c.rotateZ(-0.12 - t0 * 0.22);
    c.translate(bend(t0 + 0.5 / segs), y, 0);
    colorize(c, i % 2 ? 0x8b7350 : 0x7a6444);
    trunkParts.push(c);
  }
  const top = new THREE.Vector3(1.6, H, 0);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.SphereGeometry(0.18, 7, 5);
    s.translate(top.x + Math.cos(i * 1.6) * 0.25, top.y - 0.25, Math.sin(i * 1.6) * 0.25);
    colorize(s, 0x4a3a20);
    trunkParts.push(s);
  }
  const fronds = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const g = new THREE.PlaneGeometry(1.1, 3.8, 2, 8);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k);
      const t = (y + 1.9) / 3.8; // 0..1 along the leaf
      const w = Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.9 + 0.1;
      p.setXYZ(k, x * w, t * 3.8, -t * t * 1.9 + Math.abs(x) * 0.35);
    }
    g.rotateX(-Math.PI / 2 + 0.55);
    g.rotateY((i / N) * Math.PI * 2 + (i % 2) * 0.2);
    g.translate(top.x, top.y, top.z);
    colorize(g, i % 3 === 0 ? 0x5d7b2c : 0x4b6d25);
    fronds.push(g);
  }
  return { trunk: merge(trunkParts), leaves: merge(fronds) };
}

export function jungleTreeGeometries(seed) {
  const r = mulberry32(seed);
  const H = 7 + r() * 3;
  const trunk = new THREE.CylinderGeometry(0.28, 0.5, H, 7, 2);
  trunk.translate(0, H / 2, 0);
  colorize(trunk, 0x5a4632);
  const parts = [trunk];
  const branch = new THREE.CylinderGeometry(0.08, 0.16, 2.4, 6);
  branch.rotateZ(0.9);
  branch.translate(0.8, H * 0.65, 0);
  colorize(branch, 0x5a4632);
  parts.push(branch);
  const blobs = [];
  const n = 4;
  for (let i = 0; i < n; i++) {
    const s = 1.6 + r() * 1.3;
    const g = new THREE.IcosahedronGeometry(s, 1);
    jitterGeometry(g, 0.7, 2, seed + i);
    const a = r() * Math.PI * 2, d = i === 0 ? 0 : 1.2 + r() * 1.0;
    g.scale(1, 0.75, 1);
    g.translate(Math.cos(a) * d, H + (r() - 0.3) * 1.6, Math.sin(a) * d);
    colorize(g, [0x3a5a22, 0x2f4f1c, 0x46682a][i % 3]);
    blobs.push(g);
  }
  return { trunk: merge(parts), leaves: merge(blobs) };
}

export function bushGeometry(seed) {
  const r = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.IcosahedronGeometry(0.6 + r() * 0.4, 1);
    jitterGeometry(g, 0.3, 3, seed * 3 + i);
    g.translate((r() - 0.5) * 0.9, 0.45 + r() * 0.3, (r() - 0.5) * 0.9);
    colorize(g, i % 2 ? 0x3f6324 : 0x4c7029);
    parts.push(g);
  }
  return merge(parts);
}

export function fernGeometry() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.PlaneGeometry(0.35, 1.3, 1, 5);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const t = (p.getY(k) + 0.65) / 1.3;
      p.setXYZ(k, p.getX(k) * Math.sin(Math.min(1, t * 1.2) * Math.PI), t * 1.3, -t * t * 0.6);
    }
    g.rotateX(-0.9);
    g.rotateY((i / 7) * Math.PI * 2);
    colorize(g, i % 2 ? 0x4f7a2a : 0x5d8a33);
    parts.push(g);
  }
  return merge(parts);
}

export function grassGeometry() {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.PlaneGeometry(0.09, 0.7, 1, 2);
    g.translate(0, 0.35, 0);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) if (p.getY(k) > 0.6) p.setX(k, 0);
    g.rotateZ((Math.random() - 0.5) * 0.5);
    g.rotateY(i * 1.05);
    g.translate((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);
    colorize(g, i % 2 ? 0x6b8a3a : 0x7f9a45);
    parts.push(g);
  }
  return merge(parts);
}
