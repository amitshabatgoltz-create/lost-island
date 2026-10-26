// Performance helpers: automatic quality (resolution, effects, shadow detail follow the real frame rate)
// and fog culling (vegetation chunks that are fully hidden in the fog are not drawn at all).
import * as THREE from 'three';

// From best to cheapest. `pr` is the highest pixel ratio of the tier (never above the screen's own),
// `samples` the MSAA of the post-processing target, `post` bloom + colour grade, `detail` terrain blending.
export const TIERS = [
  { pr: 1.5, samples: 4, shadow: 2048, post: true, detail: true },
  { pr: 1.25, samples: 4, shadow: 2048, post: true, detail: true },
  { pr: 1.0, samples: 4, shadow: 2048, post: true, detail: true },
  { pr: 0.85, samples: 2, shadow: 1024, post: true, detail: true },
  { pr: 0.75, samples: 0, shadow: 1024, post: false, detail: false },
  { pr: 0.6, samples: 0, shadow: 1024, post: false, detail: false },
];
const SLOW = 1 / 42; // average frame time that counts as stutter
const FAST = 1 / 57; // average frame time that leaves room for a better tier
const WINDOW = 1.5; // seconds per measurement
const WARMUP = 1.2; // seconds ignored after a tier change or a pause (resize, shader compile)

// first guess before anything is measured: software rendering and integrated graphics start lower
export function guessTier(renderer) {
  let name = '';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
  } catch (e) { /* unknown GPU */ }
  if (/swiftshader|llvmpipe|software|basic render/.test(name)) return 4;
  if (/intel|mali|adreno|powervr|videocore/.test(name)) return 2;
  return 0;
}

export class AutoQuality {
  constructor(start, onChange) {
    this.tier = Math.max(0, Math.min(TIERS.length - 1, start | 0));
    this.onChange = onChange;
    this.sum = 0;
    this.frames = 0;
    this.warm = WARMUP;
    this.slow = 0;
    this.fast = 0;
    this.clock = 0;
    this.blockedUntil = new Array(TIERS.length).fill(0); // a tier that stuttered is not retried for a while
    this.fails = new Array(TIERS.length).fill(0);
    this.fps = 0;
  }

  // dt: real time since the last frame; measuring: the game is on screen and moving (not paused or loading)
  sample(dt, measuring) {
    this.clock += dt;
    if (!measuring || dt > 2) { this.warm = WARMUP; return; } // paused, loading or back from a hidden tab
    if (this.warm > 0) { this.warm -= dt; this.sum = 0; this.frames = 0; return; }
    this.sum += Math.min(dt, 0.25); // one long hitch (a shader compile) barely moves the average
    this.frames++;
    if (this.sum < WINDOW) return;
    const avg = this.sum / this.frames;
    this.fps = 1 / avg;
    this.sum = 0;
    this.frames = 0;
    if (avg > SLOW) { this.fast = 0; this.slow++; } else if (avg < FAST) { this.slow = 0; this.fast++; } else { this.slow = 0; this.fast = 0; }
    // very slow: step down at once; a little slow: after two windows in a row
    if (this.tier < TIERS.length - 1 && (avg > 1 / 28 || this.slow >= 2)) {
      this.fails[this.tier]++;
      this.blockedUntil[this.tier] = this.clock + 60 * 2 ** Math.min(4, this.fails[this.tier] - 1);
      this.set(this.step(this.tier, 1));
    } else if (this.tier > 0 && this.fast >= 8 && this.clock > this.blockedUntil[this.tier - 1]) {
      this.set(this.step(this.tier, -1));
    }
  }

  // the next tier that really changes something (on a plain 1x screen the top three tiers look the same)
  step(from, dir) {
    const dpr = window.devicePixelRatio || 1;
    const key = (t) => { const x = TIERS[t]; return [Math.min(dpr, x.pr), x.samples, x.shadow, x.post, x.detail].join(); };
    let t = from + dir;
    while (t + dir >= 0 && t + dir < TIERS.length && key(t) === key(from)) t += dir;
    return t;
  }

  set(tier) {
    this.tier = tier;
    this.slow = 0;
    this.fast = 0;
    this.warm = WARMUP;
    this.onChange(tier);
  }
}

// Hides instanced chunks (trees, bushes, rocks) that sit entirely behind the fog. Uses the same height fog
// formula as env.js, measured at the top of each chunk (the least fogged point) and its nearest edge, so
// nothing visible ever disappears. Layers are used instead of `visible` so zone code can keep its own toggles.
export class FogCuller {
  constructor() {
    this.items = [];
    this.t = 0;
    this.hidden = 0;
  }

  setZone(group) {
    // zones are kept when left: give back what was hidden, or it would stay hidden on the next visit
    for (const it of this.items) if (it.off) it.mesh.layers.mask = it.mask;
    this.items = [];
    if (!group) return;
    group.updateMatrixWorld(true);
    const s = new THREE.Vector3();
    group.traverse((o) => {
      if (!o.isInstancedMesh || !o.count) return;
      if (!o.boundingSphere) o.computeBoundingSphere();
      const c = o.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
      o.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
      // a zone can also give small plants a plain draw distance (userData.cullDist, metres)
      this.items.push({ mesh: o, c, r: o.boundingSphere.radius * Math.max(s.x, s.y, s.z) + 3, mask: o.layers.mask, off: false, far: o.userData.cullDist || 0 });
    });
    this.t = 1;
  }

  update(dt, camera, fog) {
    if ((this.t += dt) < 0.2) return;
    this.t = 0;
    const p = camera.position;
    let hidden = 0;
    for (const it of this.items) {
      const d = Math.max(0, it.c.distanceTo(p) - it.r);
      let off = it.far > 0 && d > it.far;
      if (!off && fog && fog.isFogExp2) {
        const h = Math.max(0.5 * (it.c.y + it.r + p.y), 0);
        const fd = fog.density * (0.35 + 0.65 * Math.exp(-h * 0.06));
        off = fd * d > 2.4; // more than 99.6% fog
      }
      if (off !== it.off) { it.off = off; it.mesh.layers.mask = off ? 0 : it.mask; }
      if (off) hidden++;
    }
    this.hidden = hidden;
  }
}
