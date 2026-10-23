// Procedural models for the forest zone. Every builder adds meshes to ctx.group and registers its own colliders.
import * as THREE from 'three';
import { canvasTex, drawSymbol } from '../../items.js';
import { softSprite, shadowAll, stencilTexture } from '../shared.js';
import { mulberry32 } from '../../noise.js';
import { propMaterial } from '../../gfx/materials.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const rot2 = (lx, lz, r) => ({ x: lx * Math.cos(r) + lz * Math.sin(r), z: -lx * Math.sin(r) + lz * Math.cos(r) });

export function boxCollider(ctx, x, z, hw, hd, rot = 0, tag) {
  ctx.colliders.push({ type: 'box', x, z, hw, hd, rot, tag });
}
export function circleCollider(ctx, x, z, r) {
  ctx.colliders.push({ type: 'circle', x, z, r });
}

// --------------------------------------------------------------- shared materials
// textured in object space (gfx/materials.js propMaterial): chipped paint, wood grain, woven canvas
const MAT = {
  olive: () => propMaterial('metal', { color: 0x6a7650, roughness: 0.7, metalness: 0.3 }, 2),
  darkMetal: () => propMaterial('metal', { color: 0x40454a, roughness: 0.5, metalness: 0.6 }, 2.5),
  wood: () => propMaterial('wood', { color: 0x9c7c5a, roughness: 0.92 }),
  canvas: () => propMaterial('cloth', { color: 0x83805e, roughness: 1, side: THREE.DoubleSide }, 2),
};

function plankTexture(base = '#6b5236') {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    const r = mulberry32(3);
    for (let y = 0; y < h; y += 32) {
      c.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.2})`; c.fillRect(0, y, w, 2);
      for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${r() > 0.5 ? '255,230,200' : '0,0,0'},${r() * 0.06})`; c.fillRect(r() * w, y + r() * 30, 30 + r() * 80, 1); }
    }
  });
}

// ============================================================================ TRANSMITTER
function screenTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (mode) => {
    const c = cv.getContext('2d');
    c.fillStyle = mode === 'off' ? '#0b0e0c' : '#06140c';
    c.fillRect(0, 0, 256, 128);
    if (mode === 'off') {
      c.fillStyle = '#1a201c'; c.font = 'bold 20px monospace'; c.fillText('NO POWER', 70, 70);
    } else if (mode === 'static') {
      for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(150,255,190,${Math.random() * 0.35})`; c.fillRect(Math.random() * 256, Math.random() * 128, 2, 2); }
      c.fillStyle = '#5dff9a'; c.font = 'bold 18px monospace'; c.fillText('NO SIGNAL', 14, 30); c.font = '15px monospace'; c.fillText('TUNE ▲▼', 14, 108);
    } else {
      c.fillStyle = mode === 'call' ? '#ffb347' : '#5dff9a';
      c.font = 'bold 18px monospace';
      c.fillText('NIGHTJAR RELAY', 14, 28);
      c.font = '16px monospace';
      c.fillText('FREQ  417.9 MHz', 14, 56);
      c.fillText(mode === 'call' ? 'RX >>> INCOMING' : 'TX  ACTIVE', 14, 82);
      c.fillText(mode === 'dead' ? 'LINK: LOST' : 'LOG  RECOVERED', 14, 108);
    }
    tex.needsUpdate = true;
  };
  draw('off');
  return { tex, draw };
}

export function buildTransmitter(ctx, T, M) {
  const { group, heightAt } = ctx;
  const g = new THREE.Group();
  const metal = MAT.olive();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, 0.75), metal);
  cab.position.y = 0.85;
  g.add(cab);
  const screen = screenTexture();
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), std({ map: screen.tex, emissive: 0xffffff, emissiveMap: screen.tex, emissiveIntensity: 0.0, roughness: 0.3 }));
  scr.position.set(-0.22, 1.25, 0.381);
  g.add(scr);
  // engraved plate with the frequency — the clue for the locker code
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.16), std({
    map: canvasTex(384, 100, (c, w, h) => {
      c.fillStyle = '#b8b39c'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#3a382e'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
      drawSymbol(c, 48, 50, 30, '#3a382e');
      c.fillStyle = '#2a2820'; c.font = 'bold 26px monospace'; c.fillText('RELAY 04', 96, 42);
      c.font = 'bold 22px monospace'; c.fillText('TX · RX · 400–430', 96, 80);
    }), roughness: 0.5, metalness: 0.4,
  }));
  plate.position.set(-0.22, 0.88, 0.381);
  g.add(plate);
  // dials
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14), MAT.darkMetal());
    d.rotation.x = Math.PI / 2;
    d.position.set(0.3, 1.38 - i * 0.18, 0.39);
    g.add(d);
  }
  // power bay: open door and empty slot
  const bay = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.05), std({ color: 0x0c0d0e, roughness: 1 }));
  bay.position.set(0.28, 0.4, 0.36);
  g.add(bay);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.36, 0.025), metal);
  door.geometry.translate(0.22, 0, 0);
  door.position.set(0.5, 0.4, 0.39);
  door.rotation.y = -1.3;
  g.add(door);
  // the cell sits in the bay once installed
  const cellInBay = createPowerCellMesh();
  cellInBay.scale.setScalar(0.8);
  cellInBay.rotation.set(Math.PI / 2, 0, 0);
  cellInBay.position.set(0.28, 0.4, 0.38);
  cellInBay.visible = false;
  g.add(cellInBay);
  // status lamp
  const lampMat = std({ color: 0x1b1b1b, emissive: 0x3cff88, emissiveIntensity: 0 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), lampMat);
  lamp.position.set(0.55, 1.6, 0.38);
  g.add(lamp);
  // dents and a cracked solar panel
  const panel = new THREE.Group();
  const pnl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 1.0), std({
    map: canvasTex(256, 160, (c, w, h) => {
      c.fillStyle = '#16233a'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#4b5c78'; c.lineWidth = 2;
      for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.strokeStyle = '#c9d4e6'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(120, 70); c.lineTo(40, 20); c.moveTo(120, 70); c.lineTo(200, 140); c.moveTo(120, 70); c.lineTo(230, 40); c.moveTo(120, 70); c.lineTo(60, 150); c.stroke();
    }), roughness: 0.25, metalness: 0.5,
  }));
  pnl.rotation.x = -0.6;
  pnl.position.y = 0.9;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9), MAT.darkMetal());
  leg.position.y = 0.45;
  panel.add(pnl, leg);
  panel.position.set(-1.6, 0, -0.6);
  g.add(panel);

  g.position.set(T.x, heightAt(T.x, T.z), T.z);
  g.rotation.y = T.rot;
  group.add(g);
  boxCollider(ctx, T.x, T.z, 0.75, 0.48, T.rot);
  const pw = rot2(-1.6, -0.6, T.rot);
  circleCollider(ctx, T.x + pw.x, T.z + pw.z, 0.6);
  ctx.occluders.push(cab);

  // lattice mast
  const mast = new THREE.Group();
  const mm = MAT.darkMetal();
  const H = 17;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, H, 6), mm);
    l.position.set(Math.cos(a) * 0.45, H / 2, Math.sin(a) * 0.45);
    mast.add(l);
  }
  for (let y = 1.5; y < H; y += 2) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.45 * (1 - y / H * 0.3), 0.03, 4, 3), mm);
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    mast.add(r);
  }
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 4, 5), mm);
  whip.position.y = H + 2;
  mast.add(whip);
  // a broken dish hanging off the mast
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, 0.9), std({ color: 0xbfc3c7, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }));
  dish.position.set(0.5, 9, 0.2);
  dish.rotation.set(1.9, 0.3, 0.6);
  mast.add(dish);
  const baseH = heightAt(M.x, M.z);
  mast.position.set(M.x, baseH, M.z);
  group.add(mast);
  shadowAll(g);
  shadowAll(mast);
  circleCollider(ctx, M.x, M.z, 0.75);

  // cable from cabinet to mast
  const a = new THREE.Vector3(T.x, heightAt(T.x, T.z) + 0.3, T.z);
  const b = new THREE.Vector3(M.x, baseH + 0.4, M.z);
  const mid = a.clone().lerp(b, 0.5);
  mid.y = Math.min(a.y, b.y) - 0.05;
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, mid, b]), 20, 0.035, 5), std({ color: 0x111111, roughness: 0.7 }));
  group.add(cable);

  // red beacon: sprite (seen above the canopy, through fog) + a small local light
  const top = new THREE.Vector3(M.x, baseH + H + 0.3, M.z);
  const redMat = new THREE.SpriteMaterial({ map: softSprite(255, 40, 30), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 });
  const red = new THREE.Sprite(redMat);
  red.position.copy(top);
  red.scale.setScalar(6);
  group.add(red);
  const redLight = new THREE.PointLight(0xff2a1c, 0, 30, 1.5);
  redLight.position.copy(top);
  group.add(redLight);
  // greenish glow when powered
  const glow = new THREE.PointLight(0x7dffb0, 0, 9, 1.6);
  glow.position.set(T.x + Math.sin(T.rot) * 1.1, heightAt(T.x, T.z) + 1.6, T.z + Math.cos(T.rot) * 1.1);
  group.add(glow);

  let redMode = 'blink', powered = false, screenMode = 'off';
  return {
    top,
    // stages: nothing → cell inserted → wired (static on screen) → tuned (on)
    setStage({ cell = false, wired = false, on = false, mode = 'on' }) {
      cellInBay.visible = cell || on;
      door.rotation.y = cell || on ? 0 : -1.3;
      if (on) return this.setPowered(true, mode);
      powered = false;
      screenMode = wired ? 'static' : 'off';
      screen.draw(screenMode);
      scr.material.emissiveIntensity = wired ? 1.1 : 0;
      lampMat.emissive.setHex(0xffb347);
      lampMat.emissiveIntensity = wired ? 2 : 0;
      glow.intensity = 0;
    },
    setPowered(on, mode = 'on') {
      powered = on;
      cellInBay.visible = on;
      door.rotation.y = on ? 0 : -1.3;
      screenMode = on ? mode : 'off';
      lampMat.emissive.setHex(mode === 'call' ? 0xffb347 : 0x3cff88);
      screen.draw(screenMode);
      scr.material.emissiveIntensity = on ? 1.4 : 0;
      lampMat.emissiveIntensity = on ? 3 : 0;
      glow.intensity = on ? 2.2 : 0;
    },
    setScreen(mode) { if (powered && mode !== screenMode) { screenMode = mode; screen.draw(mode); lampMat.emissive.setHex(mode === 'call' ? 0xffb347 : 0x3cff88); } },
    setRed(mode) { redMode = mode; },
    update(dt, t, viewer) {
      if (redMode === 'off') { redMat.opacity = 0; redLight.intensity = 0; return; }
      const on = (t % 1.8) < 0.4;
      const d = viewer ? viewer.distanceTo(top) : 100;
      // the signal is easier to see the closer you are
      const near = THREE.MathUtils.clamp(1 - d / 170, 0.25, 1);
      const target = on ? near : 0.05;
      redMat.opacity += (target - redMat.opacity) * Math.min(1, dt * 14);
      red.scale.setScalar(4 + near * 8);
      redLight.intensity = on ? 9 : 0.4;
      if (powered) lampMat.emissiveIntensity = (t % 0.9) < 0.45 ? 3 : 1.2;
    },
  };
}

// ============================================================================ POWER CELL + SUPPLY DROP
export function createPowerCellMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.24), std({ color: 0xd9a400, roughness: 0.55, metalness: 0.2 }));
  body.position.y = 0.11;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.07, 0.25), std({ color: 0x1b1b1b, roughness: 0.6 }));
  band.position.y = 0.11;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI), std({ color: 0x222222, roughness: 0.5 }));
  handle.position.y = 0.22;
  const term1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 8), std({ color: 0xb87333, metalness: 0.9, roughness: 0.3 }));
  term1.position.set(0.12, 0.24, 0.06);
  const term2 = term1.clone();
  term2.position.x = -0.12;
  const symTex = canvasTex(128, 64, (c) => { c.fillStyle = '#1b1b1b'; c.fillRect(0, 0, 128, 64); drawSymbol(c, 32, 32, 22, '#d9a400'); c.fillStyle = '#d9a400'; c.font = 'bold 20px monospace'; c.fillText('48V', 66, 40); });
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), std({ map: symTex, roughness: 0.6 }));
  lbl.position.set(0, 0.11, 0.126);
  g.add(body, band, handle, term1, term2, lbl);
  return shadowAll(g);
}

export function buildSupplyDrop(ctx, P) {
  const { group, heightAt } = ctx;
  const y = heightAt(P.x, P.z);
  const crate = new THREE.Group();
  const stencil = stencilTexture('SUPPLY · NJ');
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.0), propMaterial('metal', { color: 0x6c7852, roughness: 0.75, metalness: 0.25 }, 2));
  box.position.y = 0.45;
  const sten = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.3), std({ map: stencil, transparent: true, roughness: 0.8 }));
  sten.position.set(0, 0.5, 0.505);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.0), propMaterial('metal', { color: 0x5e6948, roughness: 0.75, metalness: 0.25 }, 2));
  const hasp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.03), std({ color: 0x8a8f96, metalness: 0.8, roughness: 0.3 }));
  hasp.position.set(0, 0.82, 0.515);
  const lock = new THREE.Group();
  const lbody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.07), std({ color: 0x2b2f33, metalness: 0.7, roughness: 0.35 }));
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), std({ color: 0xb8bec4, metalness: 0.9, roughness: 0.25 }));
  shackle.position.y = 0.08;
  lock.add(lbody, shackle);
  for (let i = 0; i < 3; i++) {
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10), std({ color: 0xc9a663, metalness: 0.6, roughness: 0.4 }));
    dial.rotation.x = Math.PI / 2;
    dial.position.set(-0.055 + i * 0.055, -0.01, 0.04);
    lock.add(dial);
  }
  lock.position.set(0, 0.7, 0.55);
  crate.add(box, sten, lid, hasp, lock);
  const setOpen = (open) => {
    if (open) { lid.position.set(1.0, 0.35, 0.3); lid.rotation.set(0.2, 0.4, 1.1); lock.position.set(0.5, 0.04, 0.8); lock.rotation.set(Math.PI / 2, 0, 0.6); }
    else { lid.position.set(0, 0.94, 0); lid.rotation.set(0, 0, 0); lock.position.set(0, 0.7, 0.55); lock.rotation.set(0, 0, 0); }
  };
  setOpen(false);
  crate.position.set(P.x, y, P.z);
  crate.rotation.y = 0.6;
  group.add(shadowAll(crate));
  boxCollider(ctx, P.x, P.z, 0.75, 0.55, 0.6);
  // parachute caught in a tree, draped down
  const chute = new THREE.PlaneGeometry(5, 4, 12, 10);
  const p = chute.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), yy = p.getY(i);
    p.setZ(i, Math.sin(x * 1.4) * 0.35 + Math.cos(yy * 1.7 + x) * 0.25);
  }
  chute.computeVertexNormals();
  const cm = new THREE.Mesh(chute, std({ color: 0xc8c3b4, roughness: 0.95, side: THREE.DoubleSide }));
  cm.position.set(P.x - 2.2, y + 4.6, P.z - 2.6);
  cm.rotation.set(-0.5, 0.9, 0.2);
  cm.castShadow = true;
  group.add(cm);
  // ropes
  const ropeMat = new THREE.LineBasicMaterial({ color: 0x9c9384 });
  for (let i = 0; i < 4; i++) {
    const pts = [new THREE.Vector3(P.x - 2.2 + (i - 1.5) * 0.9, y + 2.8, P.z - 2.0), new THREE.Vector3(P.x, y + 0.9, P.z)];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ropeMat));
  }
  return { setOpen, top: new THREE.Vector3(P.x, y + 0.9, P.z) };
}

// A tree with a symbol carved into the bark, facing the trail. Notches under the symbol give its order.
export function buildCarvedTree(ctx, C, glyphPath) {
  const { group, heightAt } = ctx;
  const y = heightAt(C.tree.x, C.tree.z);
  const g = new THREE.Group();
  const bark = propMaterial('bark', { color: 0x9c8468, roughness: 1 }, 1.2);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 7, 10), bark);
  trunk.position.y = 3.5;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), std({ color: 0x3a5a22, roughness: 0.9, flatShading: true }));
  crown.position.y = 7.4;
  crown.scale.set(1, 0.75, 1);
  g.add(trunk, crown);
  const tex = canvasTex(128, 192, (c) => {
    c.fillStyle = '#6b5236'; c.fillRect(0, 0, 128, 192);
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(30,20,10,0.25)'; c.fillRect(Math.random() * 128, 0, 2, 192); }
    c.fillStyle = '#c9ab7e'; c.beginPath(); c.ellipse(64, 80, 50, 70, 0, 0, 7); c.fill(); // stripped bark
    c.strokeStyle = '#3a2a18'; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round';
    c.save(); c.translate(64, 62); c.scale(2.0, 2.0); c.translate(-20, -20); c.stroke(new Path2D(glyphPath)); c.restore();
    for (let i = 0; i < C.notches; i++) { c.beginPath(); c.moveTo(44 + i * 20, 118); c.lineTo(44 + i * 20, 140); c.stroke(); }
  });
  const carving = new THREE.Mesh(new THREE.CylinderGeometry(0.418, 0.444, 1.4, 12, 1, true, -0.65, 1.3), std({ map: tex, roughness: 1 }));
  carving.position.y = 1.55;
  // face the trail
  carving.rotation.y = Math.atan2(C.look.x - C.tree.x, C.look.z - C.tree.z) - Math.PI / 2 + Math.PI / 2;
  g.add(carving);
  g.position.set(C.tree.x, y - 0.2, C.tree.z);
  group.add(shadowAll(g));
  circleCollider(ctx, C.tree.x, C.tree.z, 0.5);
}

// spotting scope on a tripod at the camp edge (look through it with E)
export function buildCampScope(ctx, S) {
  const { group, heightAt } = ctx;
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 5), MAT.darkMetal());
    l.position.set(Math.cos(a) * 0.2, 0.62, Math.sin(a) * 0.2);
    l.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    g.add(l);
  }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.48, 12), std({ color: 0x3b4a3a, roughness: 0.5, metalness: 0.4 }));
  tube.rotation.z = Math.PI / 2;
  tube.position.y = 1.32;
  g.add(tube);
  g.position.set(S.x, heightAt(S.x, S.z), S.z);
  g.rotation.y = S.yaw || 0;
  group.add(shadowAll(g));
  circleCollider(ctx, S.x, S.z, 0.3);
}

// ============================================================================ CAMP
function tornAlpha() {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#000';
    c.beginPath();
    c.moveTo(150, 30); c.lineTo(190, 80); c.lineTo(170, 120); c.lineTo(210, 170); c.lineTo(160, 160); c.lineTo(140, 100); c.lineTo(120, 60);
    c.closePath(); c.fill();
    c.beginPath(); c.moveTo(40, 200); c.lineTo(70, 230); c.lineTo(50, 250); c.closePath(); c.fill();
  });
}

export function buildTent(ctx, P) {
  const { group, heightAt } = ctx;
  const g = new THREE.Group();
  const cloth = propMaterial('cloth', { color: 0x76805a, roughness: 1, side: THREE.DoubleSide }, 2);
  const torn = propMaterial('cloth', { color: 0x76805a, roughness: 1, side: THREE.DoubleSide, alphaMap: tornAlpha(), alphaTest: 0.5 }, 2);
  const L = 3.4, Hh = 1.7, Wh = 1.3;
  const slope = Math.hypot(Wh, Hh);
  for (const side of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(slope, L, 6, 8);
    const pp = geo.attributes.position;
    for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin(pp.getY(i) * 1.6) * 0.06 + (side > 0 ? Math.max(0, 0.4 - Math.abs(pp.getY(i))) * 0.35 : 0));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, side > 0 ? torn : cloth);
    m.rotation.order = 'YXZ';
    m.rotation.x = -Math.PI / 2;
    m.rotation.y = side * (Math.PI / 2 - Math.atan2(Hh, Wh));
    m.position.set(side * Wh / 2, Hh / 2, 0);
    g.add(m);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, L + 0.4, 6), MAT.darkMetal());
  pole.rotation.x = Math.PI / 2;
  pole.position.y = Hh;
  g.add(pole);
  for (const z of [-L / 2, L / 2]) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, Hh, 6), MAT.darkMetal());
    v.position.set(0, Hh / 2, z);
    g.add(v);
  }
  // inside: sleeping bag + a single boot
  const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.4, 4, 12), propMaterial('cloth', { color: 0x3c5c75, roughness: 0.95 }, 4));
  bag.rotation.x = Math.PI / 2;
  bag.scale.set(1, 1, 0.45);
  bag.position.set(-0.2, 0.13, -0.2);
  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.3), std({ color: 0x2a2018, roughness: 0.9 }));
  boot.position.set(0.5, 0.09, 1.1);
  boot.rotation.y = 0.5;
  g.add(bag, boot);
  g.position.set(P.x, heightAt(P.x, P.z), P.z);
  g.rotation.y = P.rot;
  group.add(shadowAll(g));
  boxCollider(ctx, P.x, P.z, 1.35, 1.75, P.rot);
}

export function buildCabin(ctx, P, mapTexture) {
  const { group, heightAt } = ctx;
  const W = 5, D = 4, H = 2.5, t = 0.14, door = 1.3;
  const corners = [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]].map(([lx, lz]) => { const o = rot2(lx, lz, P.rot); return heightAt(P.x + o.x, P.z + o.z); });
  const floorY = Math.max(...corners) + 0.08;
  const g = new THREE.Group();
  const plank = plankTexture();
  plank.wrapS = plank.wrapT = THREE.RepeatWrapping;
  plank.repeat.set(2, 1);
  void plank;
  const wallMat = propMaterial('wood', { color: 0xa68560, roughness: 0.95, side: THREE.DoubleSide }, 1.2);
  const floorMat = propMaterial('wood', { color: 0x7a6248, roughness: 1 }, 1.4);
  const occl = [];
  const wall = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, y, z);
    g.add(m);
    occl.push(m);
    return m;
  };
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.6, D), floorMat);
  floor.position.y = -0.3;
  g.add(floor);
  wall(W, H, t, 0, H / 2, -D / 2);
  wall(t, H, D, -W / 2, H / 2, 0);
  wall(t, H, D, W / 2, H / 2, 0);
  const side = (W - door) / 2;
  wall(side, H, t, -W / 2 + side / 2, H / 2, D / 2);
  wall(side, H, t, W / 2 - side / 2, H / 2, D / 2);
  wall(door, 0.45, t, 0, H - 0.225, D / 2);
  // window with dirty glass on the right wall
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), std({ color: 0x1a2228, emissive: 0xffc070, emissiveIntensity: 0.0, roughness: 0.2, transparent: true, opacity: 0.85 }));
  win.position.set(W / 2 + 0.08, 1.5, -0.5);
  win.rotation.y = Math.PI / 2;
  g.add(win);
  // roof
  const roofMat = propMaterial('metal', { color: 0x6d675c, roughness: 0.75, metalness: 0.35, side: THREE.DoubleSide }, 1.5);
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.08, D / 2 + 0.6), roofMat);
    r.position.set(0, H + 0.38, s * (D / 4 + 0.05));
    r.rotation.x = s * 0.36;
    g.add(r);
    occl.push(r);
  }
  // open door
  const dr = new THREE.Mesh(new THREE.BoxGeometry(door - 0.05, H - 0.5, 0.05), wallMat);
  dr.geometry.translate((door - 0.05) / 2, 0, 0);
  dr.position.set(-door / 2, (H - 0.5) / 2, D / 2 + 0.05);
  dr.rotation.y = 1.9;
  g.add(dr);
  // furniture
  const wood = MAT.wood();
  const desk = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.7), wood);
  top.position.y = 0.76;
  desk.add(top);
  for (const [x, z] of [[-0.62, -0.3], [0.62, -0.3], [-0.62, 0.3], [0.62, 0.3]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.76, 0.06), wood);
    l.position.set(x, 0.38, z);
    desk.add(l);
  }
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10), std({ color: 0xe8e2d0, roughness: 0.6 }));
  mug.position.set(0.4, 0.84, 0.1);
  const papers = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), std({ color: 0xe9e2cf, roughness: 0.9 }));
  papers.rotation.x = -Math.PI / 2;
  papers.position.set(-0.2, 0.795, 0);
  desk.add(mug, papers);
  desk.position.set(-1.45, 0, -1.4);
  g.add(desk);
  const chair = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), wood);
  chair.position.set(-1.2, 0.22, -0.7);
  chair.rotation.z = 1.4; // knocked over
  g.add(chair);
  const shelf = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 1.4), wood);
    s.position.y = 0.5 + i * 0.55;
    shelf.add(s);
    for (let j = 0; j < 4; j++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10), std({ color: [0x7b6a4a, 0x5a6b4a, 0x6a5a3a][(i + j) % 3], roughness: 0.3, transparent: true, opacity: 0.85 }));
      jar.position.set(0, 0.6 + i * 0.55, -0.5 + j * 0.33);
      shelf.add(jar);
    }
  }
  shelf.position.set(W / 2 - 0.3, 0, 0.6);
  g.add(shelf);
  // wall calendar (September), two days circled
  const calTex = canvasTex(200, 240, (c) => {
    c.fillStyle = '#f1ece0'; c.fillRect(0, 0, 200, 240);
    c.fillStyle = '#8a2c1f'; c.fillRect(0, 0, 200, 40);
    c.fillStyle = '#fff'; c.font = 'bold 22px monospace'; c.fillText('SEPTEMBER', 36, 28);
    c.fillStyle = '#333'; c.font = '14px monospace';
    for (let d = 1; d <= 30; d++) { const i = d + 1; c.fillText(String(d), 10 + (i % 7) * 27, 66 + Math.floor(i / 7) * 34); }
    c.strokeStyle = '#c0392b'; c.lineWidth = 3;
    const ring = (d) => { const i = d + 1; c.beginPath(); c.ellipse(16 + (i % 7) * 27, 61 + Math.floor(i / 7) * 34, 15, 13, 0, 0, 7); c.stroke(); };
    ring(14); ring(23);
    c.fillStyle = '#c0392b'; c.font = 'bold 10px monospace';
    c.fillText('APPROVED', 2, 66 + Math.floor(15 / 7) * 34 + 14);
    c.fillText('ARRIVAL', 110, 66 + Math.floor(24 / 7) * 34 + 14);
  });
  const calendar = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.66), std({ map: calTex, roughness: 0.9 }));
  calendar.position.set(-W / 2 + 0.09, 1.5, -0.7);
  calendar.rotation.y = Math.PI / 2;
  g.add(calendar);
  // the hand-drawn map pinned to the back wall
  const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), std({ map: mapTexture, roughness: 0.9 }));
  mapMesh.position.set(0.7, 1.45, -D / 2 + 0.08);
  g.add(mapMesh);
  // hanging bulb
  const bulbMat = std({ color: 0x333333, emissive: 0xffc070, emissiveIntensity: 2 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bulbMat);
  bulb.position.set(0, H - 0.35, -0.3);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3), std({ color: 0x111111 }));
  wire.position.set(0, H - 0.17, -0.3);
  g.add(bulb, wire);
  const light = new THREE.PointLight(0xffb866, 3, 7, 1.6);
  light.position.copy(bulb.position);
  g.add(light);

  g.position.set(P.x, floorY, P.z);
  g.rotation.y = P.rot;
  group.add(shadowAll(g));
  ctx.occluders.push(...occl);

  // colliders for each wall (door gap stays open)
  const wallBox = (lx, lz, hw, hd) => { const o = rot2(lx, lz, P.rot); boxCollider(ctx, P.x + o.x, P.z + o.z, hw, hd, P.rot, 'cabin'); };
  wallBox(0, -D / 2, W / 2 + 0.05, 0.12);
  wallBox(-W / 2, 0, 0.12, D / 2 + 0.05);
  wallBox(W / 2, 0, 0.12, D / 2 + 0.05);
  wallBox(-W / 2 + side / 2, D / 2, side / 2, 0.12);
  wallBox(W / 2 - side / 2, D / 2, side / 2, 0.12);
  wallBox(-1.45, -1.4, 0.72, 0.38); // desk
  wallBox(W / 2 - 0.3, 0.6, 0.22, 0.72); // shelf

  const toWorld = (lx, lz) => { const o = rot2(lx, lz, P.rot); return { x: P.x + o.x, z: P.z + o.z }; };
  return {
    floorY,
    inside(x, z) {
      const dx = x - P.x, dz = z - P.z;
      const lx = dx * Math.cos(P.rot) - dz * Math.sin(P.rot);
      const lz = dx * Math.sin(P.rot) + dz * Math.cos(P.rot);
      return Math.abs(lx) < W / 2 + 0.05 && lz > -D / 2 - 0.05 && lz < D / 2 + 0.35;
    },
    spots: { map: toWorld(0.7, -D / 2 + 0.95), calendar: toWorld(-W / 2 + 0.95, -0.7), desk: toWorld(-1.45, -0.75), shelf: toWorld(W / 2 - 0.9, 0.6), door: toWorld(0, D / 2 + 1.2) },
    light, bulbMat, win,
  };
}

function docTexture(lines, opts = {}) {
  return canvasTex(256, 340, (c, w, h) => {
    c.fillStyle = opts.bg || '#ece5d2'; c.fillRect(0, 0, w, h);
    if (opts.symbol) drawSymbol(c, 34, 36, 18, '#333');
    c.fillStyle = '#222';
    c.font = 'bold 16px monospace';
    c.fillText(opts.head || '', opts.symbol ? 62 : 16, 42);
    c.font = '13px monospace';
    lines.forEach((l, i) => c.fillText(l, 16, 80 + i * 20));
    for (let i = 0; i < (opts.redact || 0); i++) { c.fillStyle = '#111'; c.fillRect(16, 230 + i * 14, 80 + (i * 53) % 140, 8); }
  });
}

export function buildTable(ctx, P) {
  const { group, heightAt } = ctx;
  const g = new THREE.Group();
  const wood = MAT.wood();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.9), wood);
  top.position.y = 0.78;
  g.add(top);
  for (const [x, z] of [[-0.78, -0.38], [0.78, -0.38], [-0.78, 0.38], [0.78, 0.38]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.06), wood);
    l.position.set(x, 0.39, z);
    g.add(l);
  }
  // tarp roof on poles
  const tarp = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4, 6, 4), MAT.canvas());
  const tp = tarp.geometry.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setZ(i, -Math.abs(Math.sin(tp.getX(i) * 0.9)) * 0.15);
  tarp.geometry.computeVertexNormals();
  tarp.rotation.x = -Math.PI / 2 + 0.18;
  tarp.position.y = 2.25;
  g.add(tarp);
  for (const [x, z] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3 + z * 0.18, 6), MAT.darkMetal());
    p.position.set(x, (2.3 + z * 0.18) / 2, z);
    g.add(p);
  }
  // papers and photos
  const docs = [
    { tex: docTexture(['DAY 38', 'water samples', 'normal', '', 'perimeter: ok'], { head: 'FIELD NOTES' }), x: -0.45, z: 0.05, r: 0.2 },
    { tex: docTexture(['SUBJECT INTAKE', 'see protocol 3', '', 'DO NOT DISCUSS', 'ON OPEN CHANNELS'], { head: 'MEMO', symbol: true, redact: 4 }), x: 0.05, z: -0.12, r: -0.15 },
  ];
  for (const d of docs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.34), std({ map: d.tex, roughness: 0.9 }));
    m.rotation.set(-Math.PI / 2, 0, d.r);
    m.position.set(d.x, 0.812, d.z);
    g.add(m);
  }
  const photoTex = canvasTex(160, 120, (c) => {
    c.fillStyle = '#f2ecdc'; c.fillRect(0, 0, 160, 120);
    c.fillStyle = '#9c8662'; c.fillRect(8, 8, 144, 104);
    c.fillStyle = '#5b4c36'; c.beginPath(); c.moveTo(8, 70); c.lineTo(50, 46); c.lineTo(90, 30); c.lineTo(152, 60); c.lineTo(152, 112); c.lineTo(8, 112); c.fill();
    c.fillStyle = '#2b2925'; c.fillRect(104, 66, 14, 34); c.beginPath(); c.arc(111, 62, 6, 0, 7); c.fill();
  });
  const photos = [];
  for (let i = 0; i < 3; i++) {
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.11), std({ map: photoTex, roughness: 0.5 }));
    ph.rotation.set(-Math.PI / 2, 0, 0.4 - i * 0.35);
    ph.position.set(0.42 + i * 0.07, 0.814 + i * 0.001, 0.1 - i * 0.08);
    g.add(ph);
    photos.push(ph);
  }
  // handheld radio
  const radio = new THREE.Group();
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.05), std({ color: 0x1d1f1c, roughness: 0.6 }));
  rb.position.y = 0.1;
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.16), std({ color: 0x111111 }));
  ant.position.set(0.025, 0.28, 0);
  const radioLedMat = std({ color: 0x220000, emissive: 0xff3b30, emissiveIntensity: 0 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), radioLedMat);
  led.position.set(-0.02, 0.18, 0.027);
  radio.add(rb, ant, led);
  radio.position.set(0.65, 0.81, -0.25);
  radio.rotation.z = -0.05;
  g.add(radio);
  // lantern
  const lantern = new THREE.Group();
  const lbase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.05, 12), MAT.darkMetal());
  const glassMat = std({ color: 0x333333, emissive: 0xffb45c, emissiveIntensity: 1.5, transparent: true, opacity: 0.9 });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 12), glassMat);
  glass.position.y = 0.11;
  const lcap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.06, 12), MAT.darkMetal());
  lcap.position.y = 0.22;
  lantern.add(lbase, glass, lcap);
  lantern.position.set(-0.7, 0.81, -0.3);
  g.add(lantern);
  const lanternGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(255, 180, 90), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
  lanternGlow.scale.setScalar(1.2);
  lanternGlow.position.set(-0.7, 0.93, -0.3);
  g.add(lanternGlow);

  g.position.set(P.x, heightAt(P.x, P.z), P.z);
  g.rotation.y = P.rot;
  group.add(shadowAll(g));
  boxCollider(ctx, P.x, P.z, 0.9, 0.5, P.rot);
  for (const [x, z] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]]) {
    const o = rot2(x, z, P.rot);
    circleCollider(ctx, P.x + o.x, P.z + o.z, 0.08);
  }
  return { radioLedMat, glassMat, lanternGlow, photos, radioPos: (() => { const o = rot2(0.65, -0.25, P.rot); return new THREE.Vector3(P.x + o.x, heightAt(P.x, P.z) + 0.9, P.z + o.z); })() };
}

export function buildCampProps(ctx, L) {
  const { group, heightAt } = ctx;
  const sten = stencilTexture('NJ · FIELD 04');
  const crateMat = propMaterial('metal', { color: 0x6c7852, roughness: 0.75, metalness: 0.25 }, 2);
  const stenMat = std({ map: sten, transparent: true, roughness: 0.8 });
  const crates = [[0, 0, 0, 0.2], [1.25, 0.2, 0, -0.1], [0.6, 0.1, 0.9, 0.35], [-1.0, 1.4, 0, 0.6]];
  for (const [dx, dz, dy, r] of crates) {
    const c = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.8), crateMat);
    b.position.y = 0.425;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), stenMat);
    s.position.set(0, 0.45, 0.405);
    c.add(b, s);
    const x = L.crates.x + dx, z = L.crates.z + dz;
    c.position.set(x, heightAt(x, z) + dy, z);
    c.rotation.y = r;
    group.add(shadowAll(c));
    if (dy === 0) boxCollider(ctx, x, z, 0.58, 0.43, r);
  }
  // barrels
  const barrelMat = std({ color: 0x5e2e22, roughness: 0.6, metalness: 0.4 });
  [[L.generator.x - 1.6, L.generator.z + 1.3, 0], [L.generator.x - 2.3, L.generator.z + 0.6, 0], [L.generator.x - 1.2, L.generator.z + 2.4, 1.45]].forEach(([x, z, tip]) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14), barrelMat);
    b.position.set(x, heightAt(x, z) + (tip ? 0.3 : 0.45), z);
    b.rotation.z = tip;
    b.castShadow = true; b.receiveShadow = true;
    group.add(b);
    circleCollider(ctx, x, z, tip ? 0.5 : 0.32);
  });
  // stripped generator
  const gen = new THREE.Group();
  const gb = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.8), std({ color: 0x8c6d1f, roughness: 0.7, metalness: 0.3 }));
  gb.position.y = 0.45;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.9), MAT.darkMetal());
  frame.position.y = 0.05;
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.5), std({ color: 0x8c6d1f, roughness: 0.7 }));
  cover.position.set(1.0, 0.03, 0.4);
  cover.rotation.y = 0.6;
  gen.add(gb, frame, cover);
  gen.position.set(L.generator.x, heightAt(L.generator.x, L.generator.z), L.generator.z);
  gen.rotation.y = -0.4;
  group.add(shadowAll(gen));
  boxCollider(ctx, L.generator.x, L.generator.z, 0.72, 0.48, -0.4);
  // dish on tripod, aimed at the sea
  const dish = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 8, 0, Math.PI * 2, 0, 0.85), std({ color: 0xd2d4d6, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }));
  bowl.rotation.x = 2.1;
  bowl.position.y = 1.6;
  dish.add(bowl);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 5), MAT.darkMetal());
    l.position.set(Math.cos(a) * 0.35, 0.8, Math.sin(a) * 0.35);
    l.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    dish.add(l);
  }
  dish.position.set(L.dish.x, heightAt(L.dish.x, L.dish.z), L.dish.z);
  group.add(shadowAll(dish));
  circleCollider(ctx, L.dish.x, L.dish.z, 0.6);
}

// string of bulbs between two points, flickering together
export function buildStringLights(ctx, a, b, n = 9) {
  const { group } = ctx;
  const mat = std({ color: 0x222222, emissive: 0xffc27a, emissiveIntensity: 1.6 });
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * 0.5;
    pts.push(p);
  }
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x111111 })));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * 0.5 + 0.05;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat);
    bulb.position.copy(p);
    group.add(bulb);
  }
  return mat;
}

export function buildLocker(ctx, P) {
  const { group, heightAt } = ctx;
  const g = new THREE.Group();
  const metal = std({ color: 0x3f4a3a, roughness: 0.6, metalness: 0.55 });
  const W = 1.0, D = 0.55, Hb = 0.42;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, Hb, D), metal);
  base.position.y = Hb / 2;
  g.add(base);
  const inside = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.02, D - 0.06), std({ color: 0x15130f, roughness: 1 }));
  inside.position.y = Hb - 0.02;
  g.add(inside);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, Hb, -D / 2);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, D), metal);
  lid.position.set(0, 0.05, D / 2);
  lidPivot.add(lid);
  g.add(lidPivot);
  const keypadTex = canvasTex(160, 160, (c) => {
    c.fillStyle = '#202322'; c.fillRect(0, 0, 160, 160);
    c.fillStyle = '#3d6b4c'; c.fillRect(14, 12, 132, 30);
    c.fillStyle = '#9fd3b0'; c.font = 'bold 20px monospace'; c.fillText('_ _ _ _', 34, 34);
    c.fillStyle = '#55595a'; c.font = 'bold 18px monospace';
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].forEach((k, i) => {
      const x = 22 + (i % 3) * 44, y = 52 + Math.floor(i / 3) * 26;
      c.fillRect(x, y, 32, 20); c.fillStyle = '#d8d8d0'; c.fillText(k, x + 10, y + 16); c.fillStyle = '#55595a';
    });
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), std({ map: keypadTex, roughness: 0.5 }));
  pad.position.set(0.25, Hb * 0.55, D / 2 + 0.003);
  g.add(pad);
  const sten = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), std({
    map: canvasTex(320, 80, (c) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, 320, 80); c.fillStyle = 'rgba(230,225,200,0.85)'; c.font = 'bold 26px monospace'; c.font = 'bold 22px monospace'; c.fillText('ACCESS: APPROVAL / ARRIVAL', 4, 50); }),
    transparent: true, roughness: 0.7,
  }));
  sten.position.set(-0.2, Hb * 0.6, D / 2 + 0.003);
  g.add(sten);
  const ledMat = std({ color: 0x220000, emissive: 0xff3020, emissiveIntensity: 2 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), ledMat);
  led.position.set(0.38, Hb * 0.85, D / 2 + 0.01);
  g.add(led);
  // documents that sit inside
  const docA = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38), std({ map: docTexture(['PHASE 3 PROTOCOL', '02 AUG', '', 'subjects: unaware', 'entry: unscheduled', '      descent'], { head: 'NIGHTJAR', symbol: true, redact: 3 }), roughness: 0.9 }));
  docA.rotation.set(-Math.PI / 2, 0, 0.1);
  docA.position.set(-0.2, Hb - 0.005, 0);
  const docB = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38), std({ map: docTexture(['OBSERVER: E. RIDGE', 'night shift', '', 'report all', 'movement at LZ-2', '', '23/9 02:41 contact'], { head: 'ROSTER', bg: '#e2d8bd' }), roughness: 0.9 }));
  docB.rotation.set(-Math.PI / 2, 0, -0.15);
  docB.position.set(0.22, Hb - 0.003, 0.02);
  g.add(docA, docB);
  g.position.set(P.x, heightAt(P.x, P.z), P.z);
  g.rotation.y = P.rot;
  group.add(shadowAll(g));
  boxCollider(ctx, P.x, P.z, W / 2 + 0.05, D / 2 + 0.05, P.rot);
  return { lidPivot, ledMat, docA, docB };
}

// ============================================================================ OBSERVATION POST
export function buildPost(ctx, P, S, R) {
  const { group, heightAt } = ctx;
  const y = heightAt(P.x, P.z);
  const g = new THREE.Group();
  const poleMat = MAT.wood();
  const corners = [[-1.6, -1.3], [1.6, -1.3], [-1.6, 1.3], [1.6, 1.3]];
  for (const [x, z] of corners) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.2, 6), poleMat);
    p.position.set(x, 1.1, z);
    g.add(p);
  }
  const netTex = canvasTex(256, 256, (c, w, h) => {
    const r = mulberry32(9);
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = ['#3d4a2a', '#4f5a33', '#2d3622', '#5a4a30'][i % 4];
      c.beginPath(); c.ellipse(r() * w, r() * h, 6 + r() * 10, 3 + r() * 6, r() * 3, 0, 7); c.fill();
    }
  });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.2, 8, 6), std({ map: netTex, alphaMap: netTex, alphaTest: 0.08, side: THREE.DoubleSide, roughness: 1 }));
  const np = net.geometry.attributes.position;
  for (let i = 0; i < np.count; i++) np.setZ(i, -Math.abs(Math.sin(np.getX(i) * 0.8)) * 0.2 + Math.sin(np.getY(i) * 2) * 0.05);
  net.geometry.computeVertexNormals();
  net.rotation.x = -Math.PI / 2;
  net.position.y = 2.15;
  g.add(net);
  // side drapes
  const drape = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7), net.material);
  drape.position.set(0, 1.3, -1.32);
  g.add(drape);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.4), poleMat);
  bench.position.set(-0.6, 0.45, 0.2);
  g.add(bench);
  for (const x of [-1.15, -0.05]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.35), poleMat);
    l.position.set(x, 0.22, 0.2);
    g.add(l);
  }
  // tins and a blanket
  for (let i = 0; i < 4; i++) {
    const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), std({ color: 0x9aa3a8, roughness: 0.35, metalness: 0.8 }));
    tin.position.set(0.5 + i * 0.13, 0.05, -0.6 + (i % 2) * 0.12);
    if (i === 3) { tin.rotation.z = Math.PI / 2; tin.position.y = 0.05; }
    g.add(tin);
  }
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.6), propMaterial('cloth', { color: 0x6a4a3a, roughness: 1 }, 4));
  blanket.position.set(0.9, 0.03, 0.6);
  blanket.rotation.y = 0.4;
  g.add(blanket);
  // board for the route chart
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.04), propMaterial('wood', { color: 0x8a7050, roughness: 1 }));
  board.position.set(-1.35, 1.3, -1.15);
  board.rotation.y = 0.5;
  g.add(board);
  g.position.set(P.x, y, P.z);
  group.add(shadowAll(g));
  for (const [x, z] of corners) circleCollider(ctx, P.x + x, P.z + z, 0.12);
  boxCollider(ctx, P.x - 0.6, P.z + 0.2, 0.72, 0.22, 0);

  // spotting scope on tripod, pointing south toward the beach
  const scope = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.25, 5), MAT.darkMetal());
    l.position.set(Math.cos(a) * 0.2, 0.6, Math.sin(a) * 0.2);
    l.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    scope.add(l);
  }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 12), MAT.darkMetal());
  tube.rotation.x = Math.PI / 2 - 0.08;
  tube.position.set(0, 1.25, 0.1);
  scope.add(tube);
  scope.position.set(S.x, heightAt(S.x, S.z), S.z);
  group.add(shadowAll(scope));
  circleCollider(ctx, S.x, S.z, 0.3);

  // the route chart pinned to the board (collectible)
  const chartTex = canvasTex(320, 240, (c, w, h) => {
    c.fillStyle = '#e8e3d3'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#9fb3c4'; c.lineWidth = 1;
    for (let x = 0; x < w; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let yy = 0; yy < h; yy += 20) { c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); }
    c.strokeStyle = '#1d4f8a'; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 60); c.lineTo(300, 70); c.stroke();
    c.strokeStyle = '#555'; c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(150, 65); c.quadraticCurveTo(190, 120, 220, 190); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#7a5a35'; c.beginPath(); c.ellipse(225, 200, 22, 12, 0, 0, 7); c.fill();
    c.fillStyle = '#222'; c.font = 'bold 16px monospace'; c.fillText('NV 2207', 20, 40);
    c.font = '12px monospace'; c.fillText('02:14', 160, 100); c.fillText('02:40', 238, 180); c.fillText('31A - escort. do not board', 20, 228);
  });
  const chart = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.46), std({ map: chartTex, roughness: 0.9 }));
  chart.position.set(R.x, y + 1.32, R.z);
  chart.rotation.y = 0.5;
  group.add(chart);
  return { chart };
}

// ============================================================================ FOOTPRINTS
let printTex = null;
export function buildFootprints(ctx, polyline, { step = 0.72, fresh = false, seed = 1 } = {}) {
  const { group, heightAt } = ctx;
  if (!printTex) {
    printTex = canvasTex(64, 128, (c) => {
      c.clearRect(0, 0, 64, 128);
      c.fillStyle = '#fff';
      c.beginPath(); c.ellipse(32, 38, 20, 30, 0, 0, 7); c.fill();
      c.beginPath(); c.ellipse(32, 98, 15, 20, 0, 0, 7); c.fill();
      c.fillStyle = '#000';
      for (let y = 18; y < 64; y += 9) c.fillRect(16, y, 32, 3);
    });
    printTex.userData.shared = true;
  }
  const marks = [];
  const r = mulberry32(seed);
  let left = true;
  for (let i = 0; i < polyline.length - 1; i++) {
    const [ax, az] = polyline[i], [bx, bz] = polyline[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / len, dz = (bz - az) / len;
    for (let d = 0; d < len; d += step) {
      const side = left ? 1 : -1;
      left = !left;
      const x = ax + dx * d + dz * 0.14 * side + (r() - 0.5) * 0.05;
      const z = az + dz * d - dx * 0.14 * side + (r() - 0.5) * 0.05;
      marks.push({ x, z, yaw: Math.atan2(dx, dz) + (r() - 0.5) * 0.2 });
    }
  }
  const mat = new THREE.MeshStandardMaterial({
    color: fresh ? 0x1c140d : 0x2a2016, alphaMap: printTex, transparent: true, opacity: fresh ? 0.85 : 0.6,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.6,
  });
  const geo = new THREE.PlaneGeometry(0.16, 0.32);
  geo.rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(geo, mat, marks.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  marks.forEach((p, i) => {
    q.setFromAxisAngle(up, p.yaw);
    v.set(p.x, heightAt(p.x, p.z) + 0.035, p.z);
    im.setMatrixAt(i, m4.compose(v, q, s));
  });
  im.computeBoundingSphere();
  im.receiveShadow = true;
  group.add(im);
  return im;
}

// ============================================================================ THE FIGURE
export function buildFigure(ctx) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 1 }); // lit by the flashlight, near-black otherwise
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 1.05, 4, 10), mat);
  body.position.y = 1.0;
  body.scale.set(1, 1, 0.7);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mat);
  head.position.y = 1.78;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 10), mat);
  hood.position.y = 1.86;
  g.add(body, head, hood);
  g.visible = false;
  ctx.group.add(g);
  return g;
}

// ============================================================================ STREAM, BRIDGE, LOGS, GIANT TREES
export function buildStream(ctx, streamZ, streamLevel, shared) {
  const xs = [];
  for (let x = -112; x <= 112; x += 1.5) xs.push(x);
  const pos = [], uv = [], idx = [];
  xs.forEach((x, i) => {
    const z = streamZ(x), y = streamLevel(x);
    pos.push(x, y, z - 3.2, x, y, z + 3.2);
    uv.push(x * 0.1, 0, x * 0.1, 1);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x173540, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.82 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv2;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv2 = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vUv2;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float band = sin(vUv2.x * 9.0 - uTime * 2.2 + sin(vUv2.y * 6.0) * 1.5) * 0.5 + 0.5;
        float edge = smoothstep(0.0, 0.18, vUv2.y) * smoothstep(1.0, 0.82, vUv2.y);
        diffuseColor.rgb += vec3(0.08, 0.12, 0.14) * pow(band, 6.0);
        diffuseColor.a *= edge;`);
  };
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  ctx.group.add(m);
  return m;
}

export function buildBridge(ctx, B, baseHeight) {
  const g = new THREE.Group();
  const logMat = propMaterial('bark', { color: 0x9c8468, roughness: 1 }, 1.2);
  const z0 = B.z - 5.2, z1 = B.z + 5.2;
  const y0 = baseHeight(B.x, z0) + 0.22, y1 = baseHeight(B.x, z1) + 0.22;
  for (const dx of [-0.42, 0, 0.42]) {
    const len = Math.hypot(z1 - z0, y1 - y0);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, len, 9), logMat);
    log.rotation.x = Math.PI / 2 - Math.atan2(y1 - y0, z1 - z0);
    log.position.set(B.x + dx, (y0 + y1) / 2 - 0.05, B.z);
    g.add(log);
  }
  // rope rail
  for (const dx of [-0.8, 0.8]) {
    for (const zz of [z0 + 0.5, B.z, z1 - 0.5]) {
      const yy = y0 + ((zz - z0) / (z1 - z0)) * (y1 - y0);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5), logMat);
      post.position.set(B.x + dx, yy + 0.45, zz);
      g.add(post);
    }
  }
  ctx.group.add(shadowAll(g));
  // the deck is walkable: report its height inside its footprint
  return (x, z) => {
    if (Math.abs(x - B.x) > 0.75 || z < z0 || z > z1) return null;
    return y0 + ((z - z0) / (z1 - z0)) * (y1 - y0) + 0.12;
  };
}

export function buildLogs(ctx, spots) {
  const mat = propMaterial('bark', { color: 0x9c8468, roughness: 1 }, 1.2);
  const moss = std({ color: 0x3b5a2a, roughness: 1 });
  for (const [x, z, len, rot, r] of spots) {
    const g = new THREE.Group();
    const log = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, len, 10), mat);
    log.rotation.z = Math.PI / 2;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.12, len * 0.6, 10, 1, true, 0, Math.PI), moss);
    m.rotation.z = Math.PI / 2;
    g.add(log, m);
    g.position.set(x, ctx.heightAt(x, z) + r * 0.7, z);
    g.rotation.y = rot;
    ctx.group.add(shadowAll(g));
    // log lies along local x; collider box rotated to match
    boxCollider(ctx, x, z, len / 2, r + 0.1, rot);
  }
}

export function buildGiantTrees(ctx, spots, canopyMat, trunkMat, jungleTreeGeometries) {
  const geos = jungleTreeGeometries(777);
  const rootGeo = new THREE.ConeGeometry(0.5, 2.6, 4);
  rootGeo.rotateZ(-Math.PI / 2); // apex points outward, wide base at the trunk
  rootGeo.scale(1, 1, 0.25);
  rootGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(rootGeo.attributes.position.count * 3).fill(0.75), 3));
  for (const [x, z, s] of spots) {
    const y = ctx.heightAt(x, z);
    const trunk = new THREE.Mesh(geos.trunk, trunkMat);
    const crown = new THREE.Mesh(geos.leaves, canopyMat);
    for (const m of [trunk, crown]) {
      m.position.set(x, y - 0.3, z);
      m.scale.setScalar(s);
      m.castShadow = true; m.receiveShadow = true;
      ctx.group.add(m);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + s;
      const root = new THREE.Mesh(rootGeo, trunkMat);
      root.position.set(x + Math.cos(a) * 1.3 * s * 0.6, y + 0.35, z + Math.sin(a) * 1.3 * s * 0.6);
      root.rotation.y = -a;
      root.rotation.z = -0.35;
      root.castShadow = true;
      ctx.group.add(root);
    }
    circleCollider(ctx, x, z, 0.75 * s);
  }
}
