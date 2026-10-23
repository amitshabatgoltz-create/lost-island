// Third-person survivor: procedural model, walk animation, collision and orbit camera.
import * as THREE from 'three';

const tmpV = new THREE.Vector3();

function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough });
}

function buildSurvivor() {
  const skin = mat(0xc99a78, 0.7), shirt = mat(0x8fb3cf, 0.9), shirtDirty = mat(0x6f8ea6, 0.95);
  const pants = mat(0x5b5547, 0.95), shoe = mat(0x2a2622, 0.8), hair = mat(0x2b1d14, 0.9);
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobbing part
  root.add(body);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.42, 4, 10), shirt);
  torso.scale.set(1.12, 1, 0.72);
  torso.position.y = 1.22;
  body.add(torso);
  // torn, dirty hem
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.25, 0.12, 10, 1, true), shirtDirty);
  hem.scale.set(1.1, 1, 0.75);
  hem.position.y = 0.98;
  body.add(hem);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 12), mat(0x2b2420, 0.6));
  belt.scale.set(1.08, 1, 0.74);
  belt.position.y = 0.93;
  body.add(belt);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), skin);
  neck.position.y = 1.58;
  body.add(neck);
  const head = new THREE.Group();
  head.position.y = 1.72;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12), skin);
  skull.scale.set(0.95, 1.12, 1.0);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.143, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairCap.position.y = 0.025;
  hairCap.rotation.x = -0.25;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 6), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.01, 0.135);
  const eyeMat = mat(0x111111, 0.3);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), eyeMat);
  eyeL.position.set(-0.045, 0.03, 0.122);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.045;
  const stubble = new THREE.Mesh(new THREE.SphereGeometry(0.128, 12, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.3), mat(0x7a5a46, 0.95));
  stubble.rotation.x = 0.3;
  const cut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), mat(0x7a1e1e, 0.6));
  cut.position.set(0.06, 0.08, 0.125);
  cut.rotation.z = 0.5;
  head.add(skull, hairCap, nose, eyeL, eyeR, stubble, cut);
  body.add(head);

  function limb(upperMat, lowerMat, upperLen, lowerLen, r, endMat) {
    const pivot = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(r, upperLen, 3, 8), upperMat);
    upper.position.y = -upperLen / 2 - r * 0.3;
    pivot.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -upperLen - r * 0.5;
    pivot.add(knee);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.88, lowerLen, 3, 8), lowerMat);
    lower.position.y = -lowerLen / 2 - r * 0.3;
    knee.add(lower);
    let end = null;
    if (endMat) {
      end = new THREE.Mesh(new THREE.BoxGeometry(r * 2.3, r * 1.4, r * 3.6), endMat);
      end.position.set(0, -lowerLen - r * 0.9, r * 0.8);
      knee.add(end);
    }
    return { pivot, knee, lower, end };
  }
  const armL = limb(shirt, skin, 0.24, 0.24, 0.058, null);
  const armR = limb(shirtDirty, skin, 0.24, 0.24, 0.058, null);
  armL.pivot.position.set(-0.29, 1.47, 0);
  armR.pivot.position.set(0.29, 1.47, 0);
  // hands
  for (const a of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skin);
    hand.position.y = -0.33;
    a.knee.add(hand);
  }
  const legL = limb(pants, pants, 0.36, 0.36, 0.085, shoe);
  // right trouser leg torn at the knee: bare shin
  const legR = limb(pants, skin, 0.36, 0.36, 0.085, shoe);
  legL.pivot.position.set(-0.115, 0.92, 0);
  legR.pivot.position.set(0.115, 0.92, 0);
  body.add(armL.pivot, armR.pivot, legL.pivot, legR.pivot);

  // bandage (shown after it's collected)
  const bandage = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.1, 10), mat(0xeeeadf, 0.9));
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
