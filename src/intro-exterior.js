// Opening establishing shot: the airliner seen from outside, flying through a night storm.
// Own scene (fog, lights, background) so it does not touch the cabin; the plane stays at the origin
// and the clouds and rain stream past it.
import * as THREE from 'three';
import { tileFbm, panelTex } from './gfx/textures.js';
import { mulberry32 } from './noise.js';

const R = 2.0, LEN = 38, HALF = LEN / 2; // fuselage radius and length, nose at +z
const WIN_Z0 = -12, WIN_Z1 = 12.4, WIN_STEP = 0.55;
const WIN_PHI = 0.28; // window row above the side line

// fuselage radius along the body (y = lathe axis, later z)
function radiusAt(y) {
  if (y > 13.5) { const s = (y - 13.5) / (HALF - 13.5); return R * Math.pow(Math.max(0, 1 - Math.pow(s, 2.2)), 0.5); }
  if (y < -9) { const s = (-9 - y) / (HALF - 9); return R * (1 - 0.8 * Math.pow(s, 1.3)); }
  return R;
}

// livery painted in lathe UV space: u = angle (0 = belly, 0.25 = right side, 0.5 = top), v = along the body (0 = tail)
function liveryTextures() {
  const W = 1024, H = 2048;
  const make = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return { cv, c: cv.getContext('2d') }; };
  const col = make(), emi = make();
  const c = col.c, e = emi.c;
  const X = (phi) => (phi / (Math.PI * 2)) * W;
  const Y = (z) => (1 - (z + HALF) / LEN) * H;
  const pxAround = W / (Math.PI * 2 * R), pxAlong = H / LEN;
  c.fillStyle = '#eeeeea'; c.fillRect(0, 0, W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  // grey belly (wraps the u = 0 seam)
  c.fillStyle = '#a9adb2';
  c.fillRect(0, 0, X(0.95), H); c.fillRect(X(Math.PI * 2 - 0.95), 0, W, H);
  const band = (p0, p1, color, z0 = -15.5, z1 = 17.6) => { c.fillStyle = color; c.fillRect(X(Math.min(p0, p1)), Y(z1), Math.abs(X(p1) - X(p0)), Y(z0) - Y(z1)); };
  // sides: [window angle, sign of "up" in u]
  const sides = [[Math.PI / 2 + WIN_PHI, 1], [Math.PI * 1.5 - WIN_PHI, -1]];
  for (const [pw, up] of sides) {
    band(pw - up * 0.55, pw - up * 0.3, '#1d4373');
    band(pw - up * 0.62, pw - up * 0.58, '#b8352c');
    // cabin windows: grey frame on the skin, warm light in the emissive map
    const ww = 0.25 * pxAlong, wh = 0.36 * pxAround;
    for (let z = WIN_Z0; z <= WIN_Z1; z += WIN_STEP) {
      if (Math.abs(z - 9.6) < 0.7 || Math.abs(z + 6.2) < 0.5) continue; // door / over-wing exit gap
      const cx = X(pw), cy = Y(z);
      c.fillStyle = '#9aa0a8'; roundRect(c, cx - wh / 2 - 3, cy - ww / 2 - 3, wh + 6, ww + 6, 6); c.fill();
      c.fillStyle = '#1a2230'; roundRect(c, cx - wh / 2, cy - ww / 2, wh, ww, 5); c.fill();
      const shade = Math.random() < 0.25; // a few blinds pulled down
      e.fillStyle = shade ? '#3a2a18' : (Math.random() < 0.15 ? '#ffc890' : '#ffdcaa');
      roundRect(e, cx - wh / 2, cy - ww / 2, wh, ww, 5); e.fill();
    }
    // doors
    c.strokeStyle = 'rgba(60,64,70,0.8)'; c.lineWidth = 2;
    for (const z of [15.2, 9.6, -13.6]) c.strokeRect(X(pw - up * 0.15) - 0.95 * pxAround, Y(z + 0.5), 1.9 * pxAround, 1.0 * pxAlong);
    // titles above the windows and the flight number by the tail
    text(c, 'MERIDIAN', X(pw + up * 0.5), Y(up > 0 ? 7.4 : -1.6), 0.95 * pxAround, up, pxAlong / pxAround, '#1d4373', '900');
    text(c, 'NV-2207', X(pw + up * 0.1), Y(up > 0 ? -13.0 : -15.4), 0.28 * pxAround, up, pxAlong / pxAround, '#3a3f46', 'bold');
  }
  // cockpit windows: dark glass wrapping the top of the nose, a faint instrument glow behind
  for (const k of [-1, 1]) for (let i = 0; i < 3; i++) {
    const phi = Math.PI + k * (0.22 + i * 0.36);
    c.fillStyle = '#12161d';
    c.save(); c.translate(X(phi), Y(16.35 - i * 0.12)); c.beginPath();
    c.moveTo(-0.28 * pxAround, -0.42 * pxAlong); c.lineTo(0.28 * pxAround, -0.36 * pxAlong); c.lineTo(0.3 * pxAround, 0.4 * pxAlong); c.lineTo(-0.3 * pxAround, 0.42 * pxAlong); c.closePath(); c.fill(); c.restore();
    e.fillStyle = 'rgba(90,120,90,0.25)'; e.fillRect(X(phi) - 0.2 * pxAround, Y(16.35 - i * 0.12) - 0.3 * pxAlong, 0.4 * pxAround, 0.6 * pxAlong);
  }
  // grime streaks
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(80,76,70,${0.02 + Math.random() * 0.04})`;
    c.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 8 + Math.random() * 40);
  }
  const tex = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: tex(col.cv, true), emissiveMap: tex(emi.cv, true) };
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// text running along the body: baseline along the canvas y axis, glyph up towards the top of the plane
function text(c, str, x, y, sizePx, up, squash, color, weight) {
  c.save();
  c.translate(x, y);
  c.rotate(up > 0 ? Math.PI / 2 : -Math.PI / 2);
  c.scale(squash, 1);
  c.fillStyle = color;
  c.font = `${weight} ${Math.round(sizePx)}px Arial`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(str, 0, 0);
  c.restore();
}

function finTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const c = cv.getContext('2d');
  c.fillStyle = '#1d4373'; c.fillRect(0, 0, 512, 512);
  c.fillStyle = '#b8352c'; c.fillRect(0, 470, 512, 42);
  // globe-and-wave logo, symmetric so it reads on both sides of the fin
  c.strokeStyle = '#f2f2f2'; c.lineWidth = 16;
  c.beginPath(); c.arc(300, 230, 82, 0, Math.PI * 2); c.stroke();
  c.beginPath();
  for (let i = 0; i <= 40; i++) { const x = 222 + i * 3.9, y = 232 + Math.sin((i / 40) * Math.PI * 2) * 22; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// soft, lumpy cloud puff with an alpha falloff
function cloudTexture(seed) {
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const n = tileFbm(S, 4, 5, seed);
  const id = c.createImageData(S, S), d = id.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, dx = x / S - 0.5, dy = (y / S - 0.5) * 1.25;
    const r = Math.sqrt(dx * dx + dy * dy) * 2;
    const a = Math.max(0, Math.min(1, (1 - r) * 1.6 + (n[i] - 0.5) * 1.8 - 0.25));
    const shade = 0.7 + n[i] * 0.3 - Math.max(0, dy) * 0.4; // darker, flatter underside
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255 * shade;
    d[i * 4 + 3] = 255 * a * a;
  }
  c.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

function wingGeometry(rootChord, tipChord, span, sweep, thick) {
  const s = new THREE.Shape();
  s.moveTo(0, rootChord * 0.5);
  s.lineTo(span, rootChord * 0.5 - sweep);
  s.lineTo(span, rootChord * 0.5 - sweep - tipChord);
  s.lineTo(0, -rootChord * 0.5);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelSize: thick * 0.4, bevelThickness: thick * 0.4, bevelSegments: 2 });
  g.translate(0, 0, -thick / 2);
  g.rotateX(Math.PI / 2); // shape y -> -z (chord), extrusion -> y (thickness)
  return g;
}

function buildAirliner() {
  const plane = new THREE.Group();
  const panel = panelTex();
  const skinN = panel.normalMap.clone();
  skinN.repeat.set(6, 12); skinN.needsUpdate = true;
  const { map, emissiveMap } = liveryTextures();

  // fuselage: lathe along y, turned so the nose points to +z; the tail cone sweeps up
  const pts = [];
  const N = 90;
  for (let i = 0; i <= N; i++) { const y = -HALF + (i / N) * LEN; pts.push(new THREE.Vector2(Math.max(0.02, radiusAt(y)), y)); }
  const body = new THREE.LatheGeometry(pts, 64);
  body.rotateX(Math.PI / 2);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    if (z < -9) p.setY(i, p.getY(i) + Math.pow((-9 - z) / (HALF - 9), 1.5) * 1.3);
    if (z > 13.5) p.setY(i, p.getY(i) - Math.pow((z - 13.5) / (HALF - 13.5), 2) * 0.45); // nose droops slightly
  }
  body.computeVertexNormals();
  const skin = new THREE.MeshStandardMaterial({
    map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.3, normalMap: skinN, normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.38, metalness: 0.05, side: THREE.DoubleSide,
  });
  plane.add(new THREE.Mesh(body, skin));

  // wing UVs are in metres (extrude caps), so the panel pattern is scaled up to plate size
  const wingMap = panel.map.clone(), wingN = panel.normalMap.clone();
  for (const tx of [wingMap, wingN]) { tx.repeat.set(0.18, 0.18); tx.needsUpdate = true; }
  const grey = new THREE.MeshStandardMaterial({ color: 0xdfe2e6, roughness: 0.42, metalness: 0.05, map: wingMap, normalMap: wingN, normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.DoubleSide });
  // wings with a little dihedral, winglets at the tips
  for (const sd of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeometry(7.2, 1.7, 16, 8.5, 0.42), grey);
    wing.scale.x = sd;
    wing.position.set(sd * 1.2, -1.15, -0.4);
    wing.rotation.z = sd * 0.08;
    plane.add(wing);
    const winglet = new THREE.Mesh(wingGeometry(1.4, 0.55, 1.6, 0.9, 0.1), grey);
    winglet.position.set(sd * 17.1, 0.15, -6.1);
    winglet.rotation.set(0, 0, sd * (Math.PI / 2 - 0.25));
    winglet.scale.x = sd;
    plane.add(winglet);
    // engine on a pylon under the wing
    const eng = new THREE.Group();
    const nacPts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; nacPts.push(new THREE.Vector2(0.95 + Math.sin(t * Math.PI) * 0.22 - t * 0.35, -2.2 + t * 4.4)); }
    const nac = new THREE.LatheGeometry(nacPts, 28);
    nac.rotateX(Math.PI / 2);
    eng.add(new THREE.Mesh(nac, new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.35, metalness: 0.15, side: THREE.DoubleSide })));
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.92, 24), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, metalness: 0.4 }));
    fan.position.z = 1.9;
    eng.add(fan);
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.3, metalness: 0.6 }));
    spinner.rotation.x = Math.PI / 2; spinner.position.z = 2.05;
    eng.add(spinner);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 3.2), grey);
    pylon.position.set(0, 0.95, -0.4);
    eng.add(pylon);
    eng.position.set(sd * 5.6, -2.3, 1.6);
    plane.add(eng);
  }
  // tailplane
  for (const sd of [-1, 1]) {
    const hs = new THREE.Mesh(wingGeometry(3.6, 1.2, 6.2, 3.2, 0.22), grey);
    hs.scale.x = sd;
    hs.position.set(sd * 0.4, 0.75, -15.6);
    hs.rotation.z = sd * 0.12;
    plane.add(hs);
  }
  // fin: shape in the y/z plane, painted navy with the logo
  const fs = new THREE.Shape();
  fs.moveTo(0, 0); fs.lineTo(6.4, 0); fs.lineTo(7.9, 6.8); fs.lineTo(5.9, 6.8); fs.closePath();
  const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.3, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2 });
  fg.translate(0, 0, -0.15);
  fg.rotateY(Math.PI / 2); // shape x -> -z, extrusion -> x
  const ft = finTexture();
  ft.repeat.set(1 / 8, 1 / 7);
  const fin = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: ft, roughness: 0.4, metalness: 0.05 }));
  fin.position.set(0, 1.3, -11.6);
  plane.add(fin);

  // navigation lights: red left tip, green right tip, white strobes, red beacons
  const glow = glowTexture();
  const light = (color, size, x, y, z) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.scale.setScalar(size);
    s.position.set(x, y, z);
    plane.add(s);
    return s;
  };
  const navL = light(0xff2a20, 2.2, -17.2, 0.2, -5.4);
  const navR = light(0x30ff60, 2.2, 17.2, 0.2, -5.4);
  const strobes = [light(0xffffff, 5, -17.2, 0.2, -7.0), light(0xffffff, 5, 17.2, 0.2, -7.0), light(0xffffff, 3.5, 0, 1.3, -HALF + 0.1)];
  const beacons = [light(0xff1a10, 2.6, 0, R + 0.1, -2), light(0xff1a10, 2.6, 0, -R - 0.1, 1)];
  const beaconLight = new THREE.PointLight(0xff2010, 0, 14, 2);
  beaconLight.position.set(0, R + 0.6, -2);
  plane.add(beaconLight);
  return { plane, skin, navL, navR, strobes, beacons, beaconLight };
}

export function buildExterior() {
  const scene = new THREE.Scene();
  const sky = new THREE.Color(0x0b111b);
  scene.background = sky.clone();
  scene.fog = new THREE.FogExp2(0x0b111b, 0.0042);
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 900);

  const hemi = new THREE.HemisphereLight(0x5a6c8c, 0x07090d, 1.1);
  const moon = new THREE.DirectionalLight(0x9fb4dd, 0.9);
  moon.position.set(-40, 80, 20);
  const flash = new THREE.DirectionalLight(0xd8e6ff, 0);
  flash.position.set(-60, 30, 40);
  scene.add(hemi, moon, flash);

  const ac = buildAirliner();
  scene.add(ac.plane);

  // clouds: large puffs streaming backwards past the plane
  const cloudMats = [11, 12, 13].map((seed, i) => new THREE.SpriteMaterial({
    map: cloudTexture(900 + seed), color: new THREE.Color().setHSL(0.6, 0.12, 0.2 + i * 0.03), transparent: true, depthWrite: false, opacity: 0.9,
  }));
  const clouds = [];
  const rnd = mulberry32(77);
  for (let i = 0; i < 170; i++) {
    const s = new THREE.Sprite(cloudMats[i % 3]);
    let x, y;
    do { x = -120 + rnd() * 380; y = (rnd() - 0.5) * 120 - 10; } while (x < 70 && y > -25 && y < 28);
    s.position.set(x, y, (rnd() - 0.5) * 640);
    const k = 26 + rnd() * 60;
    s.scale.set(k * 1.5, k, 1);
    s.material.rotation = rnd() * 6;
    scene.add(s);
    clouds.push(s);
  }
  // thin wisps close to the plane, for the sense of speed
  const wispMat = new THREE.SpriteMaterial({ map: cloudMats[0].map, color: 0x2a3344, transparent: true, depthWrite: false, opacity: 0.45 });
  for (let i = 0; i < 30; i++) {
    const s = new THREE.Sprite(wispMat);
    s.position.set(-5 + rnd() * 65, rnd() < 0.5 ? -22 + rnd() * 15 : 8 + rnd() * 12, (rnd() - 0.5) * 640);
    const k = 12 + rnd() * 18;
    s.scale.set(k * 2, k * 0.7, 1);
    scene.add(s);
    clouds.push(s);
  }
  // a cloud deck far below
  const deckTex = cloudTexture(950);
  deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping;
  deckTex.repeat.set(14, 14);
  const deckMat = new THREE.MeshBasicMaterial({ map: deckTex, color: 0x1a2230, transparent: true, opacity: 0.85, depthWrite: false });
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = -70;
  scene.add(deck);

  // rain streaks around the camera
  const RAIN = 1400;
  const rainPos = new Float32Array(RAIN * 6);
  const rainSeed = new Float32Array(RAIN * 3);
  for (let i = 0; i < RAIN; i++) { rainSeed[i * 3] = (rnd() - 0.5) * 60; rainSeed[i * 3 + 1] = (rnd() - 0.5) * 36; rainSeed[i * 3 + 2] = rnd() * 80; }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0x8796ad, transparent: true, opacity: 0.35, fog: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  // lightning bolt: jagged tube far off to the side, visible for a few frames
  const boltPts = [];
  let bx = 0, by = 60;
  for (let i = 0; i < 14; i++) { boltPts.push(new THREE.Vector3(bx, by, 0)); bx += (rnd() - 0.5) * 14; by -= 9 + rnd() * 4; }
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
  const bolt = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(boltPts, false, 'catmullrom', 0.1), 80, 0.7, 5), boltMat);
  bolt.position.set(150, -5, 110);
  scene.add(bolt);

  let lightning = 0, boltT = 0, jolt = 0;
  const tmp = new THREE.Vector3();
  const look = new THREE.Vector3();
  return {
    scene, camera,
    strike() { lightning = 1; boltT = 0.18; },
    bump() { jolt = 1; },
    resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); },
    update(t, dt) {
      // plane: gentle bank and bob, a hard drop on the bump
      jolt *= Math.pow(0.05, dt);
      const pl = ac.plane;
      pl.position.y = Math.sin(t * 0.9) * 0.35 - jolt * 1.4 * Math.sin(Math.min(1, (1 - jolt) * 3) * Math.PI);
      pl.rotation.set(Math.sin(t * 0.7) * 0.015 + jolt * 0.05, 0, Math.sin(t * 0.5) * 0.05 + Math.sin(t * 2.3) * 0.012 + jolt * 0.12 * Math.sin(t * 18));

      // camera: rear quarter, dollying forward along the left side towards the wing
      const k = Math.min(1, t / 6.4), e = k * k * (3 - 2 * k);
      camera.position.set(-34 + e * 10, 9 - e * 6.2, -40 + e * 44);
      const shake = 0.06 + jolt * 0.5;
      camera.position.x += Math.sin(t * 13.1) * shake; camera.position.y += Math.sin(t * 17.3) * shake;
      look.set(0, 0.2 - e * 0.4, -4 + e * 10);
      camera.lookAt(look);

      // clouds and rain stream back (the plane is doing ~250 m/s; the clouds are scaled down so 70 reads right)
      for (const s of clouds) { s.position.z -= 70 * dt; if (s.position.z < -320) s.position.z += 640; }
      for (let i = 0; i < RAIN; i++) {
        const z = ((rainSeed[i * 3 + 2] - t * 90) % 80 + 80) % 80 - 40;
        tmp.set(rainSeed[i * 3], rainSeed[i * 3 + 1], z).add(camera.position);
        rainPos[i * 6] = tmp.x; rainPos[i * 6 + 1] = tmp.y; rainPos[i * 6 + 2] = tmp.z;
        rainPos[i * 6 + 3] = tmp.x; rainPos[i * 6 + 4] = tmp.y + 0.35; rainPos[i * 6 + 5] = tmp.z + 2.6;
      }
      rainGeo.attributes.position.needsUpdate = true;

      // lightning: random distant flickers plus the scripted strikes
      if (Math.random() < dt * 0.35) lightning = Math.max(lightning, 0.35 + Math.random() * 0.3);
      lightning *= Math.pow(0.015, dt);
      const flick = lightning * (0.6 + 0.4 * Math.sin(t * 70));
      flash.intensity = flick * 9;
      boltT -= dt;
      boltMat.opacity = boltT > 0 ? 1 : 0;
      for (const m of cloudMats) m.color.setHSL(0.6, 0.12, 0.2 + flick * 0.55);
      wispMat.color.setHSL(0.6, 0.15, 0.22 + flick * 0.5);
      scene.background.copy(sky).lerp(new THREE.Color(0x3a4a66), flick * 0.6);
      deckMat.color.setHex(0x1a2230).lerp(new THREE.Color(0x6a7a96), flick * 0.6);

      // lights: strobes double-flash, beacons pulse, cabin windows flicker on the bump
      const st = t % 1.3;
      const strobeOn = st < 0.05 || (st > 0.14 && st < 0.19);
      ac.strobes.forEach((s) => (s.visible = strobeOn));
      const bc = Math.max(0, Math.sin(t * Math.PI * 1.1)) ** 6;
      ac.beacons.forEach((s) => (s.material.opacity = bc));
      ac.beaconLight.intensity = bc * 8;
      ac.skin.emissiveIntensity = 1.3 * (jolt > 0.5 && Math.random() < 0.4 ? 0.3 : 1);
    },
  };
}
