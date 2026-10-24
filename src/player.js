// Third-person survivor: the chosen rigged Mixamo character (src/data/skins.js), the animation clips from
// public/models/survivor.glb (plus newer clips in public/models/anims/), collision and orbit camera.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clothTex } from './gfx/textures.js';
import { SKINS, DEFAULT_SKIN, skinById } from './data/skins.js';
import { loadTorch } from './gfx/torch.js';

const tmpV = new THREE.Vector3();
const tmpAim = new THREE.Vector3();
const MODEL_URL = './models/survivor.glb';
// extra clips (tools/anims/README.md); a clip here replaces survivor.glb's clip of the same name
const ANIM_URLS = ['./models/anims/start_walking.glb'];
const SCALE = 0.0104; // the model is authored in centimetres, 176 cm tall
const WALK = 2.8, RUN = 5.8; // m/s
const START_WALK_RATE = 1.7; // Start_Walking is a slower stroll than Walking: sped up to meet it
const START_WALK_END = 1.3; // clip time where the first steps are done and the walk cycle takes over
const CLIP_WALK = 1.63 * SCALE * 100, CLIP_RUN = 4.0 * SCALE * 100; // ground speed the walk / run clips were authored at
const HIPS = 'mixamorig10Hips';
// the flashlight beam: a focused bright core with soft edges (penumbra) and a gentle falloff (decay below the physical 2
// keeps 10–20 m readable without burning out the ground at the feet); outside the cone the night stays dark
export const TORCH_POWER = 450; // candela
const TORCH_RANGE = 36, TORCH_ANGLE = 0.5, TORCH_PENUMBRA = 0.5, TORCH_DECAY = 1;
const TORCH_NEAR = 3; // when the beam's core meets the ground closer than this (m), it dims so the spot is not blown out
const TORCH_PITCH = [-1.3, 1.0]; // how far the beam can be aimed down / up (radians)
const TORCH_REACH = 1.75; // the beam swings at most this far (radians) from the way the body faces
const ease = (k) => k * k * (3 - 2 * k);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

let gltfLoader;
function loadGLB(url, onProgress = () => {}) {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }
  return gltfLoader.loadAsync(url, (e) => e.total && onProgress(e.loaded / e.total));
}

export class Player {
  constructor(scene, camera) {
    this.scene = scene;
    this.colliders = [];
    this.occluders = [];
    this.zone = null;
    this.camera = camera;
    this.model = { root: new THREE.Group(), bandage: null };
    scene.add(this.model.root);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.camDist = 4.6;
    this.curDist = 4.6;
    this.radius = 0.38;
    this.speed = 0;
    this.lying = 0; // 1 = lying on the sand, 0 = standing (drives the Stand_Up clip during the wake-up)
    this.settings = { sens: 1, invertY: false };
    this.onBoundary = null;
    this.act = null; // the one-shot (or held) clip playing over the walk/idle blend
    this.fading = []; // previous one-shots fading out
    this.sitting = false;
    this.runT = 0; // seconds spent running, for the out-of-breath idle
    this.breathT = 0;
    this.breathK = 0;
    this.still = true;
    this.bandageOn = false;

    // one spot light, carried in the right hand and aimed with the camera (mouse): see updateFlashlight
    this.flashlight = new THREE.SpotLight(0xfff3e0, 0, TORCH_RANGE, TORCH_ANGLE, TORCH_PENUMBRA, TORCH_DECAY);
    this.flashlight.shadow.mapSize.set(512, 512);
    this.flashlight.shadow.camera.near = 0.15;
    this.flashlight.shadow.camera.far = TORCH_RANGE;
    this.flashlight.shadow.bias = -0.0004;
    this.flashlight.shadow.normalBias = 0.02;
    scene.add(this.flashlight, this.flashlight.target);
    this.flashlightOn = false;
    this.torch = new THREE.Group(); // the flashlight model in the hand (shown while it is on)
    this.torch.visible = false;
    scene.add(this.torch);
    this.aimDir = new THREE.Vector3(0, -0.12, 1).normalize();
    this.followCam = false; // the orbit camera (mouse) drives the aim; cutscenes aim where the body faces

    this.ray = new THREE.Raycaster();
  }

  // survivor.glb carries the animation clips (shared by every skin) and the default character
  async load(onProgress = () => {}, skinId = DEFAULT_SKIN) {
    const [gltf, torch, ...extra] = await Promise.all([
      loadGLB(MODEL_URL, onProgress),
      loadTorch().catch(() => null), // without the model the beam still works
      // a missing clip file only costs that clip's upgrade: survivor.glb's own version stays
      ...ANIM_URLS.map((url) => loadGLB(url).catch((err) => { console.warn(err); return null; })),
    ]);
    const clips = new Map(gltf.animations.map((c) => [c.name, c]));
    for (const g of extra) if (g) for (const c of g.animations) clips.set(c.name, c);
    this.clips = [...clips.values()];
    if (torch) {
      torch.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.material.emissive.setHex(0xfff0d8); this.torchLens = o.material; } });
      this.torch.add(torch);
      this.setFlashlight(this.flashlightOn);
    }
    this.baseHipsY = gltf.scene.getObjectByName(HIPS).position.y;
    this.skins = { [SKINS[0].id]: Promise.resolve(this.prepareSkin(gltf.scene, SKINS[0])) };
    this.yawDelta = { Walking_Turn_180: -3.12, Climbing_Down: -1.55, Start_Climbing_Ladder: 3.1 }; // body turn at the end of a clip
    await this.setSkin(skinId);
  }

  // load (once) and get a skin ready to wear; resolves to its prepared record
  loadSkin(id, onProgress) {
    const skin = skinById(id);
    if (!this.skins[skin.id]) {
      this.skins[skin.id] = loadGLB('./models/' + skin.file, onProgress)
        .then((g) => this.prepareSkin(g.scene, skin))
        .catch((err) => { delete this.skins[skin.id]; throw err; });
    }
    return this.skins[skin.id];
  }

  // one-time setup of a loaded character: size, shadows, bandage, and the clips fitted to its skeleton
  prepareSkin(mesh, skin) {
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const height = skin.height ?? (box.max.y - box.min.y) * SCALE;
    mesh.scale.setScalar(height / (box.max.y - box.min.y));
    mesh.traverse((o) => {
      if (!o.isMesh) return;
      if (skin.hide && skin.hide.includes(o.name)) o.visible = false;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false; // skinned bounds do not follow the animated pose (climbs move far from the bind pose)
      if (o.isSkinnedMesh) o.normalizeSkinWeights(); // 8-bit weights can sum to less than 1, which drags vertices to the origin
    });
    const hips = mesh.getObjectByName(HIPS);
    // hips travel in the clips is in survivor.glb's units and leg length: scale it to this skeleton
    const k = hips.position.y / this.baseHipsY;
    const bones = new Set();
    mesh.traverse((o) => o.isBone && bones.add(o.name));
    const clips = this.clips.map((clip) => {
      if (k === 1) return clip;
      const tracks = clip.tracks.filter((t) => bones.has(t.name.split('.')[0])).map((t) => {
        if (t.name !== `${HIPS}.position`) return t;
        const c = t.clone();
        for (let i = 0; i < c.values.length; i++) c.values[i] *= k;
        return c;
      });
      return new THREE.AnimationClip(clip.name, clip.duration, tracks);
    });

    // field dressing on the right forearm (shown once the bandage is found); bone space is in the skin's own units
    const cloth = clothTex();
    const bandage = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.0, 9, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe9e3d3, map: cloth.map, normalMap: cloth.normalMap, roughness: 1, side: THREE.DoubleSide }),
    );
    bandage.scale.setScalar(k);
    bandage.position.y = 13 * k;
    bandage.castShadow = true;
    mesh.getObjectByName('mixamorig10RightForeArm').add(bandage);
    mesh.updateMatrixWorld(true);
    const unit = hips.parent.getWorldScale(new THREE.Vector3()).x; // metres per hips-track unit
    return { skin, mesh, clips, bandage, hips, unit, head: mesh.getObjectByName('mixamorig10Head'), hand: mesh.getObjectByName('mixamorig10RightHand'), k };
  }

  // wear a skin: swaps the character mesh and rebuilds the animation mixer for its skeleton
  async setSkin(id, onProgress) {
    const rec = await this.loadSkin(id, onProgress);
    if (this.model.mesh === rec.mesh) return rec.skin;
    if (this.model.mesh) this.model.root.remove(this.model.mesh);
    if (this.mixer) this.mixer.stopAllAction();
    this.cancelAction();
    const mesh = rec.mesh;
    this.model.root.add(mesh);
    this.model.mesh = mesh;
    this.model.bandage = rec.bandage;
    rec.bandage.visible = this.bandageOn;
    this.hips = rec.hips;
    this.head = rec.head;
    this.hand = rec.hand;
    this.handK = rec.k;
    this.skinId = rec.skin.id;

    this.mixer = new THREE.AnimationMixer(mesh);
    this.actions = {};
    this.hipsDelta = {}; // hips travel over each clip (bone-parent space): the clip's own root motion
    for (const clip of rec.clips) {
      const a = this.mixer.clipAction(clip);
      this.actions[clip.name] = a;
      const tr = clip.tracks.find((t) => t.name === `${HIPS}.position`);
      const v = tr.values, n = v.length;
      this.hipsDelta[clip.name] = new THREE.Vector3(v[n - 3] - v[0], v[n - 2] - v[1], v[n - 1] - v[2]);
    }
    // Start_Walking carries its own forward travel: the player moves at the clip's pace so the first steps do not
    // slide, and the hips travel is taken back out (null for an in-place version of the clip)
    const sw = rec.clips.find((c) => c.name === 'Start_Walking');
    const swHips = sw && sw.tracks.find((t) => t.name === `${HIPS}.position`);
    this.startWalk = swHips && this.hipsDelta.Start_Walking.z * rec.unit > 0.5
      ? { hips: swHips.createInterpolant(), p0: new THREE.Vector3().fromArray(swHips.values), unit: rec.unit }
      : null;
    if (this.startWalk) {
      const sw0 = this.startWalk;
      // the clip's walking pace once under way (m/s at timeScale 1), for keeping the feet planted while it fades out
      sw0.pace = (sw0.hips.evaluate(sw.duration)[2] - sw0.hips.evaluate(1)[2]) / (sw.duration - 1) * rec.unit;
      // the Walking cycle time whose legs match the end of the first steps, so the walk picks up in step
      const walk = rec.clips.find((c) => c.name === 'Walking');
      const legs = ['LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'].map((b) => {
        const f = (c) => c.tracks.find((t) => t.name === `mixamorig10${b}.quaternion`);
        return f(sw) && f(walk) ? [f(sw).createInterpolant(), f(walk).createInterpolant()] : null;
      }).filter(Boolean);
      const target = legs.map(([a]) => Array.from(a.evaluate(START_WALK_END)));
      let best = -Infinity;
      sw0.walkPhase = 0;
      for (let t = 0; t < walk.duration; t += 1 / 60) {
        let score = 0;
        legs.forEach(([, w], i) => { const q = w.evaluate(t); score += Math.abs(q[0] * target[i][0] + q[1] * target[i][1] + q[2] * target[i][2] + q[3] * target[i][3]); });
        if (score > best) { best = score; sw0.walkPhase = t; }
      }
    }
    // walk / run / idle blend: always playing, weights set every frame
    for (const n of ['Idle', 'Breathing_Idle', 'Walking', 'Running']) {
      const a = this.actions[n];
      a.play();
      a.setEffectiveWeight(n === 'Idle' ? 1 : 0);
    }
    return rec.skin;
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
    this.cancelAction();
  }

  setFlashlight(on) {
    this.flashlightOn = on;
    this.flashlight.intensity = this.torchPower();
    // the light stays in the scene (no shader rebuild on F); while off its shadow map is not redrawn
    this.flashlight.shadow.autoUpdate = on;
    this.torch.visible = on && this.torch.children.length > 0;
    if (this.torchLens) this.torchLens.emissiveIntensity = on ? 1.2 : 0;
  }

  // flashlight shadows follow the game's shadow setting (one extra 512² pass while the light is on)
  setFlashlightShadows(on) { this.flashlight.castShadow = on; }

  // the beam goes where the camera looks: mouse left/right turns it, mouse up/down raises and lowers it
  updateFlashlight(dt) {
    if (!this.flashlightOn) { this.followCam = false; return; }
    const want = tmpAim;
    if (this.followCam) {
      // the default camera pitch (0.32) aims a little down, at the ground ~10 m ahead
      const e = Math.max(TORCH_PITCH[0], Math.min(TORCH_PITCH[1], (0.32 - this.camPitch) * 1.5 - 0.12));
      let yaw = this.camYaw + Math.PI;
      const d = wrap(yaw - this.facing);
      if (Math.abs(d) > TORCH_REACH) yaw = this.facing + Math.sign(d) * TORCH_REACH;
      want.set(Math.sin(yaw) * Math.cos(e), Math.sin(e), Math.cos(yaw) * Math.cos(e));
    } else {
      want.set(Math.sin(this.facing), -0.12, Math.cos(this.facing)).normalize();
    }
    this.followCam = false;
    this.aimDir.lerp(want, Math.min(1, dt * 14)).normalize();
    // the flashlight sits in the right hand's grip and points along the aim
    this.model.root.updateMatrixWorld(true);
    const t = this.torch;
    if (this.hand) this.hand.localToWorld(t.position.set(0, 8.5 * this.handK, 2.5 * this.handK));
    else t.position.copy(this.pos).add(tmpV.set(0, 1.1, 0));
    t.lookAt(tmpV.copy(t.position).add(this.aimDir));
    t.updateMatrixWorld();
    // the light leaves from the lens, just clear of the hand so the arm does not shadow it
    this.flashlight.position.copy(t.position).addScaledVector(this.aimDir, 0.14);
    this.flashlight.target.position.copy(this.flashlight.position).add(this.aimDir);
    this.flashlight.target.updateMatrixWorld();
    // where the lower edge of the bright core meets the ground: a close hit dims the beam (an eye adapting to the spot)
    const o = this.flashlight.position, a = this.aimDir;
    const h = Math.hypot(a.x, a.z), e = Math.atan2(a.y, h) - TORCH_ANGLE * (1 - TORCH_PENUMBRA);
    const ex = h > 1e-4 ? a.x / h * Math.cos(e) : 0, ez = h > 1e-4 ? a.z / h * Math.cos(e) : 0, ey = Math.sin(e);
    let hit = TORCH_NEAR;
    for (let d = 0.25; d < TORCH_NEAR; d += 0.25) {
      if (o.y + ey * d < this.heightAt(o.x + ex * d, o.z + ez * d)) { hit = d; break; }
    }
    this.torchDim = Math.max(0.15, (hit / TORCH_NEAR) ** 1.5);
    this.flashlight.intensity = this.torchPower();
  }

  // the beam's current strength (TORCH_POWER, dimmed for a close spot; main.js flickers it)
  torchPower() { return this.flashlightOn ? TORCH_POWER * (this.torchDim ?? 1) * (this.flicker ?? 1) : 0; }

  showBandage(v) {
    this.bandageOn = v;
    if (this.model.bandage) this.model.bandage.visible = v;
  }

  // movement is locked while a locking clip (pickup, climb, sitting) plays or during the wake-up
  get busy() { return this.lying > 0 || !!(this.act && this.act.lock); }

  // ------------------------------------------------------------------ one-shot clips
  // opts: timeScale, from/to (clip seconds), reverse, lock, loop, fadeIn, fadeOut,
  //       root {from, to} (world positions the player travels between; the clip's own hips travel is cancelled),
  //       turn (body yaw added to facing when it ends), holdFacing, onDone
  play(name, opts = {}) {
    if (!this.mixer) { opts.onDone && opts.onDone(); return; }
    const a = this.actions[name];
    const dur = a.getClip().duration;
    const from = opts.from ?? 0, to = opts.to ?? dur;
    if (this.act) this.fading.push({ action: this.act.action, w: this.act.w, rate: 1 / 0.2 });
    this.fading = this.fading.filter((f) => f.action !== a);
    a.reset();
    a.setLoop(opts.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = true;
    a.timeScale = (opts.timeScale ?? 1) * (opts.reverse ? -1 : 1);
    a.time = opts.reverse ? to : from;
    a.setEffectiveWeight(0);
    a.play();
    this.act = {
      name, action: a, from, to, reverse: !!opts.reverse, loop: !!opts.loop, lock: !!opts.lock,
      w: opts.fadeIn === 0 ? 1 : 0, fadeIn: opts.fadeIn ?? 0.2, fadeOut: opts.fadeOut ?? 0.25,
      root: opts.root || null, turn: opts.turn || 0, holdFacing: !!opts.holdFacing, onDone: opts.onDone, ending: false, p: 0,
    };
  }

  cancelAction() {
    if (this.act) { this.act.action.stop(); this.act = null; }
    for (const f of this.fading) f.action.stop();
    this.fading.length = 0;
    this.sitting = false;
  }

  playPickup() {
    if (this.act && this.act.lock) return;
    this.play('Picking_Up', { timeScale: 2.8, lock: true, fadeIn: 0.12, fadeOut: 0.3 });
  }

  // climb between two world points with one of the climbing clips; the camera follows the root
  climb(name, from, to, yaw, opts = {}) {
    this.speed = 0;
    this.pos.set(from.x, from.y ?? this.heightAt(from.x, from.z), from.z);
    this.facing = yaw;
    const end = new THREE.Vector3(to.x, to.y ?? this.heightAt(to.x, to.z), to.z);
    const turn = this.yawDelta[name] || 0;
    this.play(name, {
      timeScale: opts.timeScale ?? 1, lock: true, fadeIn: 0.15, fadeOut: turn ? 0 : 0.3, turn,
      root: { from: this.pos.clone(), to: end },
      onDone: opts.onDone,
    });
  }

  // sit down on a seat behind `spot` (the clip steps back onto it), facing `yaw`
  sit(spot, yaw) {
    if (this.busy) return;
    this.speed = 0;
    this.pos.set(spot.x, this.heightAt(spot.x, spot.z), spot.z);
    this.facing = yaw;
    this.sitting = true;
    this.play('Stand_To_Sit', {
      lock: true, fadeIn: 0.2, fadeOut: 0.2,
      onDone: () => { if (this.sitting) this.play('Sitting', { loop: true, lock: true, fadeIn: 0.25 }); },
    });
  }

  standUp() {
    if (!this.sitting) return;
    this.sitting = false;
    this.play('Stand_To_Sit', { reverse: true, timeScale: 1.25, lock: true, fadeIn: 0.15, fadeOut: 0.3 });
  }

  // Start_Walking's forward ground speed (m/s at timeScale 1) at clip time t, from its hips travel
  startWalkSpeed(t) {
    const h = 1 / 30, i = this.startWalk.hips;
    const z1 = i.evaluate(Math.max(0, t - h))[2], z2 = i.evaluate(t + h)[2];
    return Math.max(0, (z2 - z1) / (2 * h)) * this.startWalk.unit;
  }

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
    const wantsMove = controlEnabled && (input.KeyW || input.ArrowUp || input.KeyS || input.ArrowDown || input.KeyA || input.ArrowLeft || input.KeyD || input.ArrowRight);
    if (this.sitting && wantsMove && this.act && this.act.name === 'Sitting') this.standUp();
    if (controlEnabled && !this.busy) {
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
    const targetSpeed = (mx || mz) ? (running ? RUN : WALK) : 0;
    const accel = targetSpeed > this.speed ? 7 : 10;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * accel);
    if (this.busy) this.speed *= Math.max(0, 1 - dt * 14);
    const holdFacing = this.act && this.act.holdFacing;
    if (mx || mz) {
      const targetYaw = Math.atan2(mx, mz);
      const d = wrap(targetYaw - this.facing);
      // reversing while walking: play the 180° turn instead of spinning on the spot
      if (!this.act && this.mixer && Math.abs(d) > 2.7 && this.speed > 0.8 && this.speed < WALK + 0.6) {
        this.play('Walking_Turn_180', { timeScale: 1.35, fadeIn: 0.12, fadeOut: 0, turn: this.yawDelta.Walking_Turn_180, holdFacing: true });
        this.turnTo = targetYaw;
      } else if (!holdFacing) {
        this.facing += d * Math.min(1, dt * 12);
      }
      // first step from standing still: the weight shift and the first steps of the Start_Walking clip
      if (this.still && !this.act && this.mixer && !running) {
        if (this.startWalk) this.play('Start_Walking', { timeScale: START_WALK_RATE, from: 0.25, to: START_WALK_END, fadeIn: 0.1, fadeOut: 0.3 });
        else this.play('Start_Walking', { timeScale: 1.6, to: 0.85, fadeIn: 0.1, fadeOut: 0.35 });
      }
      this.moveDir = { x: mx, z: mz };
      this.still = false;
    } else if (this.speed < 0.2) this.still = true;
    // during the first steps the clip sets the pace; letting go or breaking into a run blends straight out
    const sw = this.act && this.act.name === 'Start_Walking' && this.startWalk ? this.act : null;
    if (sw && !sw.ending) {
      if (!(mx || mz) || running || this.busy) sw.ending = true;
      else if (sw.action.time >= sw.to) {
        sw.ending = true;
        this.actions.Walking.time = this.startWalk.walkPhase;
      } else this.speed = this.startWalkSpeed(sw.action.time) * sw.action.timeScale;
    }
    // fading out into the walk: the clip keeps pace with the ground so its planted foot does not slide
    if (sw && sw.ending) sw.action.timeScale = Math.max(0.5, Math.min(3.5, this.speed / this.startWalk.pace));
    if (this.speed > 0.01 && this.moveDir && !(this.act && this.act.root)) {
      const step = this.speed * dt;
      // move in two sub-steps for stable collisions
      for (let i = 0; i < 2; i++) this.tryMove(this.moveDir.x * step / 2, this.moveDir.z * step / 2);
    }
    if (!(this.act && this.act.root)) {
      const gh = this.heightAt(this.pos.x, this.pos.z);
      this.pos.y += (gh - this.pos.y) * Math.min(1, dt * 18);
    }

    // out of breath after a long run
    if (this.speed > WALK + 0.8) this.runT += dt; else if (this.speed < 0.3) { if (this.runT > 2.5) this.breathT = 6; this.runT = 0; }
    this.breathT = Math.max(0, this.breathT - dt);
    this.breathK += ((this.breathT > 0 ? 1 : 0) - this.breathK) * Math.min(1, dt * 2);

    // standing with the flashlight on: the survivor turns to face where the beam is aimed
    if (this.flashlightOn && this.followCam && controlEnabled && !this.busy && !holdFacing && !(mx || mz)) {
      const d = wrap(this.camYaw + Math.PI - this.facing);
      if (Math.abs(d) > 0.9) this.facing += d * Math.min(1, dt * 4);
    }

    this.animate(dt);
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.facing;
    this.updateFlashlight(dt);
  }

  animate(dt) {
    if (!this.mixer) return;
    const A = this.actions;
    // wake-up: lying 1 -> 0 scrubs the Stand_Up clip
    if (this.lying > 0) {
      if (!this.act || this.act.name !== 'Stand_Up') this.play('Stand_Up', { lock: true, fadeIn: 0, fadeOut: 0.35 });
      const a = this.act.action;
      a.paused = true;
      a.time = (1 - this.lying) * a.getClip().duration;
      this.act.scrub = true;
    } else if (this.act && this.act.scrub) {
      this.act.scrub = false;
      this.act.action.paused = false;
      this.act.action.time = this.act.to;
    }

    // one-shot progress, fade in / out
    let actW = 0;
    const act = this.act;
    if (act) {
      const a = act.action;
      const span = Math.max(1e-3, act.to - act.from);
      act.p = act.loop ? 0 : clamp01(act.reverse ? (act.to - a.time) / span : (a.time - act.from) / span);
      if (!act.loop && !act.scrub && !act.ending && (act.p >= 1 || !a.isRunning())) {
        act.ending = true;
        if (act.root) this.pos.copy(act.root.to);
        if (act.turn) { this.facing = wrap(this.facing + act.turn); if (this.turnTo !== undefined) this.turnTo = undefined; }
        if (act.fadeOut === 0) act.w = 0;
      }
      if (act.ending) act.w -= dt / Math.max(1e-3, act.fadeOut);
      else act.w = Math.min(1, act.w + dt / Math.max(1e-3, act.fadeIn));
      if (act.ending && act.w <= 0) {
        a.stop();
        this.act = null;
        act.onDone && act.onDone();
      } else {
        actW = Math.max(0, act.w);
        a.setEffectiveWeight(actW);
        if (act.root) this.pos.lerpVectors(act.root.from, act.root.to, ease(act.p));
      }
    }
    for (const f of this.fading) { f.w -= dt * f.rate; f.action.setEffectiveWeight(Math.max(0, f.w)); if (f.w <= 0) f.action.stop(); }
    this.fading = this.fading.filter((f) => f.w > 0);
    const over = Math.min(1, (this.act ? Math.max(0, this.act.w) : 0) + this.fading.reduce((s, f) => s + f.w, 0));

    // walk / run / idle weights from ground speed; clip rates follow the speed so the feet do not slide
    const s = this.speed;
    const run = clamp01((s - WALK) / (RUN - WALK));
    const move = clamp01(s / 0.9);
    const base = 1 - over;
    A.Walking.setEffectiveWeight(base * move * (1 - run));
    A.Running.setEffectiveWeight(base * move * run);
    A.Idle.setEffectiveWeight(base * (1 - move) * (1 - this.breathK));
    A.Breathing_Idle.setEffectiveWeight(base * (1 - move) * this.breathK);
    A.Walking.timeScale = Math.max(0.5, Math.min(2.2, s / CLIP_WALK));
    A.Running.timeScale = Math.max(0.7, Math.min(1.8, s / CLIP_RUN));

    this.mixer.update(dt);

    // root-motion clips: the player root carries the travel, so take the clip's own hips travel back out
    const cur = this.act;
    if (cur && cur.root && cur.w > 0) {
      const d = this.hipsDelta[cur.name];
      this.hips.position.addScaledVector(d, -ease(cur.p) * Math.min(1, cur.w));
    }
    // Start_Walking: the player root already moved, so hold its hips over the feet (also while it fades out)
    if (this.startWalk) {
      const a = this.actions.Start_Walking;
      const w = a.isScheduled() ? a.getEffectiveWeight() : 0;
      if (w > 0) {
        const v = this.startWalk.hips.evaluate(a.time), p0 = this.startWalk.p0;
        this.hips.position.x -= (v[0] - p0.x) * w;
        this.hips.position.z -= (v[2] - p0.z) * w;
      }
    }
  }

  // world position of the head (used by the wake-up camera)
  headPosition(out = new THREE.Vector3()) {
    if (!this.head) return out.copy(this.pos).add(new THREE.Vector3(0, 1.6, 0));
    this.model.root.updateMatrixWorld(true);
    return this.head.getWorldPosition(out);
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
      // high ledges (the lookout rock) are left by climbing down, not by walking off the edge
      else if (h0 - h1 > 1.0 && this.zone.isPlatform && this.zone.isPlatform(ox, oz)) { nx = ox; nz = oz; }
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
    this.followCam = true;
  }
}
