// Procedural models for the NIGHTJAR observation facility N-1 (Part 3): painted concrete rooms, steel doors,
// desks, lockers, filing cabinets, CRT monitors with readable screens, ceiling lamps, pipes and cable trays.
import * as THREE from 'three';
import { canvasTex, drawSymbol } from '../../items.js';
import { shadowAll } from '../shared.js';
import { propMaterial } from '../../gfx/materials.js';
import { tileFbm } from '../../gfx/textures.js';
import { H } from './layout.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
export function box(parent, w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------- textures (one canvas each, reused by every surface)
// wall: old two-tone paint (green-grey dado, off-white above), a painted stripe, scuffs and damp stains
function wallTexture() {
  const W = 512, Hh = 512;
  const n = tileFbm(256, 6, 4, 311), fine = tileFbm(256, 48, 2, 312);
  return canvasTex(W, Hh, (c) => {
    const id = c.createImageData(W, Hh), d = id.data;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, k = ((y % 256) * 256 + (x % 256));
      const low = y > Hh * 0.6; // v = 0 at the floor (texture is flipped: bottom of canvas = floor)
      const tone = 0.9 + (n[k] - 0.5) * 0.18 + (fine[k] - 0.5) * 0.06;
      const base = low ? [104, 118, 104] : [196, 192, 178];
      d[i] = base[0] * tone; d[i + 1] = base[1] * tone; d[i + 2] = base[2] * tone; d[i + 3] = 255;
    }
    c.putImageData(id, 0, 0);
    c.fillStyle = '#7a3a24'; c.fillRect(0, Hh * 0.6 - 10, W, 8); // painted stripe
    c.fillStyle = 'rgba(40,36,30,0.5)'; c.fillRect(0, Hh - 14, W, 14); // skirting grime
    for (let i = 0; i < 26; i++) { // damp streaks from the ceiling
      const x = Math.random() * W, len = 40 + Math.random() * 200;
      const g = c.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, 'rgba(60,52,36,0.35)'); g.addColorStop(1, 'rgba(60,52,36,0)');
      c.fillStyle = g; c.fillRect(x, 0, 3 + Math.random() * 10, len);
    }
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(30,30,28,${Math.random() * 0.25})`; c.fillRect(Math.random() * W, Hh * 0.62 + Math.random() * Hh * 0.36, 6 + Math.random() * 30, 1 + Math.random() * 3); }
  });
}
function concreteTexture(seed, base, spots = 0.3) {
  const S = 256;
  const n = tileFbm(S, 5, 4, seed), fine = tileFbm(S, 64, 2, seed + 1);
  return canvasTex(S, S, (c) => {
    const id = c.createImageData(S, S), d = id.data;
    for (let i = 0; i < S * S; i++) {
      const k = 0.86 + (n[i] - 0.5) * 0.3 + (fine[i] - 0.5) * 0.12 - (n[i] > 0.68 ? spots * 0.3 : 0);
      d[i * 4] = base[0] * k; d[i * 4 + 1] = base[1] * k; d[i * 4 + 2] = base[2] * k; d[i * 4 + 3] = 255;
    }
    c.putImageData(id, 0, 0);
  });
}
const repeatTex = (t, rx, ry) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };

export function facilityMaterials() {
  const wallTex = wallTexture();
  wallTex.wrapS = THREE.RepeatWrapping;
  return {
    wall: std({ map: wallTex, roughness: 0.92 }),
    floor: std({ map: repeatTex(concreteTexture(321, [118, 116, 110], 0.5), 9, 9), roughness: 0.88 }),
    ceiling: std({ map: repeatTex(concreteTexture(331, [92, 92, 90]), 8, 8), roughness: 0.95 }),
    steel: propMaterial('metal', { color: 0x5b6267, roughness: 0.5, metalness: 0.55 }, 2),
    green: propMaterial('metal', { color: 0x4f5e52, roughness: 0.6, metalness: 0.35 }, 2),
    grey: propMaterial('metal', { color: 0x8a8b86, roughness: 0.6, metalness: 0.35 }, 2),
    rust: propMaterial('metal', { color: 0x6f4c34, roughness: 0.85, metalness: 0.35 }, 1.6),
    wood: propMaterial('wood', { color: 0x7d6448, roughness: 0.9 }),
    dark: std({ color: 0x1a1c1d, roughness: 0.6 }),
    paper: std({ color: 0xe6dfcc, roughness: 0.95 }),
  };
}

// a wall slab along a segment, textured so the paint band keeps its height whatever the length
export function wallSegment(ctx, M, x0, z0, x1, z1, { y0 = 0, y1 = H, t = 0.3 } = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.02) return;
  const g = new THREE.BoxGeometry(len, y1 - y0, t);
  // u along the wall in metres / 3, v from floor to ceiling on the full texture
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 3, (uv.getY(i) * (y1 - y0) + y0) / H);
  const m = new THREE.Mesh(g, M.wall);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  m.receiveShadow = true;
  ctx.group.add(m);
  ctx.occluders.push(m);
  if (y0 < 1) ctx.colliders.push({ type: 'box', x: m.position.x, z: m.position.z, hw: len / 2, hd: t / 2, rot: m.rotation.y });
  return m;
}

// ---------------------------------------------------------------- doors
// a steel sliding door in a wall: the leaf slides along the wall into a pocket
export function buildDoor(ctx, M, D, { stencilLines, reader = true, sealed = false } = {}) {
  const g = new THREE.Group();
  ctx.group.add(g);
  const alongX = D.axis === 'z'; // a wall at constant z runs along x
  const cx = alongX ? D.c : D.at, cz = alongX ? D.at : D.c;
  g.position.set(cx, 0, cz);
  g.rotation.y = alongX ? 0 : Math.PI / 2;
  const w = D.hw * 2, dh = 2.35;
  // frame and lintel wall above the door
  box(g, 0.12, dh, 0.36, M.rust, -D.hw - 0.06, dh / 2, 0);
  box(g, 0.12, dh, 0.36, M.rust, D.hw + 0.06, dh / 2, 0);
  box(g, w + 0.24, 0.12, 0.36, M.rust, 0, dh + 0.06, 0);
  wallSegmentLocal(g, M, w + 0.24, dh + 0.12, H);
  const leaf = new THREE.Group();
  g.add(leaf);
  box(leaf, w, dh - 0.02, 0.08, sealed ? M.rust : M.steel, 0, (dh - 0.02) / 2, 0);
  box(leaf, w - 0.2, 0.05, 0.1, M.grey, 0, 1.05, 0);
  const win = box(leaf, 0.36, 0.36, 0.1, std({ color: 0x0b1012, roughness: 0.15, metalness: 0.3 }), 0, 1.6, 0);
  win.visible = !sealed;
  if (stencilLines) {
    const tex = canvasTex(512, 128, (c) => {
      c.clearRect(0, 0, 512, 128);
      c.fillStyle = sealed ? 'rgba(160,30,20,0.9)' : 'rgba(225,220,200,0.88)';
      stencilLines.forEach(([t, s], i) => { c.font = `bold ${s}px monospace`; c.fillText(t, 16, 16 + s + i * (s + 10)); });
    });
    for (const side of [1, -1]) {
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, w * 0.225), std({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      lbl.position.set(0, 2.05, side * 0.055);
      if (side < 0) lbl.rotation.y = Math.PI;
      leaf.add(lbl);
    }
  }
  if (sealed) {
    for (const y of [0.6, 1.3, 2.0]) box(g, w + 0.5, 0.1, 0.06, M.rust, 0, y, 0.12); // welded bars
    const tape = canvasTex(256, 32, (c) => { for (let i = -2; i < 20; i++) { c.fillStyle = i % 2 ? '#1c1c1c' : '#c79a1e'; c.beginPath(); c.moveTo(i * 16, 32); c.lineTo(i * 16 + 16, 32); c.lineTo(i * 16 + 32, 0); c.lineTo(i * 16 + 16, 0); c.fill(); } });
    const t1 = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, 0.12), std({ map: tape, roughness: 0.6 }));
    t1.position.set(0, 1.0, 0.16);
    t1.rotation.z = 0.5;
    g.add(t1);
  }
  let ledMat = null;
  if (reader) {
    const rd = new THREE.Group();
    rd.position.set(D.hw + 0.35, 1.25, 0.2);
    g.add(rd);
    box(rd, 0.14, 0.22, 0.05, M.dark, 0, 0, 0);
    ledMat = std({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 1.6 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), ledMat);
    led.position.set(0, 0.07, 0.03);
    rd.add(led);
    const rd2 = rd.clone();
    rd2.position.z = -0.2;
    rd2.rotation.y = Math.PI;
    g.add(rd2);
    rd2.traverse((o) => { if (o.material === ledMat) o.material = ledMat; });
  }
  shadowAll(g);
  const col = { type: 'box', x: cx, z: cz, hw: alongX ? D.hw : 0.15, hd: alongX ? 0.15 : D.hw, rot: 0 };
  ctx.colliders.push(col);
  return {
    leaf, ledMat, col, hw: D.hw,
    setOpen(k) { leaf.position.x = -k * (w + 0.05); },
  };
}
// the bit of wall above a door, in the door group's local space
function wallSegmentLocal(g, M, w, y0, y1) {
  const geo = new THREE.BoxGeometry(w, y1 - y0, 0.3);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3, (uv.getY(i) * (y1 - y0) + y0) / H);
  const m = new THREE.Mesh(geo, M.wall);
  m.position.set(0, (y0 + y1) / 2, 0);
  g.add(m);
}

// ---------------------------------------------------------------- lights
// caged ceiling lamp; returns its bulb material so the facility can switch it (normal / flicker / emergency)
export function buildCeilingLamp(ctx, M, x, z, { len = 1.2, rot = 0 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, H - 0.08, z);
  g.rotation.y = rot;
  ctx.group.add(g);
  box(g, len, 0.08, 0.22, M.grey, 0, 0, 0);
  const bulbMat = std({ color: 0x333028, emissive: 0xfff0d0, emissiveIntensity: 2.2 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len - 0.15, 8), bulbMat);
  tube.rotation.z = Math.PI / 2;
  tube.position.y = -0.08;
  g.add(tube);
  for (let i = -2; i <= 2; i++) { const bar = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.006, 4, 8, Math.PI), M.dark); bar.position.set(i * (len - 0.2) / 4, -0.05, 0); bar.rotation.set(Math.PI, Math.PI / 2, 0); g.add(bar); }
  return bulbMat;
}
// red emergency beacon on a wall bracket
export function buildEmergencyLamp(ctx, x, y, z) {
  const mat = std({ color: 0x300606, emissive: 0xff2a1a, emissiveIntensity: 0 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.16, 10), mat);
  m.position.set(x, y, z);
  ctx.group.add(m);
  return mat;
}

// ---------------------------------------------------------------- pipes and cable trays along the ceiling
export function buildPipes(ctx, M, runs) {
  for (const [x0, z0, x1, z1, y, r] of runs) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), r > 0.06 ? M.rust : M.grey);
    p.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    p.rotation.set(0, -Math.atan2(z1 - z0, x1 - x0), Math.PI / 2);
    p.castShadow = true;
    ctx.group.add(p);
  }
}
export function buildCableTray(ctx, M, x0, z0, x1, z1, y = H - 0.25) {
  const len = Math.hypot(x1 - x0, z1 - z0), rot = -Math.atan2(z1 - z0, x1 - x0);
  const g = new THREE.Group();
  g.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  g.rotation.y = rot;
  ctx.group.add(g);
  box(g, len, 0.03, 0.3, M.grey, 0, 0, 0);
  box(g, len, 0.08, 0.02, M.grey, 0, 0.04, 0.15);
  box(g, len, 0.08, 0.02, M.grey, 0, 0.04, -0.15);
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 6), std({ color: [0x111111, 0x3a2a1a, 0x1e2a3a, 0x222222][i], roughness: 0.6 })); c.rotation.z = Math.PI / 2; c.position.set(0, 0.04, -0.1 + i * 0.065); g.add(c); }
  // a cable hanging loose
  const hang = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.015, 5, 16, Math.PI), std({ color: 0x111111 }));
  hang.position.set(len * 0.2, -0.05, 0.14);
  hang.rotation.set(Math.PI, Math.PI / 2, 0);
  g.add(hang);
}

// ---------------------------------------------------------------- furniture
export function buildDesk(ctx, M, x, z, rot = 0, { w = 1.6, d = 0.8 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  ctx.group.add(g);
  box(g, w, 0.05, d, M.grey, 0, 0.76, 0);
  box(g, 0.45, 0.72, d - 0.05, M.green, -w / 2 + 0.25, 0.37, 0); // drawer pedestal
  for (const y of [0.18, 0.42, 0.64]) box(g, 0.4, 0.02, 0.02, M.dark, -w / 2 + 0.25, y, d / 2);
  box(g, 0.04, 0.72, d - 0.1, M.grey, w / 2 - 0.04, 0.37, 0);
  box(g, w - 0.5, 0.5, 0.02, M.grey, 0.2, 0.5, -d / 2 + 0.03); // modesty panel
  ctx.colliders.push({ type: 'box', x, z, hw: w / 2, hd: d / 2, rot });
  return g;
}
export function buildChair(ctx, M, x, z, rot = 0, tipped = false) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  ctx.group.add(g);
  box(g, 0.45, 0.06, 0.45, M.green, 0, 0.46, 0);
  box(g, 0.45, 0.45, 0.05, M.green, 0, 0.72, -0.2);
  for (const [a, b] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(g, 0.03, 0.46, 0.03, M.dark, a, 0.23, b);
  if (tipped) { g.rotation.z = Math.PI / 2; g.position.y = 0.23; }
}
export function buildLockers(ctx, M, x, z, rot, n, openIndex = -1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  ctx.group.add(g);
  const W = 0.5;
  let openDoor = null;
  for (let i = 0; i < n; i++) {
    const lx = (i - (n - 1) / 2) * W;
    box(g, W - 0.02, 1.9, 0.5, M.green, lx, 0.95, 0);
    if (i === openIndex) {
      box(g, W - 0.08, 1.84, 0.45, M.dark, lx, 0.95, 0.03); // dark inside
      const pivot = new THREE.Group();
      pivot.position.set(lx - W / 2 + 0.02, 0, 0.26);
      g.add(pivot);
      box(pivot, W - 0.04, 1.86, 0.03, M.green, (W - 0.04) / 2, 0.95, 0);
      pivot.rotation.y = -1.9;
      openDoor = pivot;
      // a dark raincoat on the hook
      const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.05, 10, 1, true), std({ color: 0x1d2024, roughness: 0.75, side: THREE.DoubleSide }));
      coat.position.set(lx, 1.15, 0.05);
      coat.scale.z = 0.55;
      g.add(coat);
    } else {
      box(g, W - 0.06, 1.84, 0.02, M.green, lx, 0.95, 0.26);
      for (let k = 0; k < 3; k++) box(g, 0.3, 0.015, 0.01, M.dark, lx, 1.6 + k * 0.05, 0.275);
      box(g, 0.03, 0.12, 0.02, M.grey, lx + W / 2 - 0.08, 1.0, 0.28);
    }
  }
  ctx.colliders.push({ type: 'box', x, z, hw: n * W / 2, hd: 0.27, rot });
  return { group: g, openDoor };
}
export function buildFilingCabinets(ctx, M, x, z, rot, n, { openIndex = -1, color } = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  ctx.group.add(g);
  const W = 0.5;
  const mat = color || M.grey;
  for (let i = 0; i < n; i++) {
    const lx = (i - (n - 1) / 2) * W;
    box(g, W - 0.02, 1.35, 0.62, mat, lx, 0.675, 0);
    for (let k = 0; k < 4; k++) {
      const out = i === openIndex && k === 1 ? 0.38 : 0;
      box(g, W - 0.08, 0.3, 0.03, mat, lx, 0.2 + k * 0.32, 0.32 + out);
      box(g, 0.12, 0.025, 0.03, M.dark, lx, 0.27 + k * 0.32, 0.345 + out);
      if (out) { box(g, W - 0.12, 0.26, 0.4, M.grey, lx, 0.2 + k * 0.32, 0.12 + out); for (let f = 0; f < 6; f++) box(g, W - 0.16, 0.22, 0.01, M.paper, lx, 0.25 + k * 0.32, 0.0 + out + f * 0.05); }
    }
  }
  ctx.colliders.push({ type: 'box', x, z, hw: n * W / 2, hd: 0.32, rot });
  return g;
}
// red steel cabinet with a lock that the archive terminal releases
export function buildRestrictedCabinet(ctx, M, x, z, rot) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  ctx.group.add(g);
  const red = propMaterial('metal', { color: 0x7a2a22, roughness: 0.6, metalness: 0.4 }, 2);
  box(g, 1.0, 1.9, 0.5, red, 0, 0.95, 0);
  box(g, 0.94, 1.84, 0.4, M.dark, 0, 0.95, 0.04);
  const shelf = box(g, 0.9, 0.03, 0.38, M.grey, 0, 1.0, 0.04);
  void shelf;
  const doors = [-1, 1].map((sd) => {
    const p = new THREE.Group();
    p.position.set(sd * 0.49, 0, 0.26);
    g.add(p);
    box(p, 0.48, 1.86, 0.03, red, -sd * 0.24, 0.95, 0);
    return p;
  });
  const lblTex = canvasTex(256, 96, (c) => { c.fillStyle = '#e8e2d0'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#7a2a22'; c.font = 'bold 26px monospace'; c.fillText('RESTRICTED', 34, 40); c.font = 'bold 18px monospace'; c.fillStyle = '#222'; c.fillText('TERMINAL RELEASE ONLY', 14, 74); });
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), std({ map: lblTex, roughness: 0.8 }));
  lbl.position.set(0.24, 1.55, 0.03);
  doors[1].add(lbl);
  const ledMat = std({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 1.6 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), ledMat);
  led.position.set(0, 1.15, 0.29);
  g.add(led);
  // the file inside
  const file = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.24), std({ color: 0xb03a2e, roughness: 0.8 }));
  file.position.set(0, 1.03, 0.06);
  g.add(file);
  shadowAll(g);
  ctx.colliders.push({ type: 'box', x, z, hw: 0.5, hd: 0.27, rot });
  return { doors, ledMat, file, setOpen(k) { doors[0].rotation.y = k * 1.7; doors[1].rotation.y = -k * 1.7; } };
}

// a document lying on a surface
export function buildPaper(parent, x, y, z, rot, color = 0xe6dfcc, size = [0.22, 0.3]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size[0], 0.006, size[1]), std({ color, roughness: 0.95 }));
  m.position.set(x, y, z);
  m.rotation.y = rot;
  m.castShadow = true;
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------- CRT monitors
// a screen whose content is a canvas: draw(fn) redraws it; emissive so it glows in the dark
export function buildCRT(parent, M, { w = 0.62, h = 0.48, depth = 0.45, cw = 320, ch = 240 } = {}) {
  const g = new THREE.Group();
  parent.add(g);
  box(g, w + 0.1, h + 0.1, depth, M.grey, 0, 0, -depth / 2 + 0.02);
  box(g, w * 0.7, h * 0.7, 0.2, M.grey, 0, 0, -depth - 0.06);
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = std({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1, roughness: 0.25, metalness: 0.1 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  screen.position.z = 0.03;
  g.add(screen);
  const c = cv.getContext('2d');
  return {
    group: g, mat, tex, screen, c, cw, ch,
    draw(fn) { fn(c, cw, ch); scanlines(c, cw, ch); tex.needsUpdate = true; },
    off() { c.fillStyle = '#050606'; c.fillRect(0, 0, cw, ch); tex.needsUpdate = true; mat.emissiveIntensity = 0; },
    on(k = 1) { mat.emissiveIntensity = k; },
  };
}
function scanlines(c, w, h) {
  c.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
  const g = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}

// readable screen layouts (the same words appear in the readable terminal panel)
export const SCREEN = {
  text(c, w, h, title, lines, { color = '#8ef0b0', bg = '#04100a', size = 17 } = {}) {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = color; c.font = `bold ${size + 2}px monospace`; c.fillText(title, 12, 28);
    c.fillRect(12, 36, w - 24, 2);
    c.font = `${size}px monospace`;
    lines.forEach((l, i) => { c.fillStyle = l.startsWith('!') ? '#ffb347' : color; c.fillText(l.replace(/^!/, ''), 12, 62 + i * (size + 7)); });
  },
  // a still frame from a camera: a simple night scene, clearly marked as the last recorded frame
  still(c, w, h, label, time, scene) {
    c.fillStyle = '#0b120e'; c.fillRect(0, 0, w, h);
    c.save();
    c.globalAlpha = 0.9;
    scene(c, w, h);
    c.restore();
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(160,220,180,${Math.random() * 0.12})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    c.fillStyle = '#d6ffe4'; c.font = 'bold 15px monospace'; c.fillText(label, 10, 22);
    c.fillStyle = '#ffb347'; c.font = '14px monospace'; c.fillText(time, 10, h - 12);
  },
};

export function nightjarSymbolTexture() {
  return canvasTex(256, 256, (c) => { c.clearRect(0, 0, 256, 256); drawSymbol(c, 128, 128, 90, 'rgba(225,220,200,0.55)'); });
}
