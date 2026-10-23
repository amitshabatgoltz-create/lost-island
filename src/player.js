// Third-person survivor: procedural model, walk animation, collision and orbit camera.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { shirtTex, twillTex, clothTex } from './gfx/textures.js';

const tmpV = new THREE.Vector3();

function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough });
}
// cloth and skin get a soft sheen: fabric fuzz, and a warm rim that reads like light through skin
const cloth = (tex, color, rough = 0.92, sheen = 0x9fb4c8) => new THREE.MeshPhysicalMaterial({
  color, roughness: rough, map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.8, 0.8),
  sheen: 0.22, sheenRoughness: 0.8, sheenColor: new THREE.Color(sheen),
});
const rbox = (w, h, d, r, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, r);

function jitter(geo, amount, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 37 + seed) * Math.sin(y * 41 + seed * 2) * Math.sin(z * 29 + seed * 3);
    p.setXYZ(i, x * (1 + n * amount), y * (1 + n * amount), z * (1 + n * amount));
  }
  geo.computeVertexNormals();
  return geo;
}

function buildSurvivor() {
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xc8957a, roughness: 0.55, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xff9a7a) });
  const shirtT = shirtTex(), twill = twillTex();
  const shirt = cloth(shirtT, 0xffffff), shirtDirty = cloth(shirtT, 0xc9cdd2);
  const pants = cloth(twill, 0xffffff, 0.95, 0x9a8f78);
  const leather = mat(0x3d2b1f, 0.62), sole = mat(0x1c1915, 0.85), hair = mat(0x2a1c13, 0.72);
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobbing part
  root.add(body);

  // torso: shirt over a lathe profile (hips -> waist -> chest -> shoulders); front of the shirt at u = 0.25
  const prof = [[0.05, 0.86], [0.19, 0.9], [0.185, 0.98], [0.172, 1.07], [0.19, 1.18], [0.212, 1.3], [0.214, 1.4], [0.195, 1.47], [0.15, 1.53], [0.075, 1.57]];
  const torsoGeo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y - 0.86)), 24, -Math.PI / 2);
  const torso = new THREE.Mesh(torsoGeo, shirt);
  torso.scale.set(1.12, 1, 0.7);
  torso.position.y = 0.86;
  body.add(torso);
  // torn, dirty hem hanging over the belt
  const hem = new THREE.Mesh(jitter(new THREE.CylinderGeometry(0.188, 0.196, 0.06, 18, 2, true), 0.05, 3), shirtDirty);
  hem.scale.set(1.13, 1, 0.71);
  hem.position.y = 0.94;
  body.add(hem);
  // collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 6, 16, Math.PI * 1.5), shirt);
  collar.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 0.25 + Math.PI);
  collar.scale.set(1.15, 0.9, 1);
  collar.position.set(0, 1.545, 0.0);
  body.add(collar);
  // belt + buckle
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.055, 18), mat(0x2b2420, 0.55));
  belt.scale.set(1.1, 1, 0.74);
  belt.position.y = 0.905;
  const buckle = new THREE.Mesh(rbox(0.06, 0.045, 0.012, 0.006), new THREE.MeshStandardMaterial({ color: 0xa8a59c, metalness: 0.9, roughness: 0.3 }));
  buckle.position.set(0, 0.905, 0.15);
  body.add(belt, buckle);
  // shoulder bag: strap across the chest, satchel on the left hip
  // strap: a closed loop hugging the chest and back, right shoulder -> left hip
  const strapPath = new THREE.CatmullRomCurve3([
    [0.15, 1.5, 0.0], [0.07, 1.36, 0.16], [-0.1, 1.13, 0.152], [-0.235, 0.98, 0.06],
    [-0.235, 0.98, -0.06], [-0.1, 1.13, -0.152], [0.07, 1.36, -0.15],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z)), true);
  const strap = new THREE.Mesh(new THREE.TubeGeometry(strapPath, 48, 0.012, 5, true), mat(0x4a3a28, 0.8));
  strap.scale.set(1, 1, 1.04);
  const satchel = new THREE.Mesh(rbox(0.24, 0.2, 0.08, 0.025), cloth(twill, 0x6b5a3e, 0.95));
  satchel.position.set(-0.27, 0.93, 0.02);
  satchel.rotation.y = -0.25;
  const flap = new THREE.Mesh(rbox(0.245, 0.09, 0.085, 0.02), cloth(twill, 0x5c4c34, 0.95));
  flap.position.set(-0.27, 1.0, 0.025);
  flap.rotation.y = -0.25;
  body.add(strap, satchel, flap);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.13, 12), skin);
  neck.position.y = 1.6;
  body.add(neck);

  // ------------------------------------------------------------ head
  const head = new THREE.Group();
  head.position.y = 1.74;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.128, 24, 18), skin);
  skull.scale.set(0.93, 1.13, 1.0);
  // jaw/chin
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), skin);
  jaw.scale.set(0.95, 0.75, 0.95);
  jaw.position.set(0, -0.06, 0.025);
  const stubble = new THREE.Mesh(new THREE.SphereGeometry(0.102, 16, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.45), mat(0x6a4c3a, 0.95));
  stubble.scale.copy(jaw.scale);
  stubble.position.copy(jaw.position);
  stubble.rotation.x = 0.35;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), skin);
  nose.scale.set(0.85, 1.25, 1.1);
  nose.position.set(0, -0.005, 0.128);
  const ears = [-1, 1].map((sd) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), skin);
    e.scale.set(0.45, 1, 0.75);
    e.position.set(sd * 0.118, 0.0, 0.0);
    return e;
  });
  const white = mat(0xeee9e2, 0.25), iris = mat(0x3a2a1c, 0.2), brow = mat(0x241810, 0.9);
  const eyes = [-1, 1].map((sd) => {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), iris);
    pupil.position.z = 0.011;
    const b = new THREE.Mesh(rbox(0.04, 0.009, 0.012, 0.004), brow);
    b.position.set(0, 0.026, 0.008);
    b.rotation.z = sd * -0.12;
    g.add(ball, pupil, b);
    g.position.set(sd * 0.044, 0.028, 0.112);
    return g;
  });
  const mouth = new THREE.Mesh(rbox(0.045, 0.008, 0.01, 0.003), mat(0x7a4a3e, 0.6));
  mouth.position.set(0, -0.058, 0.118);
  // tousled hair: a cap plus clumps
  const hairGroup = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.136, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), hair);
  cap.scale.set(0.96, 1.1, 1.03);
  cap.position.y = 0.022;
  cap.rotation.x = -0.28;
  hairGroup.add(cap);
  const clumps = [[0, 0.12, 0.04, 0.06], [0.06, 0.11, 0.06, 0.05], [-0.06, 0.11, 0.06, 0.05], [0.03, 0.13, -0.02, 0.06], [-0.04, 0.12, -0.05, 0.06],
    [0.09, 0.06, -0.03, 0.05], [-0.09, 0.06, -0.03, 0.05], [0, 0.08, -0.1, 0.06], [0.05, 0.1, 0.09, 0.04], [-0.03, 0.1, 0.1, 0.04]];
  clumps.forEach(([x, y, z, r], i) => {
    const c = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(r, 1), 0.25, i * 3 + 1), hair);
    c.position.set(x, y, z);
    c.scale.set(1, 0.7, 1.15);
    c.rotation.set(i * 0.7, i * 1.3, 0);
    hairGroup.add(c);
  });
  const cut = new THREE.Mesh(rbox(0.045, 0.01, 0.008, 0.003), mat(0x7a1e1e, 0.5));
  cut.position.set(0.058, 0.075, 0.117);
  cut.rotation.z = 0.5;
  head.add(skull, jaw, stubble, nose, ...ears, ...eyes, mouth, hairGroup, cut);
  body.add(head);

  // ------------------------------------------------------------ limbs (pivot -> knee/elbow -> lower)
  function limb(upperMat, lowerMat, upperLen, lowerLen, r) {
    const pivot = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(r, upperLen, 4, 12), upperMat);
    upper.position.y = -upperLen / 2 - r * 0.3;
    pivot.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -upperLen - r * 0.5;
    pivot.add(knee);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.86, lowerLen, 4, 12), lowerMat);
    lower.position.y = -lowerLen / 2 - r * 0.3;
    knee.add(lower);
    return { pivot, knee, lower, upper };
  }
  // arms: bare skin with short (rolled) sleeves
  const armL = limb(skin, skin, 0.24, 0.24, 0.05);
  const armR = limb(skin, skin, 0.24, 0.24, 0.05);
  armL.pivot.position.set(-0.27, 1.46, 0);
  armR.pivot.position.set(0.27, 1.46, 0);
  for (const [a, m, torn] of [[armL, shirt, false], [armR, shirtDirty, true]]) {
    const sleeve = new THREE.Mesh(torn ? jitter(new THREE.CylinderGeometry(0.058, 0.066, 0.16, 14, 2, true), 0.08, 7) : new THREE.CylinderGeometry(0.057, 0.064, 0.15, 14, 1, true), m);
    sleeve.position.y = -0.06;
    sleeve.material.side = THREE.DoubleSide;
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.063, 0.012, 6, 14), m);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.14;
    a.pivot.add(sleeve);
    if (!torn) a.pivot.add(cuff);
    // hand: palm + thumb
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(rbox(0.07, 0.09, 0.035, 0.016), skin);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.035, 3, 8), skin);
    thumb.position.set(a === armL ? 0.035 : -0.035, 0.0, 0.015);
    thumb.rotation.z = a === armL ? -0.5 : 0.5;
    hand.add(palm, thumb);
    hand.position.y = -0.34;
    a.knee.add(hand);
  }
  // wristwatch on the left wrist
  const watch = new THREE.Group();
  const wband = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 16), mat(0x1d1d1d, 0.6));
  wband.rotation.x = Math.PI / 2;
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), new THREE.MeshStandardMaterial({ color: 0xb8b8b0, metalness: 0.9, roughness: 0.25 }));
  face.rotation.z = Math.PI / 2;
  face.position.x = -0.045;
  watch.add(wband, face);
  watch.position.y = -0.27;
  armL.knee.add(watch);

  // legs: cargo trousers, the right leg torn off at the knee
  const legL = limb(pants, pants, 0.36, 0.36, 0.085);
  const legR = limb(pants, skin, 0.36, 0.36, 0.085);
  legL.pivot.position.set(-0.11, 0.92, 0);
  legR.pivot.position.set(0.11, 0.92, 0);
  for (const [lg, sd] of [[legL, -1], [legR, 1]]) {
    const pocket = new THREE.Mesh(rbox(0.05, 0.14, 0.12, 0.02), pants);
    pocket.position.set(sd * 0.075, -0.22, 0.0);
    lg.pivot.add(pocket);
    // shoe: rounded upper + sole
    const shoe = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.13, 4, 12), leather);
    upper.rotation.x = Math.PI / 2;
    upper.scale.set(1.05, 1, 0.75);
    upper.position.set(0, 0.035, 0.05);
    const so = new THREE.Mesh(rbox(0.13, 0.03, 0.28, 0.012), sole);
    so.position.set(0, -0.015, 0.05);
    const laces = new THREE.Mesh(rbox(0.05, 0.01, 0.08, 0.004), mat(0xb5aa96, 0.9));
    laces.position.set(0, 0.075, 0.06);
    shoe.add(upper, so, laces);
    shoe.position.set(0, -0.36 - 0.085 * 0.9 - 0.02, 0.01);
    lg.knee.add(shoe);
  }
  // ragged trouser edge at the right knee
  const rag = new THREE.Mesh(jitter(new THREE.CylinderGeometry(0.083, 0.088, 0.07, 14, 2, true), 0.12, 11), pants);
  rag.material = pants.clone();
  rag.material.side = THREE.DoubleSide;
  rag.position.y = 0.02;
  legR.knee.add(rag);
  body.add(armL.pivot, armR.pivot, legL.pivot, legR.pivot);

  // bandage (shown after it's collected)
  const bandage = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.1, 12), cloth(clothTex(), 0xf0ece2, 0.95, 0xffffff));
  bandage.position.y = -0.14;
  bandage.visible = false;
  armR.knee.add(bandage);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, body, head, armL, armR, legL, legR, bandage };
}

export class Player {
  constructor(scene, camera) {
    this.scene = scene;
    this.colliders = [];
    this.occluders = [];
    this.zone = null;
    this.camera = camera;
    this.model = buildSurvivor();
    scene.add(this.model.root);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.camDist = 4.6;
    this.curDist = 4.6;
    this.radius = 0.38;
    this.phase = 0;
    this.speed = 0;
    this.pickupT = 0;
    this.lying = 0; // 1 = lying on the sand, 0 = standing
    this.settings = { sens: 1, invertY: false };
    this.onBoundary = null;

    this.flashlight = new THREE.SpotLight(0xfff1d6, 0, 28, 0.42, 0.45, 1.2);
    this.flashlight.position.set(0.2, 1.3, 0.25);
    this.flashlight.target.position.set(0, 0.6, 6);
    this.model.root.add(this.flashlight, this.flashlight.target);
    this.flashlightOn = false;

    this.ray = new THREE.Raycaster();
  }

  // the active zone supplies ground height, bounds, colliders and camera occluders
  setZone(zone) {
    this.zone = zone;
    this.colliders = zone.colliders;
    this.occluders = zone.occluders;
  }

  heightAt(x, z) { return this.zone ? this.zone.heightAt(x, z) : 0; }

  setPosition(x, z, yaw = 0) {
    this.pos.set(x, this.heightAt(x, z), z);
    this.facing = yaw;
    this.camYaw = yaw + Math.PI;
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = yaw;
  }

  setFlashlight(on) {
    this.flashlightOn = on;
    this.flashlight.intensity = on ? 40 : 0;
  }

  showBandage(v) { this.model.bandage.visible = v; }

  playPickup() { this.pickupT = 0.55; }

  // rotate camera from mouse deltas
  look(dx, dy) {
    const s = 0.0024 * this.settings.sens;
    this.camYaw -= dx * s;
    this.camPitch += (this.settings.invertY ? -dy : dy) * s;
    this.camPitch = Math.max(-0.35, Math.min(1.15, this.camPitch));
  }

  forward() { return new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)); }

  update(dt, input, controlEnabled) {
    // ---------- movement
    let mx = 0, mz = 0;
    if (controlEnabled) {
      const f = (input.KeyW || input.ArrowUp ? 1 : 0) - (input.KeyS || input.ArrowDown ? 1 : 0);
      const r = (input.KeyD || input.ArrowRight ? 1 : 0) - (input.KeyA || input.ArrowLeft ? 1 : 0);
      const fw = this.forward();
      const rt = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
      mx = fw.x * f + rt.x * r;
      mz = fw.z * f + rt.z * r;
      const len = Math.hypot(mx, mz);
      if (len > 0) { mx /= len; mz /= len; }
    }
    const running = controlEnabled && (input.ShiftLeft || input.ShiftRight);
    const targetSpeed = (mx || mz) ? (running ? 6.4 : 3.2) : 0;
    const accel = targetSpeed > this.speed ? 9 : 12;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * accel);
    if (mx || mz) {
      this.moveDir = { x: mx, z: mz };
      const targetYaw = Math.atan2(mx, mz);
      let d = targetYaw - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 12);
    }
    if (this.speed > 0.01 && this.moveDir) {
      const step = this.speed * dt;
      // move in two sub-steps for stable collisions
      for (let i = 0; i < 2; i++) this.tryMove(this.moveDir.x * step / 2, this.moveDir.z * step / 2);
    }
    const gh = this.heightAt(this.pos.x, this.pos.z);
    this.pos.y += (gh - this.pos.y) * Math.min(1, dt * 18);

    // ---------- animation
    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.facing;
    const k = Math.min(1, this.speed / 3.2);
    const runK = Math.max(0, (this.speed - 3.2) / 3.2);
    this.phase += dt * (this.speed * 2.1 + 0.001);
    const s = Math.sin(this.phase);
    const swing = 0.55 * k + 0.25 * runK;
    m.armL.pivot.rotation.x = s * swing;
    m.armR.pivot.rotation.x = -s * swing;
    m.armL.knee.rotation.x = -0.25 - runK * 0.9;
    m.armR.knee.rotation.x = -0.25 - runK * 0.9;
    m.legL.pivot.rotation.x = -s * swing * 1.1;
    m.legR.pivot.rotation.x = s * swing * 1.1;
    m.legL.knee.rotation.x = Math.max(0, Math.sin(this.phase + 1.3)) * 0.9 * k;
    m.legR.knee.rotation.x = Math.max(0, Math.sin(this.phase + 1.3 + Math.PI)) * 0.9 * k;
    const breath = Math.sin(performance.now() * 0.0022) * 0.008;
    m.body.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * k + breath - 0.02 * k;
    m.body.rotation.x = 0.06 * k + runK * 0.1;
    m.armL.pivot.rotation.z = -0.08;
    m.armR.pivot.rotation.z = 0.08;
    // slight limp on idle (he's hurt)
    if (k < 0.05) m.body.rotation.z = Math.sin(performance.now() * 0.0011) * 0.012;

    if (this.pickupT > 0) {
      this.pickupT -= dt;
      const t = Math.sin((1 - this.pickupT / 0.55) * Math.PI);
      m.body.rotation.x = t * 0.6;
      m.body.position.y -= t * 0.18;
      m.armR.pivot.rotation.x = -t * 1.1;
      m.armL.pivot.rotation.x = -t * 0.6;
    }
    // lying down (wake-up sequence)
    if (this.lying > 0) {
      m.body.rotation.x = -this.lying * Math.PI / 2;
      m.body.position.y = this.lying * 0.16;
      m.body.position.z = this.lying * 0.9;
      m.armL.pivot.rotation.x = 0; m.armR.pivot.rotation.x = 0;
      m.legL.pivot.rotation.x = 0; m.legR.pivot.rotation.x = 0;
    } else {
      m.body.position.z = 0;
    }
  }

  tryMove(dx, dz) {
    const ox = this.pos.x, oz = this.pos.z;
    let nx = ox + dx, nz = oz + dz;
    // world bounds
    let hitBound = null;
    const BOUNDS = this.zone.bounds;
    if (nx < BOUNDS.minX) { nx = BOUNDS.minX; hitBound = 'side'; }
    if (nx > BOUNDS.maxX) { nx = BOUNDS.maxX; hitBound = 'side'; }
    if (nz < BOUNDS.minZ) { nz = BOUNDS.minZ; hitBound = 'forest'; }
    if (nz > BOUNDS.maxZ) { nz = BOUNDS.maxZ; hitBound = 'sea'; }
    // deep water and very steep slopes block movement
    const h0 = this.heightAt(ox, oz), h1 = this.heightAt(nx, nz);
    const dist = Math.hypot(nx - ox, nz - oz) || 1e-6;
    const deep = this.zone.deepWater;
    if (deep !== null && h1 < deep && h1 < h0) { nx = ox; nz = oz; hitBound = hitBound || 'sea'; }
    else {
      // raised floors (cabin, bridge) can be stepped onto; natural slopes steeper than ~49° cannot be climbed
      const platform = this.zone.isPlatform && this.zone.isPlatform(nx, nz);
      if (platform ? h1 - h0 > 0.6 : (h1 - h0) / dist > 1.15) { nx = ox; nz = oz; hitBound = hitBound || 'cliff'; }
    }
    // colliders
    const r = this.radius;
    // two passes so a player wedged between overlapping colliders is pushed fully clear
    for (let pass = 0; pass < 2; pass++) for (const c of this.colliders) {
      if (c.type === 'circle') {
        const ddx = nx - c.x, ddz = nz - c.z;
        const rr = r + c.r;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 1e-4;
          nx = c.x + (ddx / d) * rr;
          nz = c.z + (ddz / d) * rr;
        }
      } else {
        const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
        // world -> box local (box rotated by rot around Y)
        const lx = (nx - c.x) * cs - (nz - c.z) * sn;
        const lz = (nx - c.x) * sn + (nz - c.z) * cs;
        const qx = Math.max(-c.hw, Math.min(c.hw, lx));
        const qz = Math.max(-c.hd, Math.min(c.hd, lz));
        let ex = lx - qx, ez = lz - qz;
        const d2 = ex * ex + ez * ez;
        if (d2 < r * r) {
          let px, pz;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            px = qx + (ex / d) * r; pz = qz + (ez / d) * r;
          } else {
            // inside: push out along the shallowest axis
            const penX = c.hw - Math.abs(lx), penZ = c.hd - Math.abs(lz);
            if (penX < penZ) { px = Math.sign(lx || 1) * (c.hw + r); pz = lz; }
            else { px = lx; pz = Math.sign(lz || 1) * (c.hd + r); }
          }
          // local -> world
          nx = c.x + px * cs + pz * sn;
          nz = c.z - px * sn + pz * cs;
        }
      }
    }
    this.pos.x = nx;
    this.pos.z = nz;
    if (hitBound && this.onBoundary) this.onBoundary(hitBound);
  }

  updateCamera(dt) {
    const target = tmpV.set(this.pos.x, this.pos.y + 1.55, this.pos.z);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const dir = new THREE.Vector3(Math.sin(this.camYaw) * cp, sp, Math.cos(this.camYaw) * cp);
    const right = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const origin = target.clone().addScaledVector(right, 0.45);

    let want = this.camDist;
    // occluders (fuselage, rocks...)
    this.ray.set(origin, dir);
    this.ray.far = want;
    const hits = this.ray.intersectObjects(this.occluders, false);
    if (hits.length) want = Math.max(0.8, hits[0].distance - 0.3);
    // terrain
    for (let i = 1; i <= 10; i++) {
      const d = (want * i) / 10;
      const p = origin.clone().addScaledVector(dir, d);
      if (p.y < this.heightAt(p.x, p.z) + 0.3) { want = Math.max(0.8, d - want / 10); break; }
    }
    const rate = want < this.curDist ? 18 : 3;
    this.curDist += (want - this.curDist) * Math.min(1, dt * rate);
    const camPos = origin.clone().addScaledVector(dir, this.curDist);
    const gh = this.heightAt(camPos.x, camPos.z) + 0.3;
    if (camPos.y < gh) camPos.y = gh;
    this.camera.position.copy(camPos);
    this.camera.lookAt(origin.x, origin.y - 0.1, origin.z);
  }
}
