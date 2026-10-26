// Climbing in the forest: a lookout rock (climb its face, climb back down), a step stone beside it,
// and the fallen trunks, which can be clambered over in the middle. Each climb plays one of the
// player's climbing clips while the player root travels between two points (see Player.climb).
import * as THREE from 'three';
import { fbm } from '../../noise.js';
import { triplanar } from '../../gfx/materials.js';
import { rockTex } from '../../gfx/textures.js';
import { T } from '../../i18n/index.js';

const rot2 = (lx, lz, r) => ({ x: lx * Math.cos(r) + lz * Math.sin(r), z: -lx * Math.sin(r) + lz * Math.cos(r) });
const ROCK = { hw: 2.5, hd: 2.2, height: 2.0 }; // main block (local x / z half sizes), top above the highest ground under it
const STEP = { lx: -0.6, lz: 3.0, hw: 0.8, hd: 0.6, height: 0.79 }; // step stone on the rock's south side

// a flat-topped boulder: jittered box, sides bulging, top kept level so it can be walked on
function boulderGeometry(w, h, d, seed) {
  const g = new THREE.BoxGeometry(w, h, d, 10, 5, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const top = y > h / 2 - 1e-3;
    const n = fbm(x * 0.9 + seed, z * 0.9 + y * 0.7, 3) - 0.5;
    if (top) {
      y += n * 0.06;
      x *= 0.97; z *= 0.97; // slightly rounded top edge
    } else {
      const k = 1 + n * 0.22 + (0.5 - Math.abs(y / h)) * 0.08;
      x *= k; z *= k;
      y += n * 0.15;
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

export function buildClimbs(ctx, L, logs) {
  const { group, heightAt } = ctx;
  const R = L.rot;
  const at = (lx, lz) => { const o = rot2(lx, lz, R); return { x: L.x + o.x, z: L.z + o.z }; };
  const maxGround = (cx, cz, hw, hd) => {
    let m = -1e9;
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
      const p = at(cx - hw + (i / 4) * hw * 2, cz - hd + (j / 4) * hd * 2);
      m = Math.max(m, heightAt(p.x, p.z));
    }
    return m;
  };
  const minGround = (cx, cz, hw, hd) => {
    let m = 1e9;
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
      const p = at(cx - hw + (i / 4) * hw * 2, cz - hd + (j / 4) * hd * 2);
      m = Math.min(m, heightAt(p.x, p.z));
    }
    return m;
  };

  const mat = triplanar(new THREE.MeshStandardMaterial({ color: 0xb9b4a8, roughness: 0.9 }), rockTex(), 0.35, { normalStrength: 1.3 });
  const top = maxGround(0, 0, ROCK.hw, ROCK.hd) + ROCK.height;
  const base = minGround(0, 0, ROCK.hw, ROCK.hd) - 0.4;
  const rock = new THREE.Mesh(boulderGeometry(ROCK.hw * 2 + 0.2, top - base, ROCK.hd * 2 + 0.2, 3), mat);
  rock.position.set(L.x, (top + base) / 2, L.z);
  rock.rotation.y = R;
  const sp = at(STEP.lx, STEP.lz);
  const stepTop = maxGround(STEP.lx, STEP.lz, STEP.hw, STEP.hd) + STEP.height;
  const stepBase = minGround(STEP.lx, STEP.lz, STEP.hw, STEP.hd) - 0.3;
  const step = new THREE.Mesh(boulderGeometry(STEP.hw * 2 + 0.15, stepTop - stepBase, STEP.hd * 2 + 0.15, 9), mat);
  step.position.set(sp.x, (stepTop + stepBase) / 2, sp.z);
  step.rotation.y = R + 0.08;
  for (const m of [rock, step]) { m.castShadow = m.receiveShadow = true; group.add(m); ctx.occluders.push(m); }

  // walkable tops; the sides are too high to step onto, so the player has to climb
  const inside = (x, z, cx, cz, hw, hd) => {
    const dx = x - L.x, dz = z - L.z;
    const lx = dx * Math.cos(R) - dz * Math.sin(R), lz = dx * Math.sin(R) + dz * Math.cos(R);
    return Math.abs(lx - cx) < hw && Math.abs(lz - cz) < hd;
  };
  const platformHeight = (x, z) => {
    if (Math.abs(x - L.x) > 6 || Math.abs(z - L.z) > 6) return null;
    if (inside(x, z, 0, 0, ROCK.hw - 0.1, ROCK.hd - 0.1)) return top;
    if (inside(x, z, STEP.lx, STEP.lz, STEP.hw - 0.08, STEP.hd - 0.08)) return stepTop;
    return null;
  };

  // yaw that faces local +z / +x / -z of the rock
  const yawZ = R, yawX = R + Math.PI / 2;
  const upFrom = at(0, -ROCK.hd - 1.3), upTo = at(-0.35, -ROCK.hd - 1.3 + 3.88);
  const downFrom = at(ROCK.hw - 0.45, 0), downTo = at(ROCK.hw + 0.95, 0);
  const stepFrom = at(STEP.lx, STEP.lz + STEP.hd + 1.25), stepTo = at(STEP.lx, STEP.lz);

  function interactions(api) {
    const p = () => api.player;
    const onTop = () => p().pos.y > top - 0.5;
    let sawView = false;
    const list = [
      {
        id: 'lookoutUp', kind: 'examine', x: upFrom.x, z: upFrom.z, radius: 1.6,
        available: () => !onTop(),
        label: () => T('Climb the rock'),
        use: () => p().climb('Climbing_1', upFrom, { ...upTo, y: top }, yawZ, {
          onDone: () => {
            if (sawView) return;
            sawView = true;
            api.thought(T('From here you can see over the bushes. To the east, the ridge, and on it something under a camouflage net.'), 4.5);
          },
        }),
      },
      {
        id: 'lookoutDown', kind: 'examine', x: downFrom.x, z: downFrom.z, radius: 1.4,
        available: () => onTop(),
        label: () => T('Climb down'),
        use: () => p().climb('Climbing_Down', { ...downFrom, y: top }, downTo, yawX),
      },
      {
        id: 'lookoutStep', kind: 'examine', x: stepFrom.x, z: stepFrom.z, radius: 1.3,
        available: () => p().pos.y < stepTop - 0.4,
        label: () => T('Climb the boulder'),
        use: () => p().climb('Start_Climbing_Ladder', stepFrom, { ...stepTo, y: stepTop }, yawZ + Math.PI),
      },
    ];
    // fallen trunks: climb over from either side at the middle
    logs.forEach(([x, z, , rot, r], i) => {
      const off = r + 0.1 + 0.75;
      for (const side of [-1, 1]) {
        const a = { x: x + rot2(0, side * off, rot).x, z: z + rot2(0, side * off, rot).z };
        const b = { x: x + rot2(0, -side * off, rot).x, z: z + rot2(0, -side * off, rot).z };
        list.push({
          id: `log${i}${side > 0 ? 'a' : 'b'}`, kind: 'examine', x: a.x, z: a.z, radius: 1.2,
          available: () => true,
          label: () => T('Climb over the log'),
          use: () => p().climb('Climbing', a, b, Math.atan2(b.x - a.x, b.z - a.z), { timeScale: 1.25 }),
        });
      }
    });
    return list;
  }

  return { platformHeight, interactions, top };
}
