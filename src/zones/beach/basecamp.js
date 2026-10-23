// The player's base camp: a lean-to built from wreck parts and driftwood, with a storage chest,
// a workbench, an evidence board, a lantern and survival gear. Open side faces the sea (+z local).
import * as THREE from 'three';
import { canvasTex, drawSymbol } from '../../items.js';
import { shadowAll, softSprite } from '../shared.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const rot2 = (lx, lz, r) => ({ x: lx * Math.cos(r) + lz * Math.sin(r), z: -lx * Math.sin(r) + lz * Math.cos(r) });

function planks(base) {
  const t = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 21) { c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(0, y, w, 2); }
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(${i % 2 ? '255,235,200' : '0,0,0'},0.07)`; c.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 1); }
  });
  return t;
}

export function buildBaseCamp(group, colliders, occluders, heightAt, B) {
  const g = new THREE.Group();
  const wood = std({ map: planks('#7d6243'), roughness: 0.95 });
  const pole = std({ color: 0x6b5338, roughness: 1 });
  const W = 5.2, D = 3.4;
  // ground: a woven mat and a sand-swept floor
  const mat = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), std({ color: 0xa48d62, roughness: 1 }));
  mat.rotation.x = -Math.PI / 2;
  mat.scale.set(1.15, 0.8, 1);
  mat.position.set(0, 0.025, -0.3);
  g.add(mat);
  // poles: front taller, back lower (rain runs off the back)
  const posts = [[-W / 2, D / 2, 2.4], [W / 2, D / 2, 2.4], [-W / 2, -D / 2, 1.5], [W / 2, -D / 2, 1.5], [0, D / 2, 2.4]];
  for (const [x, z, h] of posts) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 7), pole);
    p.position.set(x, h / 2, z);
    g.add(p);
  }
  for (const [z, h] of [[D / 2, 2.35], [-D / 2, 1.45]]) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, W + 0.3, 7), pole);
    beam.rotation.z = Math.PI / 2;
    beam.position.set(0, h, z);
    g.add(beam);
  }
  // roof: an airline blanket-blue tarp over the beams
  const roofLen = Math.hypot(D, 0.9) + 0.5;
  const roofGeo = new THREE.PlaneGeometry(W + 0.6, roofLen, 8, 4);
  const rp = roofGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) rp.setZ(i, -Math.sin((rp.getX(i) / (W + 0.6)) * Math.PI * 4) * 0.04 - Math.abs(Math.sin(rp.getY(i) * 1.2)) * 0.06);
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, std({ color: 0x2c4f7c, roughness: 0.9, side: THREE.DoubleSide }));
  roof.rotation.x = -Math.PI / 2 + Math.atan2(0.9, D);
  roof.position.set(0, 1.95, 0);
  g.add(roof);
  // back wall: a fuselage panel with the airline stripe
  const panel = new THREE.Mesh(new THREE.BoxGeometry(W, 1.4, 0.06), std({
    map: canvasTex(256, 80, (c, w, h) => {
      c.fillStyle = '#e4e4e0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#16365f'; c.fillRect(0, 44, w, 12);
      c.fillStyle = '#1a2533'; for (let x = 18; x < w; x += 26) c.fillRect(x, 16, 12, 18);
      c.fillStyle = 'rgba(60,40,20,0.35)'; c.fillRect(0, h - 14, w, 14);
    }), roughness: 0.5, metalness: 0.3,
  }));
  panel.position.set(0, 0.72, -D / 2 - 0.05);
  g.add(panel);
  // left wall: woven palm fronds
  const fronds = new THREE.Mesh(new THREE.PlaneGeometry(D, 1.8, 6, 3), std({
    map: canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#6b6a36'; c.fillRect(0, 0, w, h); c.strokeStyle = '#4c4a24'; c.lineWidth = 3; for (let i = -h; i < w; i += 10) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); } }),
    roughness: 1, side: THREE.DoubleSide,
  }));
  fronds.rotation.y = Math.PI / 2;
  fronds.position.set(-W / 2 - 0.02, 0.9, 0);
  g.add(fronds);

  // ---------------------------------------------------------------- storage chest
  const chest = new THREE.Group();
  const band = std({ color: 0x3b3b3b, roughness: 0.4, metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.62), wood);
  body.position.y = 0.25;
  chest.add(body);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.5, -0.31);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.14, 0.64), wood);
  lid.position.set(0, 0.07, 0.31);
  lidPivot.add(lid);
  for (const x of [-0.42, 0.42]) {
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.64), band);
    b1.position.set(x, 0.25, 0);
    chest.add(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.66), band);
    b2.position.set(x, 0.07, 0.31);
    lidPivot.add(b2);
  }
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.03), band);
  clasp.position.set(0, 0.45, 0.33);
  chest.add(clasp, lidPivot);
  const inside = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.52), std({ color: 0x2a2018, roughness: 1 }));
  inside.position.y = 0.46;
  chest.add(inside);
  chest.position.set(-1.6, 0, -1.05);
  g.add(chest);

  // ---------------------------------------------------------------- workbench
  const bench = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.75), wood);
  top.position.y = 0.88;
  bench.add(top);
  for (const [x, z] of [[-0.72, -0.3], [0.72, -0.3], [-0.72, 0.3], [0.72, 0.3]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.88, 0.08), pole);
    l.position.set(x, 0.44, z);
    bench.add(l);
  }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.6), wood);
  shelf.position.y = 0.25;
  bench.add(shelf);
  // tools: hammer, knife, a seat-frame vise, coils of wire
  const steel = std({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.8 });
  const hammerH = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 6), pole);
  hammerH.rotation.z = Math.PI / 2;
  hammerH.position.set(-0.3, 0.94, 0.1);
  const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.13), steel);
  hammerHead.position.set(-0.46, 0.94, 0.1);
  const knife = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.03), steel);
  knife.position.set(0.1, 0.925, 0.2);
  knife.rotation.y = 0.4;
  const vise = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.12), std({ color: 0x5d6a74, roughness: 0.5, metalness: 0.6 }));
  vise.position.set(0.6, 0.99, -0.15);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 5, 14), std({ color: 0xb87333, metalness: 0.7, roughness: 0.4 }));
  coil.rotation.x = Math.PI / 2;
  coil.position.set(0.25, 0.93, -0.2);
  const scrap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.3), std({ color: 0xd8dadc, roughness: 0.4, metalness: 0.5 }));
  scrap.position.set(-0.1, 0.28, 0);
  bench.add(hammerH, hammerHead, knife, vise, coil, scrap);
  bench.position.set(1.4, 0, -0.95);
  g.add(bench);

  // ---------------------------------------------------------------- evidence board
  const board = new THREE.Group();
  const cork = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 0.05), std({
    map: canvasTex(128, 96, (c, w, h) => { c.fillStyle = '#9c7748'; c.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(${Math.random() > 0.5 ? '60,40,20' : '200,170,120'},0.25)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }),
    roughness: 1,
  }));
  cork.position.y = 1.45;
  board.add(cork);
  for (const x of [-0.6, 0.6]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.95, 6), pole);
    leg.position.set(x, 0.97, -0.04);
    board.add(leg);
  }
  // one pinned paper per booklet entry found, joined by red string
  const pins = [];
  const pinSpots = [[-0.45, 1.7], [-0.1, 1.75], [0.3, 1.7], [-0.4, 1.4], [0.05, 1.45], [0.42, 1.4], [-0.45, 1.15], [-0.05, 1.18], [0.38, 1.15], [0.2, 1.58], [-0.25, 1.55]];
  const paperTex = canvasTex(64, 80, (c) => { c.fillStyle = '#ece5d2'; c.fillRect(0, 0, 64, 80); c.fillStyle = '#555'; for (let y = 14; y < 70; y += 9) c.fillRect(8, y, 30 + Math.random() * 18, 3); drawSymbol(c, 48, 12, 7, '#7a2a20'); });
  const paperMat = std({ map: paperTex, roughness: 0.9 });
  const pinMat = std({ color: 0xc0392b, roughness: 0.4 });
  for (const [x, y] of pinSpots) {
    const p = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), paperMat);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), pinMat);
    pin.position.set(0, 0.1, 0.012);
    p.add(paper, pin);
    p.position.set(x, y, 0.03);
    p.rotation.z = (Math.random() - 0.5) * 0.2;
    p.visible = false;
    board.add(p);
    pins.push(p);
  }
  const stringMat = new THREE.LineBasicMaterial({ color: 0xb03a2e });
  const stringGeo = new THREE.BufferGeometry();
  const strings = new THREE.LineSegments(stringGeo, stringMat);
  board.add(strings);
  board.position.set(2.75, 0, 1.3);
  board.rotation.y = -1.05;
  g.add(board);

  // ---------------------------------------------------------------- lantern hanging from the front beam
  const lanternG = new THREE.Group();
  const lbase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.05, 12), band);
  const glassMat = std({ color: 0x333333, emissive: 0xffb45c, emissiveIntensity: 1.6, transparent: true, opacity: 0.9 });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 12), glassMat);
  glass.position.y = 0.12;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.08, 12), band);
  cap.position.y = 0.25;
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3), band);
  hook.position.y = 0.42;
  lanternG.add(lbase, glass, cap, hook);
  lanternG.position.set(-0.4, 1.68, D / 2 - 0.05);
  g.add(lanternG);
  const glowMat = new THREE.SpriteMaterial({ map: softSprite(255, 190, 110), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(1.4);
  glow.position.set(-0.4, 1.8, D / 2 - 0.05);
  g.add(glow);
  const light = new THREE.PointLight(0xffb866, 6, 11, 1.6);
  light.position.set(-0.4, 1.75, D / 2 - 0.05);
  g.add(light);

  // ---------------------------------------------------------------- survival gear: water jugs, bedroll, net, rope, fire pit
  const jugMat = std({ color: 0x3b7bbf, roughness: 0.3, transparent: true, opacity: 0.8 });
  [[-2.15, -0.3], [-2.15, 0.05]].forEach(([x, z]) => {
    const j = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.42, 12), jugMat);
    j.position.set(x, 0.21, z);
    g.add(j);
  });
  const bed = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.5, 4, 8), std({ color: 0x8a3b32, roughness: 1 }));
  bed.rotation.z = Math.PI / 2;
  bed.scale.set(1, 1, 0.35);
  bed.position.set(-0.05, 0.1, -0.95);
  g.add(bed);
  const ropeCoil = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 18), std({ color: 0xc9b37a, roughness: 0.9 }));
  ropeCoil.rotation.x = Math.PI / 2;
  ropeCoil.position.set(W / 2 - 0.3, 1.0, -D / 2 + 0.2);
  g.add(ropeCoil);
  const netTex = canvasTex(64, 64, (c) => { c.clearRect(0, 0, 64, 64); c.strokeStyle = '#ddd'; c.lineWidth = 2; for (let i = 0; i <= 64; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 64); c.moveTo(0, i); c.lineTo(64, i); c.stroke(); } });
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
  netTex.repeat.set(3, 2);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), std({ map: netTex, alphaMap: netTex, alphaTest: 0.3, side: THREE.DoubleSide, color: 0xb9c2b8 }));
  net.position.set(W / 2 + 0.02, 1.1, 0.2);
  net.rotation.y = Math.PI / 2;
  g.add(net);
  const pit = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13), std({ color: 0x77736b, roughness: 1, flatShading: true }));
    st.position.set(Math.cos(a) * 0.5, 0.07, Math.sin(a) * 0.5);
    pit.add(st);
  }
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 6), std({ color: 0x2b2118, roughness: 1 }));
    log.rotation.set(Math.PI / 2, (i / 3) * Math.PI, 0.3);
    log.position.y = 0.08;
    pit.add(log);
  }
  pit.position.set(0.2, 0, 3.1);
  g.add(pit);

  const y = heightAt(B.x, B.z);
  g.position.set(B.x, y, B.z);
  g.rotation.y = B.rot;
  group.add(shadowAll(g));
  roof.castShadow = true;
  occluders.push(roof, panel);

  // colliders (the inside stays walkable)
  const at = (lx, lz) => { const o = rot2(lx, lz, B.rot); return { x: B.x + o.x, z: B.z + o.z }; };
  const box = (lx, lz, hw, hd) => { const p = at(lx, lz); colliders.push({ type: 'box', x: p.x, z: p.z, hw, hd, rot: B.rot, tag: 'base' }); };
  const circ = (lx, lz, r) => { const p = at(lx, lz); colliders.push({ type: 'circle', x: p.x, z: p.z, r }); };
  box(0, -D / 2 - 0.05, W / 2, 0.12); // back panel
  box(-W / 2, 0, 0.08, D / 2); // frond wall
  for (const [x, z] of posts) circ(x, z, 0.1);
  box(-1.6, -1.05, 0.58, 0.34); // chest
  box(1.4, -0.95, 0.82, 0.4); // workbench
  circ(2.75, 1.3, 0.35); // board
  circ(0.2, 3.1, 0.62); // fire pit

  return {
    spots: { chest: at(-1.6, -0.25), bench: at(1.4, -0.15), board: at(2.0, 1.75), lantern: at(-0.4, 1.1), center: at(0, 0.4) },
    lidPivot, light, glassMat, glowMat,
    setPins(n) {
      pins.forEach((p, i) => (p.visible = i < n));
      const pts = [];
      const shown = pins.filter((p) => p.visible);
      for (let i = 0; i < shown.length - 1; i++) {
        const a = shown[i].position, b = shown[i + 1].position;
        pts.push(a.x, a.y + 0.1, a.z + 0.02, b.x, b.y + 0.1, b.z + 0.02);
      }
      stringGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    },
    setLantern(on) {
      light.intensity = on ? 6 : 0;
      glassMat.emissiveIntensity = on ? 1.6 : 0;
      glowMat.opacity = on ? 0.55 : 0;
    },
  };
}
