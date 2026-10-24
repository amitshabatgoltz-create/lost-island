// Procedural models for the northern ridge (Part 3): the bunker facade and its door, the access panel,
// the junction box, the generator shed, the tarp camp, the trail camera, signs, cables and lamps.
// Every builder adds meshes to ctx.group and registers its own colliders.
import * as THREE from 'three';
import { canvasTex, drawSymbol } from '../../items.js';
import { softSprite, shadowAll } from '../shared.js';
import { propMaterial } from '../../gfx/materials.js';
import { boxCollider, circleCollider } from '../forest/props.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const rot2 = (lx, lz, r) => ({ x: lx * Math.cos(r) + lz * Math.sin(r), z: -lx * Math.sin(r) + lz * Math.cos(r) });
function box(parent, w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// shared materials for this zone (textured in object space)
export const RMAT = {
  concrete: () => propMaterial('rock', { color: 0x8f8d86, roughness: 0.96 }, 0.7),
  steel: () => propMaterial('metal', { color: 0x5c6166, roughness: 0.55, metalness: 0.55 }, 2),
  rust: () => propMaterial('metal', { color: 0x7a5236, roughness: 0.85, metalness: 0.35 }, 1.6),
  olive: () => propMaterial('metal', { color: 0x5f6a48, roughness: 0.7, metalness: 0.3 }, 2),
  wood: () => propMaterial('wood', { color: 0x8f7354, roughness: 0.92 }),
  tarp: () => propMaterial('cloth', { color: 0x4f5a44, roughness: 1, side: THREE.DoubleSide }, 2),
};

// stencilled NIGHTJAR markings, faded
function stencil(lines, { w = 512, h = 256, color = 'rgba(235,230,215,0.82)', bg = null, symbol = false } = {}) {
  return canvasTex(w, h, (c) => {
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); } else c.clearRect(0, 0, w, h);
    let x = 20;
    if (symbol) { drawSymbol(c, 70, h / 2, h * 0.32, color); x = 140; }
    c.fillStyle = color;
    lines.forEach(([text, size], i) => { c.font = `bold ${size}px monospace`; c.fillText(text, x, 20 + size + i * (size + 14)); });
    // wear: chipped spots
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 160; i++) { c.globalAlpha = Math.random() * 0.7; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 7, 1 + Math.random() * 4); }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  });
}
const decal = (tex, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: tex, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));

// ============================================================================ BUNKER FACADE + DOOR
export function buildBunker(ctx, B, floorY) {
  const { group } = ctx;
  const conc = RMAT.concrete(), steel = RMAT.steel(), rust = RMAT.rust();
  const g = new THREE.Group();
  g.position.set(B.x, floorY, B.z);
  group.add(g);
  const W = B.w, D = B.d, HGT = 4.4, OW = 1.3, OH = 2.75; // facade, half opening width, opening height
  const back = -D / 2 - 0.5; // facade centre is behind the front face
  // side blocks, lintel, roof slab (front face at local z = 0)
  box(g, W / 2 - OW, HGT, D, conc, -(OW + (W / 2 - OW) / 2), HGT / 2, back + 0.5);
  box(g, W / 2 - OW, HGT, D, conc, OW + (W / 2 - OW) / 2, HGT / 2, back + 0.5);
  box(g, OW * 2, HGT - OH, D, conc, 0, OH + (HGT - OH) / 2, back + 0.5);
  box(g, W + 0.6, 0.35, D + 0.8, conc, 0, HGT + 0.1, back + 0.3);
  // weathering streaks running down from the roof edge
  const streaks = canvasTex(256, 256, (c) => {
    c.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 256, len = 60 + Math.random() * 190;
      const gr = c.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, 'rgba(30,26,18,0.55)'); gr.addColorStop(1, 'rgba(30,26,18,0)');
      c.fillStyle = gr; c.fillRect(x, 0, 2 + Math.random() * 6, len);
    }
  });
  for (const sx of [-1, 1]) {
    const st = decal(streaks, W / 2 - OW, HGT - 0.2);
    st.position.set(sx * (OW + (W / 2 - OW) / 2), HGT / 2, 0.02);
    g.add(st);
  }
  // steel door frame
  box(g, 0.18, OH, 0.3, rust, -OW - 0.02, OH / 2, 0.05);
  box(g, 0.18, OH, 0.3, rust, OW + 0.02, OH / 2, 0.05);
  box(g, OW * 2 + 0.4, 0.22, 0.3, rust, 0, OH + 0.05, 0.05);
  // the corridor behind the door: dark, a stair going down, one dim emergency lamp
  const inner = std({ color: 0x3b3d3f, roughness: 0.95 });
  box(g, 0.2, OH, 5.5, inner, -OW + 0.1, OH / 2, -2.9);
  box(g, 0.2, OH, 5.5, inner, OW - 0.1, OH / 2, -2.9);
  box(g, OW * 2, 0.2, 5.5, inner, 0, OH, -2.9);
  box(g, OW * 2, 0.1, 2.2, inner, 0, -0.04, -1.1);
  for (let i = 0; i < 6; i++) box(g, OW * 2 - 0.2, 0.2, 0.42, inner, 0, -0.18 - i * 0.2, -2.4 - i * 0.4); // steps going down
  box(g, OW * 2, OH + 1.5, 0.2, std({ color: 0x0c0d0e, roughness: 1 }), 0, OH / 2 - 0.7, -5.6);
  const lampMat = std({ color: 0x220a06, emissive: 0xff4422, emissiveIntensity: 0 });
  const lamp = box(g, 0.3, 0.12, 0.12, lampMat, 0, OH - 0.2, -3.2);
  lamp.castShadow = false;
  const innerLight = new THREE.PointLight(0xff5533, 0, 7, 1.8);
  innerLight.position.set(0, OH - 0.4, -2.8);
  g.add(innerLight);
  // two heavy door leaves that slide apart into the side blocks
  const leafMat = steel;
  const leaves = [-1, 1].map((sx) => {
    const leaf = new THREE.Group();
    box(leaf, OW, OH - 0.05, 0.16, leafMat, 0, (OH - 0.05) / 2, 0);
    for (const y of [0.5, 1.35, 2.2]) box(leaf, OW - 0.12, 0.08, 0.05, rust, 0, y, 0.1);
    box(leaf, 0.06, OH - 0.3, 0.05, rust, -sx * (OW / 2 - 0.08), OH / 2, 0.1);
    leaf.userData.closedX = sx * OW / 2;
    leaf.position.set(leaf.userData.closedX, 0, -0.05);
    g.add(leaf);
    return leaf;
  });
  // markings on the leaves and above the door
  const mark = decal(stencil([['NIGHTJAR', 64], ['FIELD STATION N-1', 34], ['AUTHORIZED PERSONNEL ONLY', 24]], { symbol: true }), 2.3, 1.15);
  mark.position.set(0, OH + 0.75, 0.03);
  g.add(mark);
  const hazard = canvasTex(256, 32, (c) => { for (let i = -2; i < 20; i++) { c.fillStyle = i % 2 ? '#1c1c1c' : '#c79a1e'; c.beginPath(); c.moveTo(i * 16, 32); c.lineTo(i * 16 + 16, 32); c.lineTo(i * 16 + 32, 0); c.lineTo(i * 16 + 16, 0); c.fill(); } });
  const hz = decal(hazard, OW * 2, 0.16);
  hz.position.set(0, 0.12, 0.13);
  g.add(hz);
  // warning light above the frame (amber, rotating once the door has power)
  const warnMat = std({ color: 0x3a2a08, emissive: 0xffaa22, emissiveIntensity: 0, transparent: true, opacity: 0.9 });
  const warn = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.22, 12), warnMat);
  warn.position.set(OW + 0.55, OH + 0.25, 0.18);
  g.add(warn);
  const warnLight = new THREE.PointLight(0xffaa33, 0, 9, 2);
  warnLight.position.set(OW + 0.55, OH + 0.3, 0.6);
  g.add(warnLight);
  // pipes and conduit along the facade
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, HGT - 0.6, 8), rust);
  pipe.position.set(-W / 2 + 0.4, (HGT - 0.6) / 2, 0.08);
  g.add(pipe);
  const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.1, 8), rust);
  conduit.position.set(OW + 0.95, 1.2, 0.07);
  g.add(conduit);

  // colliders: the two side blocks, and the closed door
  const bx = B.x, bz = B.z - D / 2 + 0.05;
  const sideHW = (W / 2 - OW) / 2;
  boxCollider(ctx, bx - (OW + sideHW), bz, sideHW, D / 2);
  boxCollider(ctx, bx + (OW + sideHW), bz, sideHW, D / 2);
  const doorCol = { type: 'box', x: B.x, z: B.z - 0.3, hw: OW, hd: 0.35, rot: 0 };
  ctx.colliders.push(doorCol);

  return {
    group: g, leaves, warnMat, warnLight, lampMat, innerLight, doorCol, OW,
    setOpen(k) { leaves.forEach((l) => { l.position.x = l.userData.closedX + Math.sign(l.userData.closedX) * k * (OW + 0.05); }); },
  };
}

// access panel beside the door: a small screen whose text follows the power state
export function buildAccessPanel(ctx, P, floorY) {
  const g = new THREE.Group();
  g.position.set(P.x, floorY, P.z);
  ctx.group.add(g);
  box(g, 0.08, 1.5, 0.08, RMAT.rust(), 0, 0.75, -0.05);
  box(g, 0.42, 0.56, 0.14, RMAT.olive(), 0, 1.42, 0);
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 192;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = std({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.3 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), screenMat);
  screen.position.set(0, 1.48, 0.075);
  g.add(screen);
  const reader = box(g, 0.2, 0.08, 0.06, std({ color: 0x1b1b1b, roughness: 0.5 }), 0, 1.24, 0.09);
  const ledMat = std({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 0 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), ledMat);
  led.position.set(0.08, 1.24, 0.125);
  g.add(led);
  const lbl = decal(stencil([['FEED: GEN-2', 54], ['SWIPE · LEVEL 2', 40]], { w: 512, h: 160, color: 'rgba(240,235,220,0.9)' }), 0.36, 0.11);
  lbl.position.set(0, 1.78, 0.075);
  g.add(lbl);
  void reader;
  const draw = (mode) => {
    const c = cv.getContext('2d');
    c.fillStyle = mode === 'off' ? '#080a09' : '#04120a';
    c.fillRect(0, 0, 256, 192);
    if (mode === 'off') { screenMat.emissiveIntensity = 0; tex.needsUpdate = true; return; }
    const col = mode === 'denied' ? '#ff6a50' : mode === 'granted' ? '#7dffa8' : '#ffc46a';
    c.fillStyle = col;
    c.font = 'bold 26px monospace'; c.fillText('N-1  ACCESS', 18, 42);
    c.font = '22px monospace';
    if (mode === 'ready') { c.fillText('SWIPE BADGE', 18, 100); c.fillText('LEVEL 2', 18, 140); }
    if (mode === 'denied') { c.fillText('ACCESS DENIED', 18, 100); c.fillText('BADGE REQUIRED', 18, 140); }
    if (mode === 'granted') { c.fillText('ACCESS GRANTED', 18, 100); c.fillText('DOOR OPEN', 18, 140); }
    screenMat.emissiveIntensity = 1.1;
    tex.needsUpdate = true;
  };
  draw('off');
  return { draw, ledMat };
}

// junction box on a post between the shed and the door; its cover opens
export function buildJunction(ctx, J, floorY) {
  const g = new THREE.Group();
  g.position.set(J.x, floorY, J.z);
  g.rotation.y = J.rot;
  ctx.group.add(g);
  box(g, 0.1, 1.2, 0.1, RMAT.rust(), 0, 0.6, -0.12);
  box(g, 0.55, 0.62, 0.22, RMAT.olive(), 0, 1.35, 0);
  const coverPivot = new THREE.Group();
  coverPivot.position.set(-0.275, 1.35, 0.115);
  g.add(coverPivot);
  box(coverPivot, 0.55, 0.62, 0.03, RMAT.olive(), 0.275, 0, 0);
  const warn = decal(stencil([['⚡ GEN-2 FEED', 56]], { w: 512, h: 96, color: 'rgba(30,26,18,0.9)', bg: '#c9a42a' }), 0.4, 0.075);
  warn.position.set(0.275, 0.18, 0.02);
  coverPivot.add(warn);
  // the loose wires hanging out
  const wireCols = [0x2b2b2b, 0xe8e4da, 0xe07a2a, 0x3fa55b];
  const wires = wireCols.map((c, i) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), std({ color: c, roughness: 0.6 }));
    w.position.set(-0.12 + i * 0.08, 1.12, 0.06);
    w.rotation.z = (i - 1.5) * 0.25;
    g.add(w);
    return w;
  });
  const ledMat = std({ color: 0x220000, emissive: 0x30ff70, emissiveIntensity: 0 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), ledMat);
  led.position.set(0.2, 1.6, 0.115);
  g.add(led);
  const p = rot2(0, 0, J.rot);
  boxCollider(ctx, J.x + p.x, J.z + p.z, 0.3, 0.2, J.rot);
  return { coverPivot, wires, ledMat };
}

// generator shed: a corrugated roof on posts, a diesel generator with a fuse holder and a pull starter
export function buildShed(ctx, S, floorY) {
  const g = new THREE.Group();
  g.position.set(S.x, floorY, S.z);
  g.rotation.y = S.rot;
  ctx.group.add(g);
  const rust = RMAT.rust(), wood = RMAT.wood();
  for (const [x, z] of [[-1.9, -1.5], [1.9, -1.5], [-1.9, 1.5], [1.9, 1.5]]) box(g, 0.14, 2.4, 0.14, wood, x, 1.2, z);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 3.6), rust);
  roof.position.set(0, 2.45, 0);
  roof.rotation.x = 0.08;
  roof.castShadow = true;
  g.add(roof);
  box(g, 4.0, 1.2, 0.06, wood, 0, 0.6, -1.5); // back wall, half height
  // generator body
  const gen = new THREE.Group();
  gen.position.set(0, 0, -0.4);
  g.add(gen);
  box(gen, 1.6, 0.12, 0.9, RMAT.steel(), 0, 0.06, 0);
  box(gen, 1.4, 0.8, 0.8, RMAT.olive(), 0, 0.52, 0);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.3, 14), RMAT.olive());
  tank.rotation.z = Math.PI / 2;
  tank.position.set(0, 1.05, -0.1);
  gen.add(tank);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), rust);
  exhaust.position.set(0.55, 1.3, -0.3);
  gen.add(exhaust);
  const plate = decal(stencil([['NIGHTJAR · GEN-2', 46], ['MAIN FUSE 40 A', 40]], { w: 512, h: 140 }), 0.6, 0.17);
  plate.position.set(-0.2, 0.75, 0.41);
  gen.add(plate);
  // fuse holder (the fuse appears when installed)
  box(gen, 0.26, 0.2, 0.06, std({ color: 0x1b1b1b, roughness: 0.6 }), 0.45, 0.62, 0.42);
  const fuse = createFuseMesh();
  fuse.position.set(0.45, 0.62, 0.48);
  fuse.rotation.z = Math.PI / 2;
  fuse.visible = false;
  gen.add(fuse);
  const ledMat = std({ color: 0x220000, emissive: 0x30ff70, emissiveIntensity: 0 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), ledMat);
  led.position.set(0.45, 0.82, 0.42);
  gen.add(led);
  // jerry cans and a tool box
  box(g, 0.3, 0.45, 0.18, std({ color: 0x8a1f16, roughness: 0.6 }), -1.4, 0.23, 0.6, 0.3);
  box(g, 0.3, 0.45, 0.18, std({ color: 0x8a1f16, roughness: 0.6 }), -1.45, 0.23, 1.0, -0.2);
  box(g, 0.5, 0.2, 0.24, std({ color: 0x2d4f7a, roughness: 0.5 }), 1.3, 0.1, 0.8, 0.5);
  shadowAll(g);
  // colliders: generator and the two back posts
  const c0 = rot2(0, -0.4, S.rot);
  boxCollider(ctx, S.x + c0.x, S.z + c0.z, 0.8, 0.5, S.rot);
  for (const [lx, lz] of [[-1.9, -1.5], [1.9, -1.5], [-1.9, 1.5], [1.9, 1.5]]) { const p = rot2(lx, lz, S.rot); circleCollider(ctx, S.x + p.x, S.z + p.z, 0.15); }
  const back = rot2(0, -1.5, S.rot);
  boxCollider(ctx, S.x + back.x, S.z + back.z, 2.0, 0.08, S.rot);
  return { gen, fuse, ledMat, exhaustTop: new THREE.Vector3(0.55, 1.75, -0.7) };
}

export function createFuseMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 14), std({ color: 0xd8d0bc, roughness: 0.6 }));
  const capMat = std({ color: 0xb87333, metalness: 0.9, roughness: 0.3 });
  for (const y of [-0.105, 0.105]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14), capMat); c.position.y = y; g.add(c); }
  g.add(body);
  return shadowAll(g);
}

// split NIGHTJAR crate on the slope (it holds the spare fuse)
export function buildCrate(ctx, C, floorY) {
  const g = new THREE.Group();
  g.position.set(C.x, floorY, C.z);
  g.rotation.y = C.rot;
  ctx.group.add(g);
  const wood = RMAT.wood();
  box(g, 1.2, 0.08, 0.8, wood, 0, 0.04, 0);
  box(g, 1.2, 0.6, 0.06, wood, 0, 0.34, -0.37);
  box(g, 0.06, 0.6, 0.8, wood, -0.57, 0.34, 0);
  box(g, 0.06, 0.6, 0.8, wood, 0.57, 0.34, 0);
  const front = box(g, 1.2, 0.6, 0.06, wood, 0.1, 0.18, 0.62, 0.0);
  front.rotation.x = -1.35; // burst open, lying on the ground
  const lid = box(g, 1.25, 0.06, 0.85, wood, -0.9, 0.05, 0.4, 0.5);
  lid.rotation.z = 0.12;
  const label = decal(stencil([['NIGHTJAR', 60], ['N-1 · SPARES', 40], ['ELECTRICAL', 32]], { w: 512, h: 220, color: 'rgba(20,18,14,0.85)' }), 0.7, 0.3);
  label.position.set(0, 0.36, -0.335);
  g.add(label);
  // spilled packing straw
  const straw = new THREE.Mesh(new THREE.CircleGeometry(0.9, 18), std({ color: 0xb59a5a, roughness: 1 }));
  straw.rotation.x = -Math.PI / 2;
  straw.position.set(0.2, 0.02, 0.5);
  g.add(straw);
  shadowAll(g);
  boxCollider(ctx, C.x, C.z, 0.62, 0.42, C.rot);
  const top = new THREE.Vector3(C.x, floorY + 0.12, C.z);
  return { top };
}

// abandoned tarp camp: a tarp on poles, a crate as a table, a field recorder and a portable radio
export function buildTarpCamp(ctx, T, floorY, spots) {
  const g = new THREE.Group();
  g.position.set(T.x, floorY, T.z);
  g.rotation.y = T.rot;
  ctx.group.add(g);
  const wood = RMAT.wood();
  for (const [x, z, h] of [[-1.6, -1.2, 2.0], [1.6, -1.2, 2.0], [-1.6, 1.3, 1.3], [1.6, 1.3, 1.3]]) box(g, 0.08, h, 0.08, wood, x, h / 2, z);
  const tarpGeo = new THREE.PlaneGeometry(3.6, 2.9, 8, 6);
  const p = tarpGeo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(Math.sin(p.getX(i) * 0.9)) * 0.12 - (1 - Math.abs(p.getY(i)) / 1.45) * 0.1);
  tarpGeo.computeVertexNormals();
  const tarp = new THREE.Mesh(tarpGeo, RMAT.tarp());
  tarp.rotation.x = -Math.PI / 2 + 0.25;
  tarp.position.set(0, 1.68, 0.05);
  tarp.castShadow = true;
  g.add(tarp);
  // sleeping mat, a cold fire, cans
  const mat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 1.9), std({ color: 0x2f4f6a, roughness: 0.9 }));
  mat.position.set(-0.9, 0.02, 0.1);
  g.add(mat);
  shadowAll(g);
  // table crate at the recorder, radio on the ground
  const tbl = new THREE.Group();
  tbl.position.set(spots.recorder.x, floorY, spots.recorder.z);
  ctx.group.add(tbl);
  box(tbl, 0.7, 0.5, 0.5, wood, 0, 0.25, 0);
  const rec = new THREE.Group();
  rec.position.set(0, 0.5, 0);
  tbl.add(rec);
  box(rec, 0.26, 0.07, 0.17, std({ color: 0x2a2a2a, roughness: 0.5 }), 0, 0.035, 0);
  for (const x of [-0.06, 0.06]) { const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 14), std({ color: 0x777777, metalness: 0.6, roughness: 0.4 })); reel.position.set(x, 0.075, 0); rec.add(reel); }
  const recLed = std({ color: 0x220000, emissive: 0xff3020, emissiveIntensity: 0.6 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 4), recLed);
  led.position.set(0.11, 0.07, 0.07);
  rec.add(led);
  shadowAll(tbl);
  boxCollider(ctx, spots.recorder.x, spots.recorder.z, 0.35, 0.25);
  const radio = new THREE.Group();
  radio.position.set(spots.radio.x, floorY, spots.radio.z);
  radio.rotation.y = 0.8;
  ctx.group.add(radio);
  box(radio, 0.14, 0.26, 0.07, std({ color: 0x1e2a22, roughness: 0.6 }), 0, 0.13, 0);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 5), std({ color: 0x111111 }));
  ant.position.set(0.04, 0.4, 0);
  radio.add(ant);
  const radioLed = std({ color: 0x002200, emissive: 0x40ff60, emissiveIntensity: 0.8 });
  const rl = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), radioLed);
  rl.position.set(0.04, 0.24, 0.037);
  radio.add(rl);
  // tarp poles
  for (const [lx, lz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.3], [1.6, 1.3]]) { const q = rot2(lx, lz, T.rot); circleCollider(ctx, T.x + q.x, T.z + q.z, 0.12); }
  return { recLed, radioLed, radioPos: new THREE.Vector3(spots.radio.x, floorY + 0.3, spots.radio.z) };
}

// broken restricted-area sign
export function buildSign(ctx, S, floorY) {
  const g = new THREE.Group();
  g.position.set(S.x, floorY, S.z);
  g.rotation.y = S.rot;
  ctx.group.add(g);
  const wood = RMAT.wood();
  box(g, 0.1, 1.7, 0.1, wood, -0.55, 0.85, 0);
  const stub = box(g, 0.1, 0.6, 0.1, wood, 0.55, 0.3, 0);
  stub.rotation.z = 0.15;
  const tex = canvasTex(512, 300, (c) => {
    c.fillStyle = '#d8d2c0'; c.fillRect(0, 0, 512, 300);
    c.fillStyle = '#a3241a'; c.fillRect(0, 0, 512, 70);
    c.fillStyle = '#f4efe2'; c.font = 'bold 50px monospace'; c.fillText('WARNING', 140, 52);
    c.fillStyle = '#1e1a14'; c.font = 'bold 36px monospace';
    c.fillText('RESTRICTED AREA', 70, 130); c.font = '28px monospace'; c.fillText('NIGHTJAR · N-1', 135, 180); c.fillText('NO ENTRY BEYOND', 115, 230); c.fillText('THIS POINT', 165, 270);
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.moveTo(512, 0); c.lineTo(420, 120); c.lineTo(470, 300); c.lineTo(512, 300); c.fill();
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(80,60,30,${Math.random() * 0.3})`; c.fillRect(Math.random() * 512, Math.random() * 300, 4 + Math.random() * 30, 2 + Math.random() * 10); }
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.76), std({ map: tex, transparent: true, side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.5 }));
  board.position.set(0.05, 1.05, 0.06);
  board.rotation.z = -0.32; // hanging from one post
  board.castShadow = true;
  g.add(board);
  const p = rot2(-0.55, 0, S.rot);
  circleCollider(ctx, S.x + p.x, S.z + p.z, 0.12);
}

// a camera on a pole, pointed at the trail; its head can turn to follow the player
export function buildTrailCamera(ctx, C, floorY, lookAt) {
  const g = new THREE.Group();
  g.position.set(C.x, floorY, C.z);
  ctx.group.add(g);
  box(g, 0.1, 3.0, 0.1, RMAT.rust(), 0, 1.5, 0);
  const head = new THREE.Group();
  head.position.set(0, 3.0, 0);
  g.add(head);
  box(head, 0.18, 0.18, 0.42, std({ color: 0xc9c6bd, roughness: 0.6 }), 0, 0, 0.12);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 12), std({ color: 0x0b0b0b, roughness: 0.2, metalness: 0.5 }));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, 0.35);
  head.add(lens);
  const crack = box(head, 0.2, 0.02, 0.44, std({ color: 0x3a3a3a }), 0, 0.1, 0.12);
  crack.rotation.z = 0.2;
  const ledMat = std({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 0 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), ledMat);
  led.position.set(0.06, 0.06, 0.34);
  head.add(led);
  head.lookAt(lookAt.x, floorY + 1.4, lookAt.z);
  head.rotation.z += 0.35; // knocked crooked
  shadowAll(g);
  circleCollider(ctx, C.x, C.z, 0.12);
  return { head, ledMat };
}

export function createBadgeMesh() {
  const tex = canvasTex(256, 160, (c) => {
    c.fillStyle = '#e8e4d8'; c.fillRect(0, 0, 256, 160);
    c.fillStyle = '#2a3a2e'; c.fillRect(0, 0, 256, 34);
    drawSymbol(c, 20, 17, 11, '#e8e4d8');
    c.fillStyle = '#e8e4d8'; c.font = 'bold 20px monospace'; c.fillText('NIGHTJAR', 40, 24);
    c.fillStyle = '#b8b0a0'; c.fillRect(14, 48, 70, 90); // torn-off photo
    c.fillStyle = '#1e1a14'; c.font = 'bold 18px monospace'; c.fillText('N-1', 100, 70); c.fillText('LEVEL 2', 100, 100);
    c.fillStyle = 'rgba(70,50,30,0.5)'; for (let i = 0; i < 30; i++) c.fillRect(Math.random() * 256, 80 + Math.random() * 80, 10 + Math.random() * 30, 4 + Math.random() * 8);
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.004, 0.054), [null, null, std({ map: tex, roughness: 0.5 }), null, null, null].map((x) => x || std({ color: 0xe8e4d8, roughness: 0.5 })));
  m.scale.setScalar(1.6); // a little larger than life, so it can be seen in the mud
  m.castShadow = true;
  return m;
}

export function createPaperMesh() {
  const tex = canvasTex(128, 128, (c) => {
    c.fillStyle = '#cfc2a0'; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#5a4630'; c.lineWidth = 2; c.beginPath(); c.moveTo(10, 100); c.quadraticCurveTo(60, 60, 110, 30); c.stroke();
    c.strokeStyle = '#8a2c1f'; c.lineWidth = 4; c.beginPath(); c.moveTo(60, 20); c.lineTo(80, 40); c.moveTo(80, 20); c.lineTo(60, 40); c.stroke();
    c.fillStyle = 'rgba(60,45,25,0.6)'; for (let i = 0; i < 20; i++) c.fillRect(Math.random() * 128, 70 + Math.random() * 58, 10 + Math.random() * 40, 6 + Math.random() * 10);
  });
  const g = new THREE.PlaneGeometry(0.34, 0.26, 4, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.01);
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, std({ map: tex, roughness: 0.95, side: THREE.DoubleSide }));
}

// lattice mast on the cliff top, carrying the red signal
export function buildMast(ctx, M, baseY) {
  const g = new THREE.Group();
  g.position.set(M.x, baseY, M.z);
  ctx.group.add(g);
  const mat = std({ color: 0x3a3c3e, roughness: 0.6, metalness: 0.5 });
  const H = 12;
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, H, 6), mat);
    leg.position.set(x * 0.6, H / 2, z * 0.6);
    leg.rotation.set(-z * 0.05, 0, x * 0.05);
    g.add(leg);
  }
  for (let y = 1; y < H; y += 1.4) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.6), mat); r.position.y = y; g.add(r); }
  const sigMat = new THREE.SpriteMaterial({ map: softSprite(255, 40, 30), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 1 });
  const sig = new THREE.Sprite(sigMat);
  sig.position.set(0, H + 0.4, 0);
  sig.scale.setScalar(6);
  g.add(sig);
  return { sigMat };
}

// work lamps on poles along the trail: the lights that came on at the end of Part 2
export function buildLamps(ctx, spots, heightAt) {
  const mats = [];
  const poleMat = RMAT.rust();
  const bulbMat = std({ color: 0x302010, emissive: 0xffc27a, emissiveIntensity: 1.6 });
  for (const [x, z] of spots) {
    const y = heightAt(x, z);
    box(ctx.group, 0.07, 2.6, 0.07, poleMat, x, y + 1.3, z);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.16, 10, 1, true), std({ color: 0x2a2a2a, side: THREE.DoubleSide }));
    shade.position.set(x, y + 2.62, z);
    ctx.group.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bulbMat);
    bulb.position.set(x, y + 2.55, z);
    ctx.group.add(bulb);
    const m = new THREE.SpriteMaterial({ map: softSprite(255, 220, 170), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 });
    mats.push(m);
    const s = new THREE.Sprite(m);
    s.position.set(x, y + 2.5, z);
    s.scale.setScalar(2.2);
    ctx.group.add(s);
    circleCollider(ctx, x, z, 0.1);
  }
  return { mats, bulbMat };
}

// a cable lying on the ground along a polyline (tube, sagging a little between points)
export function buildCable(ctx, pts, heightAt, { radius = 0.045, color = 0x151515, lift = 0.05 } = {}) {
  const v = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.8));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = ax + (bx - ax) * t + Math.sin((i * 7 + k) * 0.9) * 0.08, z = az + (bz - az) * t;
      v.push(new THREE.Vector3(x, heightAt(x, z) + lift, z));
    }
  }
  const [lx, lz] = pts[pts.length - 1];
  v.push(new THREE.Vector3(lx, heightAt(lx, lz) + lift, lz));
  const curve = new THREE.CatmullRomCurve3(v);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, v.length * 2, radius, 6, false), std({ color, roughness: 0.55 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ctx.group.add(mesh);
  return mesh;
}
