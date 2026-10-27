// Friends in the world: each remote player is a clone of their chosen character with its own animation mixer,
// a name above the head and, at night, a flashlight glow. Positions arrive ~10 times a second and are smoothed.
// A friend is only drawn while they are in the same area (zone) as the local player.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const WALK = 2.8, RUN = 5.8; // same speeds as player.js
const SCALE = 0.0104;
const CLIP_WALK = 1.63 * SCALE * 100, CLIP_RUN = 4.0 * SCALE * 100;
const HIPS = 'mixamorig10Hips';
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function nameTag(text) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 112;
  const c = cv.getContext('2d');
  c.font = 'bold 54px Heebo, Arial, sans-serif';
  const w = Math.min(500, c.measureText(text).width + 56);
  c.fillStyle = 'rgba(12,18,24,0.62)';
  c.beginPath(); c.roundRect((512 - w) / 2, 14, w, 84, 42); c.fill();
  c.fillStyle = '#f3efe6';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 256, 58);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(1.15, 0.25, 1);
  s.renderOrder = 5;
  return s;
}

// a soft cone of light in front of a friend's flashlight (no real light: adding lights would recompile every material)
function beam() {
  const g = new THREE.ConeGeometry(1.4, 7, 20, 1, true);
  g.translate(0, -3.5, 0);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.Mesh(g, m);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(0.35);
  const grp = new THREE.Group();
  grp.add(mesh, glow);
  return grp;
}

class Avatar {
  constructor(scene, player, info) {
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);
    this.player = player;
    this.id = info.id;
    this.name = info.name;
    this.skin = null;
    this.mixer = null;
    this.target = null; // last received state
    this.pos = new THREE.Vector3();
    this.facing = 0;
    this.speed = 0;
    this.zone = null;
    this.tag = nameTag(info.name);
    this.tag.position.y = 2.15;
    this.root.add(this.tag);
    this.light = beam();
    this.light.position.set(0.18, 1.25, 0.35);
    this.light.visible = false;
    this.root.add(this.light);
    this.setSkin(info.skin);
  }

  setName(name) {
    if (name === this.name) return;
    this.name = name;
    this.root.remove(this.tag);
    this.tag.material.map.dispose();
    this.tag.material.dispose();
    this.tag = nameTag(name);
    this.tag.position.y = 2.15;
    this.root.add(this.tag);
  }

  async setSkin(skinId) {
    if (skinId === this.skin) return;
    this.skin = skinId;
    let rec;
    try { rec = await this.player.loadSkin(skinId); } catch (e) { rec = await this.player.loadSkin('alex'); }
    if (this.skin !== skinId && this.skin !== rec.skin.id) return; // changed again while loading
    if (this.mesh) { this.root.remove(this.mesh); this.mixer && this.mixer.stopAllAction(); }
    const mesh = cloneSkinned(rec.mesh);
    // the clone carries the local player's bandage: friends do not show it
    mesh.traverse((o) => { if (o.isMesh && o.geometry === rec.bandage.geometry) o.visible = false; });
    this.mesh = mesh;
    this.root.add(mesh);
    this.mixer = new THREE.AnimationMixer(mesh);
    this.actions = {};
    for (const n of ['Idle', 'Walking', 'Running', 'Falling']) {
      const clip = rec.clips.find((c) => c.name === n);
      if (!clip) continue;
      // keep the cycles in place: drop any forward travel of the hips (the position updates move the friend)
      const tracks = clip.tracks.map((t) => {
        if (t.name !== `${HIPS}.position`) return t;
        const c = t.clone();
        for (let i = 0; i < c.values.length; i += 3) { c.values[i] = t.values[0]; c.values[i + 2] = t.values[2]; }
        return c;
      });
      const a = this.mixer.clipAction(new THREE.AnimationClip(n, clip.duration, tracks));
      a.play();
      a.setEffectiveWeight(n === 'Idle' ? 1 : 0);
      this.actions[n] = a;
    }
  }

  receive(s) {
    this.at = performance.now();
    const first = !this.target;
    this.target = s;
    this.zone = s.z;
    if (first || s.tp) { this.pos.set(s.x, s.y, s.z2); this.facing = s.f; }
  }

  update(dt, zoneId) {
    const s = this.target;
    // a friend who stopped sending (paused tab, lobby, lost connection) fades from the world after a few seconds
    this.root.visible = !!s && s.z === zoneId && performance.now() - this.at < 6000;
    if (!this.root.visible) return;
    const k = 1 - Math.exp(-dt * 10);
    const before = this.pos.clone();
    const tgt = new THREE.Vector3(s.x, s.y, s.z2);
    // a big jump (zone spawn, teleport, reload) snaps instead of sliding across the island
    if (before.distanceTo(tgt) > 12) this.pos.copy(tgt); else this.pos.lerp(tgt, k);
    this.facing += wrap(s.f - this.facing) * k;
    const moved = before.distanceTo(this.pos) / Math.max(dt, 1e-3);
    this.speed += ((s.v ?? moved) - this.speed) * k;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing;
    this.light.visible = !!s.l;
    if (!this.mixer || !this.actions.Idle) return;
    const A = this.actions, sp = this.speed;
    const run = clamp01((sp - WALK) / (RUN - WALK)), move = clamp01(sp / 0.9), air = s.a && A.Falling ? 1 : 0;
    A.Walking.setEffectiveWeight((1 - air) * move * (1 - run));
    A.Running.setEffectiveWeight((1 - air) * move * run);
    A.Idle.setEffectiveWeight((1 - air) * (1 - move));
    if (A.Falling) A.Falling.setEffectiveWeight(air);
    A.Walking.timeScale = Math.max(0.5, Math.min(2.2, sp / CLIP_WALK));
    A.Running.timeScale = Math.max(0.7, Math.min(1.8, sp / CLIP_RUN));
    this.mixer.update(dt);
  }

  dispose() {
    this.root.removeFromParent();
    this.mixer && this.mixer.stopAllAction();
    this.tag.material.map.dispose();
    this.tag.material.dispose();
  }
}

export class RemotePlayers {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.avatars = new Map();
  }

  syncRoster(list) {
    for (const r of list) {
      if (r.self) continue;
      let a = this.avatars.get(r.id);
      if (!a) { a = new Avatar(this.scene, this.player, r); this.avatars.set(r.id, a); }
      a.setName(r.name);
      a.setSkin(r.skin);
    }
  }

  state(id, s) {
    const a = this.avatars.get(id);
    if (a) a.receive(s);
  }

  remove(id) {
    const a = this.avatars.get(id);
    if (a) { a.dispose(); this.avatars.delete(id); }
  }

  clear() { for (const id of [...this.avatars.keys()]) this.remove(id); }

  update(dt, zoneId, hidden) {
    for (const a of this.avatars.values()) {
      a.update(dt, zoneId);
      if (hidden) a.root.visible = false;
    }
  }

  // friends in the same zone (for the HUD)
  nearby(zoneId) { return [...this.avatars.values()].filter((a) => a.zone === zoneId && performance.now() - (a.at || 0) < 6000).length; }
}
