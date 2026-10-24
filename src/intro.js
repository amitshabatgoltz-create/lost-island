// Opening cinematic: outside shot of the airliner in a storm -> night flight cabin -> malfunction -> crash -> black.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { fabricTex, clothTex, tileFbm } from './gfx/textures.js';
import { mulberry32 } from './noise.js';
import { buildExterior } from './intro-exterior.js';
import { T } from './i18n/index.js';

const CUT = 6.4; // outside shot -> cabin
const CABIN_T0 = 1.0; // the cabin timeline runs this much later than it did before the outside shot

// ------------------------------------------------------------------ cabin textures (canvas, no image files)
function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 8;
  return t;
}

// seat upholstery: navy with a woven diamond motif
const seatFabricMap = () => canvasTex(256, 256, (c, w, h) => {
  const n = tileFbm(256, 8, 3, 401);
  const id = c.createImageData(w, h), d = id.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const u = (x % 64) - 32, v = (y % 64) - 32;
    const diamond = Math.abs(Math.abs(u) + Math.abs(v) - 22) < 2.2 ? 1 : 0;
    const dot = u * u + v * v < 9 ? 1 : 0;
    const k = 0.9 + n[i] * 0.2;
    d[i * 4] = (38 + diamond * 30 + dot * 60) * k;
    d[i * 4 + 1] = (62 + diamond * 34 + dot * 50) * k;
    d[i * 4 + 2] = (110 + diamond * 40 + dot * 30) * k;
    d[i * 4 + 3] = 255;
  }
  c.putImageData(id, 0, 0);
}, { repeat: [2, 2] });

// loop-pile carpet with a small repeating pattern
const carpetMap = (base, accent, seed, repeat) => canvasTex(256, 256, (c, w, h) => {
  const n = tileFbm(256, 32, 2, seed);
  const id = c.createImageData(w, h), d = id.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const u = (x % 32) - 16, v = (y % 32) - 16;
    const mark = Math.abs(u) + Math.abs(v) < 5 ? 1 : 0;
    const k = 0.82 + n[i] * 0.3;
    const col = mark ? accent : base;
    d[i * 4] = col[0] * k; d[i * 4 + 1] = col[1] * k; d[i * 4 + 2] = col[2] * k; d[i * 4 + 3] = 255;
  }
  c.putImageData(id, 0, 0);
}, { repeat });

// sidewall lining: off-white plastic, one panel seam per seat row
const liningMap = () => canvasTex(256, 256, (c, w, h) => {
  const n = tileFbm(256, 4, 4, 411), f = tileFbm(256, 64, 2, 412);
  const id = c.createImageData(w, h), d = id.data;
  for (let i = 0; i < w * h; i++) {
    const k = 0.9 + n[i] * 0.08 + (f[i] - 0.5) * 0.05;
    d[i * 4] = 226 * k; d[i * 4 + 1] = 222 * k; d[i * 4 + 2] = 212 * k; d[i * 4 + 3] = 255;
  }
  c.putImageData(id, 0, 0);
  c.fillStyle = 'rgba(90,88,82,0.6)'; c.fillRect(0, 0, w, 3);
}, { repeat: [6, 34 / 0.95] });

// overhead bin doors: seam every 1.9 m (uv in metres along the bin)
const binMap = () => canvasTex(64, 256, (c, w, h) => {
  c.fillStyle = '#e9e6df'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(70,70,70,0.7)'; c.fillRect(0, 0, w, 4);
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, 4, w, 2);
}, { repeat: [1, 1 / 1.9] });

// seat-back screen: moving-map display over the Pacific
const screenMap = () => canvasTex(256, 160, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0c2a52'); g.addColorStop(1, '#081a36');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(120,170,230,0.18)'; c.lineWidth = 1;
  for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.fillStyle = '#2f5a3a';
  c.beginPath(); c.ellipse(-10, 40, 60, 70, 0.3, 0, 7); c.fill();
  c.beginPath(); c.ellipse(270, 120, 50, 60, -0.2, 0, 7); c.fill();
  c.strokeStyle = '#e8c24a'; c.lineWidth = 2; c.setLineDash([5, 4]);
  c.beginPath(); c.moveTo(40, 70); c.quadraticCurveTo(130, 20, 236, 104); c.stroke();
  c.setLineDash([]);
  c.save(); c.translate(118, 44); c.rotate(0.15); c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(9, 0); c.lineTo(-6, -7); c.lineTo(-3, 0); c.lineTo(-6, 7); c.closePath(); c.fill(); c.restore();
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, h - 30, w, 30);
  c.fillStyle = '#e6eef8'; c.font = 'bold 14px Arial';
  c.fillText('NV-2207', 8, h - 11);
  c.font = '13px Arial'; c.fillText('3:02 to destination', 110, h - 11);
});

// seatbelt / no-smoking pictograms (emissive)
const signMap = () => canvasTex(128, 64, (c, w, h) => {
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 5;
  c.beginPath(); c.arc(32, 32, 20, 0, 7); c.stroke(); // no smoking
  c.fillRect(18, 29, 26, 6);
  c.beginPath(); c.moveTo(18, 18); c.lineTo(46, 46); c.stroke();
  c.lineWidth = 4; // seatbelt
  c.beginPath(); c.moveTo(78, 22); c.lineTo(78, 44); c.lineTo(110, 44); c.lineTo(110, 22); c.stroke();
  c.fillRect(88, 38, 12, 12);
});

const exitMap = () => canvasTex(128, 48, (c, w, h) => {
  c.fillStyle = '#100'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#fff'; c.font = 'bold 34px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('EXIT', w / 2, h / 2 + 2);
});

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

export class IntroScene {
  constructor(audio, ui) {
    this.audio = audio;
    this.ui = ui;
    this.cabin = new THREE.Scene();
    this.cabin.background = new THREE.Color(0x05070b);
    this.cabin.fog = new THREE.Fog(0x05070b, 8, 30);
    this.cabinCam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 80);
    this.build();
    this.ext = buildExterior();
    this.outside = true;
    this.t = 0;
    this.running = false;
    this.events = [];
  }

  // main.js renders whichever shot is active
  get scene() { return this.outside ? this.ext.scene : this.cabin; }
  get camera() { return this.outside ? this.ext.camera : this.cabinCam; }

  compile(renderer) {
    renderer.compile(this.cabin, this.cabinCam);
    renderer.compile(this.ext.scene, this.ext.camera);
  }

  build() {
    const s = this.cabin;
    const R = 2.5, L = 34;
    const rnd = mulberry32(2207);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);

    // cabin shell with seamed lining panels
    const wallMat = new THREE.MeshStandardMaterial({ map: liningMap(), roughness: 0.8, side: THREE.BackSide });
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 48, 1, true), wallMat);
    shell.rotation.x = Math.PI / 2;
    shell.position.y = 1.0;
    s.add(shell);
    const fabricN = fabricTex().normalMap.clone();
    fabricN.repeat.set(10, 80); fabricN.needsUpdate = true;
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.2, L), new THREE.MeshStandardMaterial({
      map: carpetMap([46, 54, 74], [70, 80, 104], 421, [4, 32]), normalMap: fabricN, roughness: 1,
    }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = -0.6;
    s.add(carpet);
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(0.62, L), new THREE.MeshStandardMaterial({
      map: carpetMap([92, 52, 50], [150, 110, 70], 422, [1, 50]), roughness: 1,
    }));
    aisle.rotation.x = -Math.PI / 2;
    aisle.position.y = -0.595;
    s.add(aisle);

    // seats: cushion, back, headrest cover, plastic back shell with screen and tray table, armrests (all instanced)
    const rows = 18, cols = [-1.55, -1.05, -0.55, 0.55, 1.05, 1.55];
    const n = rows * cols.length;
    const fabricNs = fabricTex().normalMap.clone();
    fabricNs.repeat.set(3, 3); fabricNs.needsUpdate = true;
    const fabric = new THREE.MeshStandardMaterial({ map: seatFabricMap(), normalMap: fabricNs, roughness: 0.92 });
    const cloth = clothTex();
    const cover = new THREE.MeshStandardMaterial({ color: 0xf0ece2, map: cloth.map, normalMap: cloth.normalMap, roughness: 0.95 });
    const plastic = new THREE.MeshStandardMaterial({ color: 0x8e939a, roughness: 0.55 });
    const plasticDark = new THREE.MeshStandardMaterial({ color: 0x5d6168, roughness: 0.5 });
    this.screenMat = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xffffff, emissiveMap: screenMap(), emissiveIntensity: 0.9, roughness: 0.25 });
    const parts = [
      // geometry, material, local transform inside the seat; `back` parts follow the reclined backrest
      { g: new RoundedBoxGeometry(0.46, 0.13, 0.5, 2, 0.04), m: fabric, p: [0, 0.18, 0] },
      { g: new RoundedBoxGeometry(0.46, 0.86, 0.12, 2, 0.05), m: fabric, p: [0, 0.43, 0], back: true },
      { g: new RoundedBoxGeometry(0.44, 0.24, 0.15, 2, 0.05), m: cover, p: [0, 0.78, 0], back: true },
      { g: new RoundedBoxGeometry(0.47, 0.7, 0.035, 2, 0.015), m: plastic, p: [0, 0.4, 0.075], back: true },
      { g: new THREE.PlaneGeometry(0.2, 0.12), m: this.screenMat, p: [0, 0.6, 0.094], back: true },
      { g: new RoundedBoxGeometry(0.36, 0.22, 0.012, 1, 0.004), m: plasticDark, p: [0, 0.3, 0.094], back: true },
      { g: new RoundedBoxGeometry(0.05, 0.06, 0.44, 1, 0.02), m: plastic, p: [-0.25, 0.4, 0.02] },
      { g: new RoundedBoxGeometry(0.05, 0.06, 0.44, 1, 0.02), m: plastic, p: [0.25, 0.4, 0.02] },
    ];
    const backPivot = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.22, 0.24), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.14), S1);
    for (const part of parts) {
      const inst = new THREE.InstancedMesh(part.g, part.m, n);
      const local = new THREE.Matrix4().makeTranslation(...part.p);
      if (part.back) local.premultiply(backPivot);
      let i = 0;
      for (let r = 0; r < rows; r++) for (const x of cols) {
        M.makeTranslation(x, -0.36, -r * 0.95 + 4).multiply(local);
        inst.setMatrixAt(i++, M);
      }
      s.add(inst);
    }

    // windows: moulded bezels in the sidewall, night glass, some blinds half down
    const bezelShape = roundedRectShape(0.36, 0.5, 0.12);
    bezelShape.holes.push(roundedRectShape(0.24, 0.36, 0.09));
    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 });
    bezelGeo.rotateY(Math.PI / 2);
    const bezels = new THREE.InstancedMesh(bezelGeo, new THREE.MeshStandardMaterial({ color: 0xe4e0d6, roughness: 0.6, side: THREE.DoubleSide }), rows * 2);
    this.winMat = new THREE.MeshStandardMaterial({ color: 0x0a1020, emissive: 0x1a2a4a, emissiveIntensity: 0.35, roughness: 0.2, side: THREE.DoubleSide });
    const glass = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.24, 0.36).rotateY(Math.PI / 2), this.winMat, rows * 2);
    const shadeGeo = new THREE.PlaneGeometry(0.24, 1).rotateY(Math.PI / 2).translate(0, -0.5, 0);
    const shades = new THREE.InstancedMesh(shadeGeo, new THREE.MeshStandardMaterial({ color: 0xd8d4ca, roughness: 0.7, side: THREE.DoubleSide }), rows * 2);
    let wi = 0;
    for (let r = 0; r < rows; r++) for (const side of [-1, 1]) {
      const z = -r * 0.95 + 4.2;
      Q.setFromAxisAngle(V.set(0, 1, 0), side > 0 ? 0 : Math.PI);
      bezels.setMatrixAt(wi, M.compose(V.set(side * 2.4, 0.95, z), Q, S1));
      glass.setMatrixAt(wi, M.compose(V.set(side * 2.47, 0.95, z), Q, S1));
      const down = rnd() < 0.35 ? 0.1 + rnd() * 0.26 : 0.001;
      shades.setMatrixAt(wi, M.compose(V.set(side * 2.45, 0.95 + 0.18, z), Q, new THREE.Vector3(1, down, 1)));
      wi++;
    }
    s.add(bezels, glass, shades);

    // overhead bins: curved door profile extruded along the cabin, door seams every two rows
    const binShape = new THREE.Shape();
    binShape.moveTo(1.3, 1.86);
    binShape.lineTo(2.32, 1.86);
    binShape.lineTo(2.0, 2.62);
    binShape.lineTo(1.5, 2.62);
    binShape.quadraticCurveTo(1.18, 2.35, 1.3, 1.86);
    const binGeo = new THREE.ExtrudeGeometry(binShape, { depth: L - 2, bevelEnabled: false, curveSegments: 10 });
    binGeo.translate(0, 0, -(L - 2) / 2 - 4);
    const binMat = new THREE.MeshStandardMaterial({ map: binMap(), roughness: 0.6, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const bin = new THREE.Mesh(binGeo, binMat);
      bin.scale.x = side;
      s.add(bin);
    }
    // bin latches and passenger service units (reading lights + seatbelt / no-smoking signs) under the bins
    const latches = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.12, 0.2), plasticDark, Math.ceil(rows / 2) * 2);
    const psu = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.03, 0.9), new THREE.MeshStandardMaterial({ color: 0xcfcbc2, roughness: 0.6 }), rows * 2);
    this.readMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffe6b8, emissiveIntensity: 0 });
    const readOn = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffe6b8, emissiveIntensity: 2.2 });
    this.readOnMat = readOn;
    const lampGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.012, 12);
    const lamps = new THREE.InstancedMesh(lampGeo, this.readMat, rows * 4);
    const lampsOn = new THREE.InstancedMesh(lampGeo, readOn, rows * 4);
    this.signMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffb000, emissiveMap: signMap(), emissiveIntensity: 0 });
    const icons = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.08), this.signMat, rows * 2);
    let li = 0, pi = 0, onCount = 0, offCount = 0;
    for (let r = 0; r < rows; r++) for (const side of [-1, 1]) {
      const z = -r * 0.95 + 4;
      if (r % 2 === 0) latches.setMatrixAt(li++, M.makeTranslation(side * 1.26, 2.2, z - 0.95));
      psu.setMatrixAt(pi, M.makeTranslation(side * 1.72, 1.845, z));
      for (const dx of [-0.12, 0.12]) {
        const on = rnd() < 0.12;
        (on ? lampsOn : lamps).setMatrixAt(on ? onCount++ : offCount++, M.makeTranslation(side * 1.72 + dx, 1.828, z + 0.25));
      }
      Q.setFromEuler(new THREE.Euler(Math.PI / 2 - 0.45, 0, 0));
      icons.setMatrixAt(pi, M.compose(V.set(side * 1.6, 1.825, z - 0.25), Q, S1));
      pi++;
    }
    lamps.count = offCount; lampsOn.count = onCount;
    s.add(latches, psu, lamps, lampsOn, icons);

    // ceiling light strip (cove lights along the bins)
    this.stripMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe2b0, emissiveIntensity: 1.2 });
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, L - 4), this.stripMat);
      strip.position.set(side * 1.05, 2.42, -4);
      s.add(strip);
    }
    // emergency floor lights
    this.emMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a1a, emissiveIntensity: 0 });
    for (const side of [-1, 1]) {
      const em = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, L - 4), this.emMat);
      em.position.set(side * 0.32, -0.58, -4);
      s.add(em);
    }

    // forward bulkhead: lining wall, galley curtain, EXIT sign
    const bulk = new THREE.Mesh(new THREE.CircleGeometry(R, 40), new THREE.MeshStandardMaterial({ map: liningMap(), roughness: 0.8 }));
    bulk.position.set(0, 1.0, -13.4);
    s.add(bulk);
    const curtGeo = new THREE.PlaneGeometry(1.0, 2.0, 40, 1);
    const cp = curtGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 38) * 0.03);
    curtGeo.computeVertexNormals();
    const curtain = new THREE.Mesh(curtGeo, new THREE.MeshStandardMaterial({ color: 0x1d3256, map: cloth.map, roughness: 0.95 }));
    curtain.position.set(0, 0.4, -13.35);
    s.add(curtain);
    this.exitMat = new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0xff3322, emissiveMap: exitMap(), emissiveIntensity: 1.6 });
    const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), this.exitMat);
    exit.position.set(0, 1.62, -13.3);
    s.add(exit);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.02), this.signMat);
    sign.position.set(0, 2.25, 1.5);
    s.add(sign);

    // oxygen masks, dropping from the service units
    this.masks = [];
    const maskMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.7 });
    const tubeMat = new THREE.LineBasicMaterial({ color: 0xdedede });
    for (let r = 0; r < 10; r++) {
      for (const x of [-1.68, -1.4, 1.4, 1.68]) {
        const mask = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.1, 10, 1, true), maskMat);
        const top = 1.83;
        mask.position.set(x, top, -r * 0.95 + 3.6);
        const tubeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, top, mask.position.z), new THREE.Vector3(x, top, mask.position.z)]);
        const tube = new THREE.Line(tubeGeo, tubeMat);
        mask.visible = tube.visible = false;
        s.add(mask, tube);
        this.masks.push({ mask, tube, top, drop: 0.55 + rnd() * 0.3, phase: rnd() * 6 });
      }
    }

    // passengers seated ahead: head, hair, ears, neck, shoulders; a few asleep, some with headphones or an arm on the aisle armrest
    this.passengers = [];
    const skins = [0xe0b394, 0xc68c6a, 0x8d5a3c, 0xf0c8a8, 0x5e3a26, 0xd7a07c];
    const hairs = [0x1c140f, 0x5a4330, 0x2a2a2a, 0x8a7a60, 0xb8a27a, 0x6b2f1a, 0x9a9a9a];
    const clothes = [0x2c3e50, 0x7a2e2e, 0x3d5a40, 0x8c8c8c, 0x1f1f24, 0x6a5a8a, 0xb8864b, 0x24527a];
    const headGeo = new THREE.SphereGeometry(0.11, 24, 18);
    const hairGeo = new THREE.SphereGeometry(0.116, 24, 18);
    const earGeo = new THREE.SphereGeometry(0.02, 8, 6);
    const neckGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.14, 10);
    const shoulderGeo = new THREE.CapsuleGeometry(0.085, 0.26, 4, 10).rotateZ(Math.PI / 2);
    const torsoGeo = new RoundedBoxGeometry(0.38, 0.6, 0.24, 2, 0.08);
    const armGeo = new THREE.CapsuleGeometry(0.042, 0.28, 4, 8).rotateX(Math.PI / 2);
    const phonesGeo = new THREE.TorusGeometry(0.12, 0.012, 6, 20, Math.PI);
    const cupGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.035, 14).rotateZ(Math.PI / 2);
    const taken = new Set();
    for (let k = 0; k < 26; k++) {
      const r = 1 + Math.floor(rnd() * 13), ci = Math.floor(rnd() * cols.length);
      if (taken.has(r * 10 + ci)) continue;
      taken.add(r * 10 + ci);
      const x = cols[ci], z = -r * 0.95 + 4;
      const skinM = new THREE.MeshStandardMaterial({ color: skins[Math.floor(rnd() * skins.length)], roughness: 0.75 });
      const hairM = new THREE.MeshStandardMaterial({ color: hairs[Math.floor(rnd() * hairs.length)], roughness: 0.9 });
      const clothM = new THREE.MeshStandardMaterial({ color: clothes[Math.floor(rnd() * clothes.length)], map: cloth.map, roughness: 0.9 });
      const p = new THREE.Group();
      p.position.set(x, -0.36, z);
      const torso = new THREE.Mesh(torsoGeo, clothM); torso.position.set(0, 0.7, 0.04);
      const sh = new THREE.Mesh(shoulderGeo, clothM); sh.position.set(0, 0.98, 0.05);
      const neck = new THREE.Mesh(neckGeo, skinM); neck.position.set(0, 1.08, 0.04);
      const head = new THREE.Group(); head.position.set(0, 1.22, 0.03);
      const face = new THREE.Mesh(headGeo, skinM); face.scale.set(0.88, 1.08, 0.98);
      head.add(face);
      if (rnd() > 0.1) { const hair = new THREE.Mesh(hairGeo, hairM); hair.scale.set(0.92, 1.0, 0.95); hair.position.set(0, 0.022, 0.014); head.add(hair); } // seen from behind: hair covers the back and top
      for (const ex of [-1, 1]) { const ear = new THREE.Mesh(earGeo, skinM); ear.position.set(ex * 0.098, -0.005, 0.01); head.add(ear); }
      if (rnd() < 0.25) {
        const ph = new THREE.Mesh(phonesGeo, plasticDark); ph.position.y = 0.01; head.add(ph);
        for (const ex of [-1, 1]) { const cup = new THREE.Mesh(cupGeo, plasticDark); cup.position.set(ex * 0.115, 0.0, 0.0); head.add(cup); }
      }
      if (rnd() < 0.3) head.rotation.z = (x > 0 ? 1 : -1) * (0.2 + rnd() * 0.2); // dozing against the wall side
      p.add(torso, sh, neck, head);
      if (Math.abs(x) < 0.6 && rnd() < 0.6) { const arm = new THREE.Mesh(armGeo, clothM); arm.position.set(-Math.sign(x) * 0.25, 0.47, -0.04); p.add(arm); }
      p.userData.brace = 0.6 + rnd() * 0.3;
      s.add(p);
      this.passengers.push(p);
    }

    // lights
    this.ambient = new THREE.AmbientLight(0x8090a0, 0.55);
    s.add(this.ambient);
    this.cabinLights = [];
    for (let k = 0; k < 6; k++) {
      const l = new THREE.PointLight(0xffe0b0, 3.2, 7, 1.6);
      l.position.set(0, 2.1, 3 - k * 3.2);
      s.add(l);
      this.cabinLights.push(l);
    }
    this.redLight = new THREE.PointLight(0xff2010, 0, 14, 1.4);
    this.redLight.position.set(0, 1.5, -3);
    s.add(this.redLight);
    this.flash = new THREE.PointLight(0xbfd8ff, 0, 12, 1.2);
    this.flash.position.set(2.2, 1.0, 0);
    s.add(this.flash);
    this.wingLight = new THREE.PointLight(0xff3030, 0, 4, 2);
    this.wingLight.position.set(2.6, 0.9, 1.5);
    s.add(this.wingLight);
  }

  resize() {
    this.cabinCam.aspect = innerWidth / innerHeight;
    this.cabinCam.updateProjectionMatrix();
    this.ext.resize();
  }

  start(onDone) {
    this.onDone = onDone;
    this.t = 0;
    this.running = true;
    this.outside = true;
    this.fired = new Set();
    this.signOn = this.emergency = this.masksDown = this.blackout = this.bracing = false;
    this.lightning = 0;
    for (const mk of this.masks) { mk.cur = 0; mk.mask.visible = mk.tube.visible = false; }
    this.audio.startCabin();
    this.ui.fade(1, 0);
    this.ui.fade(0, 2.2);
  }

  at(time, key, fn) {
    if (this.t >= time && !this.fired.has(key)) { this.fired.add(key); fn(); }
  }

  finish() {
    if (!this.running) return;
    this.running = false;
    this.audio.stopCabin(true);
    this.audio.stopSpeech();
    this.ui.subtitle(null);
    this.onDone && this.onDone();
  }

  update(dt) {
    if (!this.running) return;
    this.t += dt;
    const t = this.t;
    const ui = this.ui, a = this.audio;

    // ---------------- outside shot
    this.at(0.3, 'card', () => ui.titleCard(T('Flight NV-2207 · 02:14 · over the Pacific Ocean'), T('Three hours to go. A vacation, finally.')));
    this.at(3.4, 'strike', () => { this.ext.strike(); a.noiseBurst(2.2, 0.3, 'lowpass', 180, 0.35); });
    this.at(5.0, 'bump', () => { this.ext.bump(); a.thump(0.3); });
    this.at(CUT, 'cut', () => { this.outside = false; });
    if (this.outside) { this.ext.update(t, dt); a.cabinIntensity(0.05); return; }

    // ---------------- cabin timeline
    const T0 = CABIN_T0;
    this.at(T0 + 5.5, 'belt', () => { a.seatbelt(); this.signOn = true; });
    this.at(T0 + 6.6, 'thought1', () => ui.subtitle(T('Just another air pocket...'), 'thought'));
    this.at(T0 + 9.6, 'jolt', () => { a.thump(0.6); ui.subtitle(null); this.lightning = 1; });
    this.at(T0 + 11.2, 'pa', () => {
      a.chime(); a.radio(5.5);
      ui.subtitle('“Ladies and gentlemen, this is the captain. We have lost several systems. Return to your seats and fasten your seatbelts — now.”', 'pa');
      setTimeout(() => this.running && a.speak('Ladies and gentlemen, this is the captain. We have lost several systems. Return to your seats and fasten your seatbelts. Now.'), 900);
    });
    this.at(T0 + 17.2, 'dark', () => { this.emergency = true; a.alarm(5); a.thump(0.5); ui.subtitle(null); this.masksDown = true; });
    this.at(T0 + 19.4, 'brace', () => {
      ui.subtitle('“BRACE! BRACE! BRACE!”', 'pa');
      a.speak('Brace! Brace! Brace!');
      this.bracing = true;
    });
    this.at(T0 + 22.6, 'impact', () => { a.crash(); ui.flashWhite(); ui.subtitle(null); this.blackout = true; a.stopCabin(true); });
    this.at(T0 + 24.2, 'ring', () => a.tinnitus(5));
    this.at(T0 + 25.0, 'dots', () => ui.subtitle('...', 'thought'));
    this.at(T0 + 28.5, 'end', () => this.finish());

    // ---------------- intensity curves (cabin time)
    const tc = t - T0;
    const turb = tc < 5.5 ? 0.004 : tc < 9.6 ? 0.012 : tc < 17 ? 0.035 : tc < 21 ? 0.07 : 0.16;
    a.cabinIntensity(Math.min(1, turb * 8));
    const shake = turb * (0.6 + 0.4 * Math.sin(t * 31));
    const cam = this.cabinCam;
    const dive = Math.max(0, tc - 20.5) * 0.18;
    cam.position.set(0.24 + Math.sin(t * 23.1) * shake, 1.06 + Math.sin(t * 29.7) * shake * 1.3 + Math.sin(t * 0.6) * 0.01, 4.1 + Math.sin(t * 17.3) * shake * 0.5);
    cam.rotation.set(-0.1 - dive * 0.6 + Math.sin(t * 21) * shake * 0.6, -0.12 + Math.sin(t * 0.25) * 0.08, Math.sin(t * 13) * shake * 1.5 + dive * 0.9, 'YXZ');

    // lights
    let lightK = 1;
    if (tc > 9.6 && tc < 17.2) lightK = Math.random() < 0.15 + (tc - 9.6) * 0.03 ? 0.15 : 1;
    if (this.emergency) lightK = Math.random() < 0.06 ? 0.4 : 0.04;
    if (this.blackout) lightK = 0;
    this.cabinLights.forEach((l) => (l.intensity = 3.2 * lightK));
    this.stripMat.emissiveIntensity = 1.2 * lightK;
    this.ambient.intensity = this.blackout ? 0 : 0.15 + 0.4 * lightK;
    this.signMat.emissiveIntensity = this.signOn && !this.blackout ? 2 : 0;
    this.readOnMat.emissiveIntensity = 2.2 * Math.min(1, lightK * 1.5);
    this.screenMat.emissiveIntensity = this.emergency || this.blackout ? 0 : 0.9 * (lightK < 0.5 ? 0.3 : 1);
    this.exitMat.emissiveIntensity = this.blackout ? 0 : 1.6;
    this.redLight.intensity = this.emergency && !this.blackout ? 3 + Math.sin(t * 9) * 2.5 : 0;
    this.emMat.emissiveIntensity = this.emergency && !this.blackout ? 2.5 : 0;
    this.wingLight.intensity = !this.blackout && (t % 1.6) < 0.12 ? 4 : 0;
    // lightning in the windows
    if (tc > 9 && !this.blackout && Math.random() < 0.012) this.lightning = 1;
    this.lightning = (this.lightning || 0) * Math.pow(0.02, dt);
    this.flash.intensity = this.lightning * 18;
    this.winMat.emissiveIntensity = 0.35 + this.lightning * 6;

    // passengers fold forward into the brace position
    for (const p of this.passengers) {
      const target = this.bracing ? -p.userData.brace : Math.sin(t * 7 + p.position.z) * turb * 0.6;
      p.rotation.x += (target - p.rotation.x) * Math.min(1, dt * (this.bracing ? 4 : 10));
    }

    // masks
    if (this.masksDown) {
      for (const mk of this.masks) {
        mk.mask.visible = mk.tube.visible = !this.blackout;
        mk.cur = Math.min(mk.drop, (mk.cur || 0) + dt * 3);
        const sway = Math.sin(t * 5 + mk.phase) * 0.08 * (1 + turb * 10);
        mk.mask.position.y = mk.top - mk.cur;
        mk.mask.position.x = mk.tube.geometry.attributes.position.getX(0) + sway;
        const p = mk.tube.geometry.attributes.position;
        p.setXYZ(1, mk.mask.position.x, mk.mask.position.y + 0.05, mk.mask.position.z);
        p.needsUpdate = true;
      }
    }
  }
}
