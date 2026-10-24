// Northern ridge (Part 3): a narrow night valley north of the forest that climbs to a cliff, where a
// NIGHTJAR bunker door is set into the mountain. Loaded on demand (separate chunk), disposed when left.
import * as THREE from 'three';
import { fbm, mulberry32, smoothstep } from '../../noise.js';
import { heightAt as terrainHeight, distToTrail, DOOR_FLOOR, inFacade } from './terrain.js';
import { RL, RCABLE, RFEED, RPRINTS, RCLEARINGS, RBOUNDS } from './layout.js';
import { jungleTreeGeometries, bushGeometry, fernGeometry, grassGeometry, palmGeometries } from '../shared.js';
import { terrainMaterial, triplanar, vegetationMaterials, bakeContactShade, shadeSpotsFromColliders } from '../../gfx/materials.js';
import { litterTex, mossTex, dirtTex, rockTex } from '../../gfx/textures.js';
import { buildFootprints, buildGiantTrees, buildLogs } from '../forest/props.js';
import {
  buildBunker, buildAccessPanel, buildJunction, buildShed, buildCrate, buildTarpCamp, buildSign, buildTrailCamera,
  buildMast, buildLamps, buildCable,
} from './props.js';
import { createRidgeInteractions } from './interactions.js';
import { RESOURCE_NODES } from '../../data/resources.js';

const yieldFrame = () => new Promise((r) => setTimeout(r, 0));
const LOGS = [[12, 40, 6, 0.6, 0.42], [-16, 10, 7, 1.9, 0.45], [16, -18, 6, 2.6, 0.4]];

export async function build(env, api, onProgress = () => {}) {
  const group = new THREE.Group();
  group.name = 'zone:ridge';
  const colliders = [];
  const occluders = [];
  const rnd = mulberry32(3107);
  const shared = env.shared;
  // the doorway behind the bunker door is level with the ground in front of it
  const heightAt = (x, z) => (z < -45.9 && Math.abs(x) < 1.35 ? DOOR_FLOOR : terrainHeight(x, z));
  const ctx = { group, colliders, occluders, heightAt: terrainHeight };

  onProgress(0.1, 'The northern ridge');
  const terrain = buildTerrainMesh();
  group.add(terrain);
  await yieldFrame();

  onProgress(0.3, 'The door in the cliff');
  const bunker = buildBunker(ctx, RL.bunker, DOOR_FLOOR);
  const panel = buildAccessPanel(ctx, RL.panel, terrainHeight(RL.panel.x, RL.panel.z));
  const junction = buildJunction(ctx, RL.junction, terrainHeight(RL.junction.x, RL.junction.z));
  const shed = buildShed(ctx, RL.shed, terrainHeight(RL.shed.x, RL.shed.z));
  const crate = buildCrate(ctx, RL.crate, terrainHeight(RL.crate.x, RL.crate.z));
  const camp = buildTarpCamp(ctx, RL.tarp, terrainHeight(RL.tarp.x, RL.tarp.z), RL);
  buildSign(ctx, RL.sign, terrainHeight(RL.sign.x, RL.sign.z));
  const camera = buildTrailCamera(ctx, RL.camera, terrainHeight(RL.camera.x, RL.camera.z), { x: 2, z: 14 });
  const mast = buildMast(ctx, RL.mast, terrainHeight(RL.mast.x, RL.mast.z));
  const lamps = buildLamps(ctx, RL.lamps, terrainHeight);
  buildCable(ctx, RCABLE, terrainHeight);
  buildCable(ctx, RFEED, terrainHeight, { radius: 0.03, color: 0x2a2a2a });
  buildFootprints(ctx, RPRINTS, { fresh: true, seed: 12 });
  // freshly dug ground where the cable disappears
  const dug = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), new THREE.MeshStandardMaterial({ color: 0x2c2117, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  dug.rotation.x = -Math.PI / 2;
  dug.position.set(RL.disturbed.x, terrainHeight(RL.disturbed.x, RL.disturbed.z) + 0.04, RL.disturbed.z);
  dug.scale.set(1, 0.6, 1);
  dug.receiveShadow = true;
  group.add(dug);
  // the lamp light pools: a few real lights near the places that matter, the rest are glow sprites
  const doorLight = new THREE.PointLight(0xffc890, 3.2, 16, 1.8);
  doorLight.position.set(-3, DOOR_FLOOR + 3.4, -42);
  group.add(doorLight);
  const campLight = new THREE.PointLight(0xffc890, 1.8, 11, 1.8);
  campLight.position.set(-9, terrainHeight(-9, 38) + 2.5, 38);
  group.add(campLight);
  await yieldFrame();

  onProgress(0.55, 'Rocks and trees');
  const { trunkMat, palmTrunkMat, canopyMat, smallMat, palmLeafMat } = vegetationMaterials(shared);
  buildGiantTrees(ctx, [[-20, 50, 1.8], [18, 22, 2.0], [-22, -4, 1.9], [20, -24, 1.7]], canopyMat, trunkMat, jungleTreeGeometries);
  buildLogs(ctx, LOGS);
  buildRocks(ctx, rnd);
  await yieldFrame();
  onProgress(0.75, 'Plants');
  const smallChunks = buildVegetation(ctx, rnd, { trunkMat, palmTrunkMat, canopyMat, smallMat, palmLeafMat });
  bakeContactShade(terrain, shadeSpotsFromColliders(colliders));
  await yieldFrame();

  const parts = { bunker, panel, junction, shed, crate, camp, camera, mast, lamps };
  let cullT = 0;
  let doorAnim = null;

  const zone = {
    id: 'ridge',
    group, colliders, occluders, heightAt,
    isPlatform: (x, z) => z < -45.9 && Math.abs(x) < 1.35,
    bounds: RBOUNDS,
    deepWater: null,
    cameraFar: 220,
    parts,
    time: () => 'night',
    fogDensity: () => 0.02,
    spawns: {
      fromForest: { x: RL.entry.x, z: RL.entry.z, yaw: Math.PI },
      fromFacility: { x: 0, z: -43.4, yaw: 0 },
    },
    exits: [{
      to: 'forest', spawn: 'fromRidge',
      when: () => true,
      test: (x, z) => z > 65.5 && Math.abs(x) < 10,
    }, {
      to: 'facility', spawn: 'fromRidge',
      when: (s) => !!s.flags.doorOpen && !doorAnim,
      test: (x, z) => z < -46.8 && Math.abs(x) < 1.1,
    }],
    trailhead: { x: 0, z: 65 },
    boundaryText(type) {
      return {
        forest: 'The cliff. The only way in is the door.',
        sea: 'The trail back to the forest is to the south.',
        side: 'The valley walls are too steep to climb.',
        cliff: 'Too steep. The valley only goes one way: up, toward the cliff.',
      }[type];
    },
    ambience() { return { sea: 0, forest: 0.7, stream: 0 }; },
    sync(s) {
      const f = s.flags;
      const powered = !!f.genRunning && !!f.junctionWired;
      bunker.warnMat.emissiveIntensity = powered ? 2 : 0;
      bunker.lampMat.emissiveIntensity = f.doorOpen ? 2.2 : 0;
      bunker.innerLight.intensity = f.doorOpen ? 1.6 : 0;
      if (!doorAnim) {
        bunker.setOpen(f.doorOpen ? 1 : 0);
        zone.setDoorBlocked(!f.doorOpen);
      }
      panel.draw(f.doorOpen ? 'granted' : powered ? 'ready' : 'off');
      shed.fuse.visible = !!f.fuseInstalled;
      shed.ledMat.emissiveIntensity = f.genRunning ? 2 : 0;
      junction.coverPivot.rotation.y = f.junctionSeen || f.junctionWired ? -1.9 : 0;
      junction.ledMat.emissiveIntensity = powered ? 2 : 0;
      zone.syncInteractables && zone.syncInteractables(s);
    },
    setDoorBlocked(on) {
      const i = colliders.indexOf(bunker.doorCol);
      if (on && i < 0) colliders.push(bunker.doorCol);
      if (!on && i >= 0) colliders.splice(i, 1);
    },
    // the heavy door: both leaves slide into the concrete over ~3 s
    openDoor(done) {
      doorAnim = { t: 0, dur: 3.2, done };
    },
    update(dt, t, focus) {
      // the red signal on the mast blinks like the old one at the transmitter
      mast.sigMat.opacity = (t % 1.6) < 0.45 ? 1 : 0.1;
      // a lamp or two buzzes and flickers
      lamps.mats.forEach((m, i) => { m.opacity = (i === 3 && Math.sin(t * 19) > 0.93) || (i === 5 && (t % 6.1) < 0.12) ? 0.12 : 0.55; });
      // warning light: rotating beacon once the door has power
      if (bunker.warnMat.emissiveIntensity > 0) bunker.warnLight.intensity = 1.2 + Math.max(0, Math.sin(t * 6)) * 3;
      else bunker.warnLight.intensity = 0;
      camp.recLed.emissiveIntensity = (t % 2) < 1 ? 0.8 : 0.1;
      camp.radioLed.emissiveIntensity = 0.4 + Math.random() * 0.5;
      if (doorAnim) {
        doorAnim.t += dt;
        const k = Math.min(1, doorAnim.t / doorAnim.dur);
        bunker.setOpen(k * k * (3 - 2 * k));
        if (k >= 1) {
          const d = doorAnim.done;
          doorAnim = null;
          zone.setDoorBlocked(false);
          d && d();
        }
      }
      if ((cullT += dt) > 0.25 && focus) {
        cullT = 0;
        for (const c of smallChunks) c.mesh.visible = (c.cx - focus.x) ** 2 + (c.cz - focus.z) ** 2 < c.maxD2;
      }
    },
  };
  createRidgeInteractions(zone, api);
  return zone;
}

// ---------------------------------------------------------------- terrain mesh
function buildTerrainMesh() {
  const W = 110, D = 170, SX = 176, SZ = 272;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -5);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3), splat = new Float32Array(pos.count * 4), wet = new Float32Array(pos.count);
  const w = [0, 0, 0, 0];
  const lerpTo = (k, ch) => { for (let j = 0; j < 4; j++) w[j] += ((j === ch ? 1 : 0) - w[j]) * k; };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const n = fbm(x * 0.09, z * 0.09, 3), n2 = fbm(x * 0.025 + 3, z * 0.025, 3);
    w[0] = 1; w[1] = w[2] = w[3] = 0;
    lerpTo(smoothstep(0.42, 0.7, n), 1);
    let clear = 0;
    for (const cl of RCLEARINGS) {
      const d = Math.hypot(x - cl.x, z - cl.z);
      if (d < cl.r) clear = Math.max(clear, 1 - smoothstep(cl.r * 0.5, cl.r, d));
    }
    lerpTo(clear * 0.5, 2);
    const pd = distToTrail(x, z);
    lerpTo((1 - smoothstep(0.7, 2.1, pd + (n - 0.5) * 1.0)) * 0.92, 2);
    const slope = Math.abs(terrainHeight(x + 1, z) - h) + Math.abs(terrainHeight(x, z + 1) - h);
    lerpTo(smoothstep(0.55, 1.1, slope), 3);
    // the ground gets stonier toward the mountain
    lerpTo(smoothstep(-20, -48, z) * 0.35 * n2, 3);
    if (inFacade(x, z)) lerpTo(1, 3);
    splat.set(w, i * 4);
    wet[i] = 0;
    const v = 0.8 + n2 * 0.36;
    colors[i * 3] = v; colors[i * 3 + 1] = v * 1.01; colors[i * 3 + 2] = v * 0.97;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
  geo.setAttribute('wet', new THREE.BufferAttribute(wet, 1));
  geo.computeVertexNormals();
  const mat = terrainMaterial([
    { tex: litterTex(), scale: 1 / 3, rough: 0.94 },
    { tex: mossTex(), scale: 1 / 3.5, rough: 0.97 },
    { tex: dirtTex(), scale: 1 / 3.2, rough: 0.95 },
    { tex: rockTex(), scale: 1 / 6, rough: 0.8 },
  ]);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ridge-terrain';
  return mesh;
}

// ---------------------------------------------------------------- rocks: talus along the walls and the cliff foot
function buildRocks(ctx, rnd) {
  const variants = [1, 2, 3].map((seed) => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 0.75 + fbm(x * 1.4 + seed * 10, z * 1.4 + y * 1.4, 3) * 0.6;
      p.setXYZ(i, x * n, y * n * 0.72, z * n);
    }
    g.computeVertexNormals();
    return g;
  });
  const mat = triplanar(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 }), rockTex(), 0.35, { normalStrength: 1.2 });
  const list = [];
  const keep = (x, z) => distToTrail(x, z) < 3 || RCLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 0.5) || Math.abs(x) < 6 && z < -40;
  for (let i = 0; i < 70; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const z = -46 + rnd() * 112;
    const x = side * (22 + rnd() * 10) + Math.sin(z * 0.045) * 4;
    if (!keep(x, z)) list.push([x, z, 0.8 + rnd() * 2.2]);
  }
  for (let i = 0; i < 26; i++) {
    const x = -30 + rnd() * 60, z = -50 + rnd() * 5;
    if (!keep(x, z) && Math.abs(x) > 6) list.push([x, z, 1 + rnd() * 2]);
  }
  for (let i = 0; i < 50; i++) {
    const x = -24 + rnd() * 48, z = -44 + rnd() * 108;
    if (!keep(x, z)) list.push([x, z, 0.3 + rnd() * rnd() * 1.6]);
  }
  // the rocks the cable disappears under
  list.push([2.2, -29, 1.1], [3.4, -30.2, 0.8], [0.9, -30.5, 0.7]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const buckets = [[], [], []];
  list.forEach((r, i) => buckets[i % 3].push(r));
  buckets.forEach((b, vi) => {
    const im = new THREE.InstancedMesh(variants[vi], mat, b.length);
    b.forEach(([x, z, s], i) => {
      e.set(rnd() * 0.4, rnd() * 6.28, rnd() * 0.4);
      q.setFromEuler(e);
      sc.set(s * (0.9 + rnd() * 0.3), s * (0.8 + rnd() * 0.4), s * (0.9 + rnd() * 0.3));
      v.set(x, terrainHeight(x, z) - s * 0.2, z);
      im.setMatrixAt(i, m4.compose(v, q, sc));
      const g = 0.5 + rnd() * 0.25;
      col.setRGB(g, g * 1.02, g * 0.97);
      im.setColorAt(i, col);
      if (s > 0.6) ctx.colliders.push({ type: 'circle', x, z, r: s * 0.9 });
    });
    im.castShadow = true;
    im.receiveShadow = true;
    ctx.group.add(im);
    ctx.occluders.push(im);
  });
}

// ---------------------------------------------------------------- vegetation (chunked instancing, like the forest)
function buildVegetation(ctx, rnd, mats) {
  const { group, colliders } = ctx;
  const CHUNK = 32;
  const keep = [
    ...RCLEARINGS.map((c) => [c.x, c.z, c.r]),
    [RL.sign.x, RL.sign.z, 2.5], [RL.camera.x, RL.camera.z, 3], [RL.fragment.x, RL.fragment.z, 2], [RL.disturbed.x, RL.disturbed.z, 2.5],
    [RL.junction.x, RL.junction.z, 3], ...RL.lamps.map(([x, z]) => [x, z, 1.5]),
    ...RESOURCE_NODES.filter((n) => n.zone === 'ridge').map((n) => [n.x, n.z, 2]),
  ];
  const free = (x, z, pathMargin, clearMul = 1) => {
    if (distToTrail(x, z) < pathMargin) return false;
    if (Math.abs(x) < 7 && z < -38) return false; // the bunker apron stays clear
    for (const [kx, kz, kr] of keep) if ((x - kx) ** 2 + (z - kz) ** 2 < (kr * clearMul) ** 2) return false;
    return true;
  };
  const steep = (x, z) => {
    const h = terrainHeight(x, z);
    return Math.abs(terrainHeight(x + 1.2, z) - h) + Math.abs(terrainHeight(x, z + 1.2) - h) > 1.2;
  };
  const trees = [[], [], []], palms = [], bushes = [], ferns = [], grass = [];
  for (let i = 0; i < 14000; i++) {
    const x = -55 + rnd() * 110, z = -60 + rnd() * 140;
    const r = rnd();
    const dense = 0.5 + fbm(x * 0.04, z * 0.04, 2) * 0.9 + smoothstep(18, 30, Math.abs(x)) * 0.6; // thicker toward the walls
    if (r < 0.03 * dense && free(x, z, 3.2) && !steep(x, z) && z > -47) trees[i % 3].push([x, z]);
    else if (r > 0.95 && r < 0.952 && z > 20 && free(x, z, 2.6)) palms.push([x, z]);
    else if (r > 0.1 && r < 0.14 && free(x, z, 1.8)) bushes.push([x, z]);
    else if (r > 0.2 && r < 0.27 && free(x, z, 1.1, 0.75)) ferns.push([x, z]);
    else if (r > 0.3 && r < 0.335 && free(x, z, 1.0, 0.6)) grass.push([x, z]);
  }
  const inPlay = (x, z) => x > RBOUNDS.minX - 4 && x < RBOUNDS.maxX + 4 && z > RBOUNDS.minZ - 4 && z < RBOUNDS.maxZ + 4;
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const place = (list, opts) => list.map(([x, z]) => {
    const s = opts.scale[0] + rnd() * (opts.scale[1] - opts.scale[0]);
    e.set(0, rnd() * Math.PI * 2, 0);
    q.setFromEuler(e);
    sc.setScalar(s);
    v.set(x, terrainHeight(x, z) - (opts.sink || 0), z);
    const m = new THREE.Matrix4().compose(v, q, sc);
    const k = (0.8 + rnd() * 0.25) * (opts.tint || 1);
    const c = new THREE.Color(k, k * 1.02, k * 0.95);
    if (opts.collide && inPlay(x, z)) colliders.push({ type: 'circle', x, z, r: opts.collide * s });
    return { m, c, cx: Math.floor(x / CHUNK), cz: Math.floor(z / CHUNK) };
  });
  const small = [];
  const add = (geo, mat, placed, shadow, maxD, occlude = false) => {
    const groups = new Map();
    // only small plants are culled by distance in chunks; trees are one draw per type
    for (const p of placed) { const k = maxD ? p.cx + ',' + p.cz : 'all'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    for (const list of groups.values()) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => { im.setMatrixAt(i, p.m); im.setColorAt(i, p.c); });
      im.computeBoundingSphere();
      im.castShadow = shadow;
      im.receiveShadow = true;
      group.add(im);
      if (occlude) ctx.occluders.push(im);
      if (maxD) small.push({ mesh: im, cx: (list[0].cx + 0.5) * CHUNK, cz: (list[0].cz + 0.5) * CHUNK, maxD2: maxD * maxD });
    }
  };
  trees.forEach((list, i) => {
    const tg = jungleTreeGeometries(420 + i * 31);
    const set = place(list, { scale: [0.85, 1.5], collide: 0.5, sink: 0.25 });
    add(tg.trunk, mats.trunkMat, set, true);
    add(tg.leaves, mats.canopyMat, set, true);
  });
  const palm = palmGeometries();
  const pset = place(palms, { scale: [0.9, 1.2], collide: 0.33, sink: 0.1 });
  add(palm.trunk, mats.palmTrunkMat, pset, true);
  add(palm.leaves, mats.palmLeafMat, pset, true);
  add(bushGeometry(13), mats.canopyMat, place(bushes, { scale: [0.8, 1.6], sink: 0.1 }), true, 70, true);
  add(fernGeometry(), mats.smallMat, place(ferns, { scale: [0.8, 1.5], tint: 1.1 }), false, 55);
  add(grassGeometry(), mats.smallMat, place(grass, { scale: [0.8, 1.4] }), false, 40);
  return small;
}
