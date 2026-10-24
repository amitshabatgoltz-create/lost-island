// 3D models for every collectible / interactive object (procedural geometry + canvas textures).
import * as THREE from 'three';
import { loadTorch } from './gfx/torch.js';

export const SYMBOL_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="sym">
  <g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
    <path d="M50 12 A38 38 0 0 1 82.9 31"/>
    <path d="M86.5 42 A38 38 0 0 1 61 86.4"/>
    <path d="M39 86.4 A38 38 0 0 1 13.5 42"/>
    <path d="M17.1 31 A38 38 0 0 1 40 13.3"/>
    <line x1="50" y1="24" x2="50" y2="76"/>
    <path d="M30 60 L50 76 L70 60"/>
  </g>
  <circle cx="35" cy="40" r="4.5" fill="currentColor"/>
  <circle cx="65" cy="40" r="4.5" fill="currentColor"/>
</svg>`;

export function drawSymbol(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * 0.13;
  ctx.lineCap = 'round';
  const arcs = [[-1.57, -0.52], [-0.28, 1.13], [1.98, 2.86], [3.42, 4.24]];
  for (const [a, b] of arcs) { ctx.beginPath(); ctx.arc(cx, cy, r, a, b); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.68); ctx.lineTo(cx, cy + r * 0.68); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - r * 0.53, cy + r * 0.26); ctx.lineTo(cx, cy + r * 0.68); ctx.lineTo(cx + r * 0.53, cy + r * 0.26); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx - r * 0.4, cy - r * 0.26, r * 0.12, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.4, cy - r * 0.26, r * 0.12, 0, 7); ctx.fill();
  ctx.restore();
}

export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const std = (o) => new THREE.MeshStandardMaterial(o);

function shadows(g) {
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function createItemMesh(id) {
  const g = new THREE.Group();
  switch (id) {
    case 'water': {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.27, 16), std({ color: 0x9fd3f0, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.65 }));
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.2, 14), std({ color: 0x4aa4d8, roughness: 0.1, transparent: true, opacity: 0.6 }));
      water.position.y = -0.03;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.075, 0.06, 14), bottle.material);
      neck.position.y = 0.165;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.035, 12), std({ color: 0x1f5fb8, roughness: 0.5 }));
      cap.position.y = 0.21;
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.077, 0.077, 0.09, 16, 1, true), std({ color: 0xf3f6f8, roughness: 0.7 }));
      const inner = new THREE.Group();
      inner.add(bottle, water, neck, cap, label);
      inner.rotation.z = Math.PI / 2;
      inner.position.y = 0.075;
      g.add(inner);
      g.scale.setScalar(1.6);
      break;
    }
    case 'flashlight': {
      // the real flashlight model, lying on its side (a plain stand-in shows until it has loaded)
      const inner = new THREE.Group();
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 12), std({ color: 0x1b1d20, roughness: 0.4, metalness: 0.6 }));
      stand.rotation.x = Math.PI / 2;
      inner.add(stand);
      inner.rotation.y = 0.1;
      inner.position.y = 0.026;
      g.add(inner);
      loadTorch().then((m) => {
        m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material.emissive.setHex(0xfff0d8); o.material.emissiveIntensity = 0.6; } });
        inner.remove(stand);
        stand.geometry.dispose();
        inner.add(m);
      }).catch(() => {});
      g.scale.setScalar(1.25);
      break;
    }
    case 'bandage': {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.18), std({ color: 0xc8322d, roughness: 0.8 }));
      pouch.position.y = 0.04;
      const crossTex = canvasTex(64, 64, (c) => { c.fillStyle = '#c8322d'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#fff'; c.fillRect(26, 12, 12, 40); c.fillRect(12, 26, 40, 12); });
      const top = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), std({ map: crossTex, roughness: 0.8 }));
      top.rotation.x = -Math.PI / 2;
      top.position.y = 0.081;
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 16), std({ color: 0xf1ede2, roughness: 0.95 }));
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0.2, 0.05, 0.03);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.3), std({ color: 0xf1ede2, roughness: 0.95, side: THREE.DoubleSide }));
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(0.22, 0.005, 0.2);
      g.add(pouch, top, roll, strip);
      g.scale.setScalar(1.5);
      break;
    }
    case 'booklet': {
      const coverTex = canvasTex(256, 340, (c, w, h) => {
        c.fillStyle = '#2b2119'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 1800; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
        c.strokeStyle = '#a8894f'; c.lineWidth = 4; c.strokeRect(14, 14, w - 28, h - 28);
        drawSymbol(c, w / 2, h / 2 - 10, 62, '#c9a663');
      });
      const pages = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.028, 0.27), std({ color: 0xe6dcc3, roughness: 0.95 }));
      pages.position.y = 0.017;
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.006, 0.285), [
        std({ color: 0x2b2119, roughness: 0.8 }), std({ color: 0x2b2119, roughness: 0.8 }),
        std({ map: coverTex, roughness: 0.7 }), std({ color: 0x2b2119, roughness: 0.8 }),
        std({ color: 0x2b2119, roughness: 0.8 }), std({ color: 0x2b2119, roughness: 0.8 }),
      ]);
      cover.position.y = 0.034;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.006, 0.285), std({ color: 0x2b2119, roughness: 0.8 }));
      back.position.y = 0.003;
      g.add(pages, cover, back);
      g.scale.setScalar(1.5);
      break;
    }
    case 'ticket': {
      const tex = canvasTex(512, 200, (c, w, h) => {
        c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#16365f'; c.fillRect(0, 0, w, 44);
        c.fillStyle = '#fff'; c.font = 'bold 28px Arial'; c.fillText('MERIDIAN  ·  BOARDING PASS', 18, 31);
        c.fillStyle = '#222'; c.font = 'bold 34px monospace';
        c.fillText('NV 2207', 20, 100); c.fillText('SEAT 31A', 250, 100);
        c.font = '22px monospace'; c.fillText('23 SEP  GATE C14  02:14', 20, 140);
        c.fillText('NAME: ', 20, 178);
        // torn area
        c.fillStyle = 'rgba(120,100,70,0.35)'; c.fillRect(100, 158, 300, 28);
        c.globalCompositeOperation = 'destination-out';
        c.beginPath(); c.moveTo(w, 0); c.lineTo(w - 70, 0);
        for (let y = 0; y <= h; y += 14) c.lineTo(w - 70 - Math.random() * 40, y);
        c.lineTo(w, h); c.fill();
      });
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.133), std({ map: tex, transparent: true, roughness: 0.8, side: THREE.DoubleSide }));
      card.rotation.x = -Math.PI / 2;
      card.position.y = 0.012;
      card.rotation.z = 0.3;
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0xe8d2be, roughness: 0.6 }));
      shell.scale.set(1, 0.5, 1.2);
      shell.position.set(-0.11, 0.012, 0.02);
      g.add(card, shell);
      g.scale.setScalar(1.8);
      break;
    }
    case 'device': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.05), std({ color: 0x18191b, roughness: 0.35, metalness: 0.5 }));
      body.position.y = 0.0125;
      const plug = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.03), std({ color: 0xb9bdc2, metalness: 0.9, roughness: 0.25 }));
      plug.position.set(0.072, 0.012, 0);
      const symTex = canvasTex(128, 64, (c, w, h) => { c.fillStyle = '#18191b'; c.fillRect(0, 0, w, h); drawSymbol(c, 40, 32, 22, '#9fb2c4'); });
      const top = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.045), std({ map: symTex, roughness: 0.4 }));
      top.rotation.x = -Math.PI / 2;
      top.position.y = 0.026;
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), std({ color: 0x4fc3ff, emissive: 0x4fc3ff, emissiveIntensity: 3 }));
      led.position.set(-0.045, 0.027, 0.015);
      led.name = 'led';
      const lanyard = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.004, 4, 20), std({ color: 0x1d3f6b, roughness: 0.9 }));
      lanyard.rotation.x = -Math.PI / 2;
      lanyard.position.set(-0.11, 0.004, 0);
      g.add(body, plug, top, led, lanyard);
      g.scale.setScalar(2.2);
      break;
    }
    case 'document': {
      const tex = canvasTex(360, 500, (c, w, h) => {
        c.fillStyle = '#efe9da'; c.fillRect(0, 0, w, h);
        drawSymbol(c, 46, 50, 24, '#333');
        c.fillStyle = '#222'; c.font = 'bold 22px monospace'; c.fillText('INTERNAL — EYES ONLY', 90, 58);
        c.font = '17px monospace';
        const lines = ['DATE: 14 SEP', '', 'RE: NV 2207 / 23 SEP', '', '— route deviation confirmed', '— sector 7, window 02:40', '— package must remain', '  with the courier', '', ''];
        lines.forEach((l, i) => c.fillText(l, 26, 120 + i * 28));
        for (let i = 0; i < 6; i++) { c.fillStyle = '#111'; c.fillRect(26, 400 + i * 14, 120 + Math.random() * 180, 9); }
      });
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), std({ map: tex, roughness: 0.85, side: THREE.DoubleSide }));
      paper.rotation.x = -Math.PI / 2;
      paper.position.y = 0.006;
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.008, 0.31), std({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.05 }));
      sleeve.position.y = 0.006;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06), std({ color: 0x77736b, roughness: 0.9, flatShading: true }));
      stone.position.set(0.07, 0.04, -0.1);
      g.add(paper, sleeve, stone);
      g.rotation.y = 0.4;
      g.scale.setScalar(1.9);
      break;
    }
  }
  return shadows(g);
}

// The special black suitcase: lid hinges open.
export function createBlackSuitcase() {
  const g = new THREE.Group();
  const shell = std({ color: 0x111214, roughness: 0.35, metalness: 0.4 });
  const lining = std({ color: 0x4a1418, roughness: 0.95 });
  const steel = std({ color: 0xb8bec4, roughness: 0.25, metalness: 0.9 });
  const W = 0.95, D = 0.62, Hb = 0.2, Hl = 0.12;
  const base = new THREE.Group();
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), shell);
  bottom.position.y = 0.01;
  base.add(bottom);
  for (const [w, d, x, z] of [[W, 0.02, 0, D / 2], [W, 0.02, 0, -D / 2], [0.02, D, W / 2, 0], [0.02, D, -W / 2, 0]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, Hb, d), shell);
    wall.position.set(x, Hb / 2, z);
    base.add(wall);
  }
  const lin = new THREE.Mesh(new THREE.BoxGeometry(W - 0.05, 0.01, D - 0.05), lining);
  lin.position.y = 0.025;
  base.add(lin);
  g.add(base);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, Hb, -D / 2);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W, Hl, D), shell);
  lid.position.set(0, Hl / 2, D / 2);
  const lidLin = new THREE.Mesh(new THREE.BoxGeometry(W - 0.05, 0.01, D - 0.05), lining);
  lidLin.position.set(0, 0.004, D / 2);
  lidPivot.add(lid, lidLin);
  g.add(lidPivot);
  for (const x of [-0.3, 0.3]) {
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), steel);
    latch.position.set(x, Hb, D / 2 + 0.012);
    g.add(latch);
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 14, Math.PI), std({ color: 0x0a0a0a, roughness: 0.6 }));
  handle.position.set(0, Hb * 0.6, D / 2 + 0.03);
  handle.rotation.x = Math.PI / 2;
  g.add(handle);
  // embossed symbol on the lid
  const symTex = canvasTex(128, 128, (c) => { c.clearRect(0, 0, 128, 128); drawSymbol(c, 64, 64, 44, '#6d7680'); });
  const sym = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), std({ map: symTex, transparent: true, roughness: 0.4, metalness: 0.6 }));
  sym.rotation.x = -Math.PI / 2;
  sym.position.set(0, Hl + 0.002, D / 2);
  lidPivot.add(sym);
  g.userData.lid = lidPivot;
  g.userData.innerY = 0.03;
  return shadows(g);
}

let glintTex = null;
export function createGlint() {
  if (!glintTex) {
    glintTex = canvasTex(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.2, 'rgba(190,225,255,0.8)');
      g.addColorStop(1, 'rgba(160,200,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(32, 2); c.lineTo(32, 62); c.moveTo(2, 32); c.lineTo(62, 32); c.stroke();
    });
    glintTex.userData.shared = true; // reused by every zone, never disposed
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(0.45);
  return s;
}

// Small piles of scavenged material shown where a resource can be picked up.
export function createResourceMesh(look) {
  const g = new THREE.Group();
  const r = (a, b) => a + Math.random() * (b - a);
  if (look === 'wood') {
    const mat = std({ color: 0x8a6c48, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(r(0.7, 1.1), 0.06, r(0.1, 0.16)), mat);
      p.position.set(r(-0.15, 0.15), 0.04 + i * 0.05, r(-0.2, 0.2));
      p.rotation.y = r(-0.6, 0.6);
      g.add(p);
    }
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.2, 6), std({ color: 0x6b5338, roughness: 1 }));
    branch.rotation.set(0, 0.5, Math.PI / 2);
    branch.position.set(0.1, 0.06, 0.3);
    g.add(branch);
  } else if (look === 'rope') {
    const mat = std({ color: 0xc9b37a, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.16 - i * 0.03, 0.022, 6, 18), mat);
      t.rotation.x = Math.PI / 2;
      t.position.y = 0.025 + i * 0.04;
      g.add(t);
    }
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.01, 0.05), std({ color: 0x1f3a66, roughness: 0.8 }));
    strap.position.set(0.25, 0.01, 0.15);
    strap.rotation.y = 0.6;
    g.add(strap);
  } else if (look === 'cloth') {
    const colors = [0x2f4e7d, 0x8a3b32, 0xd9d2c0];
    colors.forEach((c, i) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.5 - i * 0.06, 0.05, 0.38 - i * 0.04), std({ color: c, roughness: 1 }));
      f.position.y = 0.025 + i * 0.05;
      f.rotation.y = r(-0.3, 0.3);
      g.add(f);
    });
  } else if (look === 'battery') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.2), std({ color: 0xd4532b, roughness: 0.6 }));
    box.position.y = 0.06;
    g.add(box);
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 10), std({ color: i % 2 ? 0x222222 : 0xc8a034, roughness: 0.4, metalness: 0.5 }));
      c.rotation.z = Math.PI / 2;
      c.position.set(r(-0.2, 0.25), 0.025, 0.2 + i * 0.05);
      g.add(c);
    }
  } else {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), std({ color: 0x1f6b3a, roughness: 0.5, metalness: 0.2 }));
    board.position.y = 0.02;
    g.add(board);
    for (let i = 0; i < 6; i++) {
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.04), std({ color: 0x111111, roughness: 0.4 }));
      chip.position.set(r(-0.12, 0.12), 0.04, r(-0.08, 0.08));
      g.add(chip);
    }
    const wire = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 4, 14, 4), std({ color: 0xc0392b }));
    wire.rotation.x = Math.PI / 2;
    wire.position.set(0.25, 0.01, 0.1);
    g.add(wire);
  }
  return shadows(g);
}
