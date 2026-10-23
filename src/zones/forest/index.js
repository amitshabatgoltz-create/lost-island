// Forest zone (Part 2): night jungle, stream, eastern ridge, the relay transmitter, the research camp
// and the observation post. Loaded on demand (separate chunk) and fully disposed when the player leaves.
import * as THREE from 'three';
import { fbm, mulberry32, smoothstep } from '../../noise.js';
import { heightAt as terrainHeight, streamZ, streamLevel, distToPaths } from './terrain.js';
import { FL, PRINTS, CLEARINGS, BOUNDS } from './layout.js';
import {
  grainTexture, swayMaterial, palmGeometries, jungleTreeGeometries, bushGeometry, fernGeometry, grassGeometry, softSprite,
} from '../shared.js';
import { canvasTex } from '../../items.js';
import {
  buildTransmitter, buildSupplyDrop, buildTent, buildCabin, buildTable, buildCampProps, buildStringLights, buildLocker,
  buildPost, buildFootprints, buildFigure, buildStream, buildBridge, buildLogs, buildGiantTrees,
  buildCarvedTree, buildCampScope,
} from './props.js';
import { CARVINGS, SYMBOLS } from '../../data/puzzles.js';
import { createForestInteractions } from './interactions.js';
import { RESOURCE_NODES } from '../../data/resources.js';

const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

export async function build(env, api, onProgress = () => {}) {
  const group = new THREE.Group();
  group.name = 'zone:forest';
  const colliders = [];
  const occluders = [];
  const rnd = mulberry32(2207);
  const shared = env.shared;

  // walkable height = terrain, except inside the cabin and on the bridge
  let cabin = null, bridgeHeight = () => null;
  const heightAt = (x, z) => {
    if (cabin && cabin.inside(x, z)) return cabin.floorY;
    const b = bridgeHeight(x, z);
    const t = terrainHeight(x, z);
    return b !== null ? Math.max(b, t) : t;
  };
  const ctx = { group, colliders, occluders, heightAt: terrainHeight };

  onProgress(0.1, 'פני השטח של היער');
  group.add(buildTerrainMesh());
  buildStream(ctx, streamZ, streamLevel, shared);
  bridgeHeight = buildBridge(ctx, FL.bridge, terrainHeight);
  await yieldFrame();

  onProgress(0.3, 'המשדר');
  const transmitter = buildTransmitter(ctx, FL.transmitter, FL.mast);
  const supply = buildSupplyDrop(ctx, FL.powerSite);
  for (const c of CARVINGS) buildCarvedTree(ctx, c, SYMBOLS.find((s) => s.id === c.symbol).path);
  await yieldFrame();

  onProgress(0.45, 'המחנה');
  const mapTex = canvasTex(330, 240, (c, w, h) => {
    c.fillStyle = '#ddd0ae'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#4d6f86'; c.lineWidth = 4; c.beginPath(); c.moveTo(10, 140); c.bezierCurveTo(100, 120, 200, 160, 320, 130); c.stroke();
    c.strokeStyle = '#5a4630'; c.setLineDash([6, 5]); c.lineWidth = 2; c.beginPath(); c.moveTo(20, 222); c.bezierCurveTo(120, 205, 220, 230, 320, 215); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#3a2e20'; c.lineWidth = 3; c.strokeRect(190, 40, 22, 16); c.beginPath(); c.arc(110, 80, 9, 0, 7); c.stroke();
    c.strokeStyle = '#8a2c1f'; c.lineWidth = 5; c.beginPath(); c.moveTo(150, 195); c.lineTo(168, 213); c.moveTo(168, 195); c.lineTo(150, 213); c.stroke();
    c.fillStyle = '#8a2c1f'; c.font = 'bold 18px monospace'; c.fillText('LZ-2', 100, 205);
    c.fillStyle = '#3a2e20'; c.font = 'bold 14px monospace'; c.fillText('CAMP', 218, 54); c.fillText('RELAY', 64, 76); c.fillText('RIDGE', 262, 90);
  });
  cabin = buildCabin(ctx, FL.cabin, mapTex);
  buildTent(ctx, FL.tent);
  const table = buildTable(ctx, FL.table);
  buildCampProps(ctx, FL);
  const tentTop = new THREE.Vector3(FL.tent.x, terrainHeight(FL.tent.x, FL.tent.z) + 1.75, FL.tent.z);
  const cabinCorner = new THREE.Vector3(FL.cabin.x - 2.4, cabin.floorY + 2.4, FL.cabin.z + 2.3);
  const stringMat = buildStringLights(ctx, tentTop, cabinCorner);
  const locker = buildLocker(ctx, FL.locker);
  const campLight = new THREE.PointLight(0xffc27a, 2.5, 14, 1.7);
  campLight.position.set((tentTop.x + cabinCorner.x) / 2, tentTop.y, (tentTop.z + cabinCorner.z) / 2);
  group.add(campLight);
  await yieldFrame();

  onProgress(0.55, 'הרכס');
  const post = buildPost(ctx, FL.post, FL.scope, FL.routeChart);
  buildCampScope(ctx, FL.campScope);
  // a lens glint at the observation post, only shown when looking through the camp scope
  const postGlint = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(220, 235, 255), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, fog: false, opacity: 0 }));
  postGlint.position.set(FL.scope.x, terrainHeight(FL.scope.x, FL.scope.z) + 1.3, FL.scope.z);
  postGlint.scale.setScalar(2.2);
  postGlint.renderOrder = 10;
  postGlint.visible = false;
  group.add(postGlint);
  buildFootprints(ctx, PRINTS.toPower, { seed: 3 });
  buildFootprints(ctx, PRINTS.toRidge, { fresh: true, seed: 5 });
  buildFootprints(ctx, PRINTS.stray, { fresh: true, seed: 8 });
  const figure = buildFigure(ctx);
  await yieldFrame();

  onProgress(0.65, 'עצים, שורשים וסלעים');
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95 });
  const canopyMat = swayMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, flatShading: true }, shared, 0.025);
  const smallMat = swayMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }, shared, 0.08);
  const palmLeafMat = swayMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }, shared, 0.045);
  buildGiantTrees(ctx, [[-14, 60, 1.9], [12, 18, 2.1], [-28, -2, 1.8], [-6, -46, 2.0], [40, -40, 1.9], [-60, 20, 2.2], [30, 70, 1.9], [-80, -70, 2.0]], canopyMat, trunkMat, jungleTreeGeometries);
  buildLogs(ctx, [[8, 62, 7, 0.4, 0.45], [-24, 32, 6, 1.2, 0.4], [-54, -6, 8, -0.3, 0.5], [30, -28, 6, 0.9, 0.42], [-30, -52, 7, 2.1, 0.5], [48, 20, 9, 0.2, 0.55], [-70, 60, 6, 1.6, 0.4], [10, -86, 7, 0.1, 0.45]]);
  buildRocks(ctx, rnd);
  await yieldFrame();
  onProgress(0.75, 'צמחייה');
  const smallChunks = buildVegetation(ctx, rnd, { trunkMat, canopyMat, smallMat, palmLeafMat }, cabin);
  await yieldFrame();

  onProgress(0.88, 'אורות רחוקים');
  // lights deep in the forest (switched on by the Part 2 ending) and the relocated signal
  const farMat = [];
  const farLights = FL.farLights.map(([x, z], i) => {
    const m = new THREE.SpriteMaterial({ map: softSprite(255, 236, 200), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 });
    farMat.push(m);
    const s = new THREE.Sprite(m);
    s.position.set(x, terrainHeight(x, z) + 6 + (i % 3) * 2.5, z);
    s.scale.setScalar(10);
    group.add(s);
    return s;
  });
  const newSigMat = new THREE.SpriteMaterial({ map: softSprite(255, 40, 30), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 });
  const newSignal = new THREE.Sprite(newSigMat);
  newSignal.position.set(FL.newSignal.x, terrainHeight(FL.newSignal.x, FL.newSignal.z) + FL.newSignal.y, FL.newSignal.z);
  newSignal.scale.setScalar(20);
  group.add(newSignal);
  await yieldFrame();

  const parts = { transmitter, supply, postGlint, table, cabin, locker, post, figure, stringMat, campLight, farLights, farMat, newSignal, newSigMat };
  let cullT = 0;
  let farOn = 0; // number of far lights switched on
  let newSignalOn = false;

  const zone = {
    id: 'forest',
    group, colliders, occluders, heightAt,
    isPlatform: (x, z) => cabin.inside(x, z) || bridgeHeight(x, z) !== null,
    bounds: BOUNDS,
    deepWater: null,
    cameraFar: 200,
    parts,
    time: () => 'night',
    fogDensity: () => 0.022,
    spawns: {
      fromBeach: { x: FL.entry.x, z: FL.entry.z, yaw: Math.PI },
    },
    exits: [{
      to: 'beach', spawn: 'fromForest',
      when: () => true,
      test: (x, z) => z > 101.5 && Math.abs(x) < 9,
    }],
    trailhead: { x: 0, z: 101 },
    ambience(p) {
      const sd = Math.abs(p.z - streamZ(p.x));
      return { sea: 0, forest: 1, stream: Math.max(0, 1 - sd / 26) };
    },
    titleCamera(camera, t) {
      const c = FL.transmitter;
      camera.position.set(c.x + Math.sin(t) * 22, terrainHeight(c.x, c.z) + 9, c.z + Math.cos(t) * 22);
      camera.lookAt(FL.mast.x, terrainHeight(c.x, c.z) + 8, FL.mast.z);
    },
    setFarLights(n) { farOn = n; },
    setNewSignal(on) { newSignalOn = on; },
    sync(s) {
      const f = s.flags;
      transmitter.setStage({ cell: !!f.cellInserted, wired: !!f.wired, on: !!f.powerInstalled, mode: s.questIndex === 14 ? 'call' : f.endingSeen ? 'dead' : 'on' });
      supply.setOpen(!!f.crateOpen || s.collected.includes('powerCell'));
      transmitter.setRed(s.flags.endingSeen ? 'off' : 'blink');
      if (s.flags.endingSeen) { farOn = farLights.length; newSignalOn = true; }
      zone.syncInteractables && zone.syncInteractables(s);
    },
    update(dt, t, focus, camera) {
      transmitter.update(dt, t, camera ? camera.position : null);
      // camp lights flicker (bulbs, string lights, cabin window)
      const flick = Math.sin(t * 23) > 0.92 || (t % 7.3) < 0.18 || ((t * 1.7) % 11) < 0.08 ? 0.15 : 1;
      cabin.light.intensity = 3 * flick;
      cabin.bulbMat.emissiveIntensity = 2 * flick;
      cabin.win.material.emissiveIntensity = 0.9 * flick;
      stringMat.emissiveIntensity = 1.6 * (Math.sin(t * 17 + 1) > 0.95 ? 0.2 : flick);
      campLight.intensity = 2.5 * flick;
      table.glassMat.emissiveIntensity = 1.3 + Math.sin(t * 9) * 0.2;
      table.lanternGlow.material.opacity = 0.5 + Math.sin(t * 9) * 0.08;
      // far lights + relocated signal
      farMat.forEach((m, i) => { m.opacity += ((i < farOn ? 0.95 : 0) - m.opacity) * Math.min(1, dt * 6); });
      newSigMat.opacity = newSignalOn ? ((t % 1.6) < 0.45 ? 1 : 0.08) : 0;
      if (postGlint.visible) postGlint.material.opacity = (t % 1.7) < 0.22 ? 1 : 0.06;
      // hide small plants that are far away (cheap distance LOD)
      if ((cullT += dt) > 0.25 && focus) {
        cullT = 0;
        for (const c of smallChunks) c.mesh.visible = (c.cx - focus.x) ** 2 + (c.cz - focus.z) ** 2 < c.maxD2;
      }
    },
  };
  createForestInteractions(zone, api);
  return zone;
}

// ---------------------------------------------------------------- terrain mesh
function buildTerrainMesh() {
  const W = 240, D = 290, SX = 150, SZ = 180;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -30);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const litter = new THREE.Color(0x3b3524), moss = new THREE.Color(0x30442a), dirt = new THREE.Color(0x5a4831);
  const rock = new THREE.Color(0x58554f), mud = new THREE.Color(0x2f2a22), clearing = new THREE.Color(0x4a4a2c);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const n = fbm(x * 0.09, z * 0.09, 3);
    c.copy(litter).lerp(moss, smoothstep(0.35, 0.7, n));
    for (const cl of CLEARINGS) {
      const d = Math.hypot(x - cl.x, z - cl.z);
      if (d < cl.r) c.lerp(clearing, (1 - smoothstep(cl.r * 0.5, cl.r, d)) * 0.6);
    }
    const pd = distToPaths(x, z);
    c.lerp(dirt, (1 - smoothstep(0.9, 2.3, pd)) * 0.9);
    const sd = Math.abs(z - streamZ(x));
    c.lerp(mud, 1 - smoothstep(2.5, 5.5, sd));
    const slope = Math.abs(terrainHeight(x + 1, z) - h) + Math.abs(terrainHeight(x, z + 1) - h);
    c.lerp(rock, smoothstep(0.7, 1.4, slope));
    const v = 0.85 + n * 0.3;
    colors[i * 3] = c.r * v; colors[i * 3 + 1] = c.g * v; colors[i * 3 + 2] = c.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const tex = grainTexture();
  tex.repeat.set(80, 90);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, map: tex }));
  mesh.receiveShadow = true;
  mesh.name = 'forest-terrain';
  return mesh;
}

// ---------------------------------------------------------------- rocks
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
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
  const list = [];
  // boulders along the cliff foot and on the plateau
  for (let i = 0; i < 46; i++) {
    const z = -96 + rnd() * 190;
    if (Math.abs(z + 60) < 16) continue; // keep the ramp clear
    list.push([52 + rnd() * 4, z, 0.8 + rnd() * 1.8]);
  }
  for (let i = 0; i < 70; i++) {
    const x = -100 + rnd() * 200, z = -110 + rnd() * 215;
    if (distToPaths(x, z) < 3 || CLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 1)) continue;
    if (Math.abs(z - streamZ(x)) < 2.5 && rnd() > 0.3) continue;
    list.push([x, z, 0.35 + rnd() * rnd() * 2]);
  }
  // stepping stones in the stream
  for (const x of [-30, -29, -27.8, 22, 23.2, 24.5]) list.push([x, streamZ(x) + (rnd() - 0.5), 0.45]);
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
      const g = 0.24 + rnd() * 0.1;
      col.setRGB(g, g * 1.02, g * 0.95);
      im.setColorAt(i, col);
      if (s > 0.6 && x > BOUNDS.minX - 4 && x < BOUNDS.maxX + 4) ctx.colliders.push({ type: 'circle', x, z, r: s * 0.9 });
    });
    im.castShadow = true;
    im.receiveShadow = true;
    ctx.group.add(im);
    ctx.occluders.push(im);
  });
}

// ---------------------------------------------------------------- vegetation (chunked instancing)
function buildVegetation(ctx, rnd, mats, cabin) {
  const { group, colliders } = ctx;
  const CHUNK = 32;
  const keep = [
    ...CLEARINGS.map((c) => [c.x, c.z, c.r]),
    [FL.cabin.x, FL.cabin.z, 6], [FL.bridge.x, FL.bridge.z, 6], [FL.post.x, FL.post.z, 9], [FL.campScope.x, FL.campScope.z, 3],
    ...CARVINGS.flatMap((c) => [[c.tree.x, c.tree.z, 3.2], [c.look.x, c.look.z, 2]]),
    ...RESOURCE_NODES.filter((n) => n.zone === 'forest').map((n) => [n.x, n.z, 2]),
  ];
  const free = (x, z, pathMargin, clearMul = 1) => {
    if (distToPaths(x, z) < pathMargin) return false;
    for (const [kx, kz, kr] of keep) if ((x - kx) ** 2 + (z - kz) ** 2 < (kr * clearMul) ** 2) return false;
    return true;
  };
  const inPlay = (x, z) => x > BOUNDS.minX - 4 && x < BOUNDS.maxX + 4 && z > BOUNDS.minZ - 4 && z < BOUNDS.maxZ + 4;
  const steep = (x, z) => {
    const h = terrainHeight(x, z);
    return Math.abs(terrainHeight(x + 1.2, z) - h) + Math.abs(terrainHeight(x, z + 1.2) - h) > 1.3;
  };
  const trees = [[], [], []], palms = [], bushes = [], ferns = [], grass = [];
  for (let i = 0; i < 26000; i++) {
    const x = -118 + rnd() * 236, z = -160 + rnd() * 285;
    const sd = Math.abs(z - streamZ(x));
    const r = rnd();
    const dense = 0.6 + fbm(x * 0.03, z * 0.03, 2) * 0.8; // patches of thicker jungle
    if (r < 0.034 * dense && sd > 4.5 && free(x, z, 3.0) && !steep(x, z)) trees[i % 3].push([x, z]);
    else if (r > 0.95 && r < 0.953 && z > 40 && sd > 4.5 && free(x, z, 2.6)) palms.push([x, z]);
    else if (r > 0.1 && r < 0.13 && sd > 3 && free(x, z, 1.8)) bushes.push([x, z]);
    else if (r > 0.2 && r < 0.27 && sd > 2.8 && free(x, z, 1.1, 0.75)) ferns.push([x, z]);
    else if (r > 0.3 && r < 0.335 && sd > 3 && free(x, z, 1.0, 0.6)) grass.push([x, z]);
  }
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const place = (list, opts) => list.map(([x, z]) => {
    const s = opts.scale[0] + rnd() * (opts.scale[1] - opts.scale[0]);
    e.set(0, rnd() * Math.PI * 2, 0);
    q.setFromEuler(e);
    sc.setScalar(s);
    v.set(x, terrainHeight(x, z) - (opts.sink || 0), z);
    const m = new THREE.Matrix4().compose(v, q, sc);
    const k = (0.82 + rnd() * 0.25) * (opts.tint || 1);
    const c = new THREE.Color(k, k * 1.02, k * 0.95);
    if (opts.collide && inPlay(x, z)) colliders.push({ type: 'circle', x, z, r: opts.collide * s });
    return { m, c, cx: Math.floor(x / CHUNK), cz: Math.floor(z / CHUNK) };
  });
  const small = [];
  const add = (geo, mat, placed, shadow, maxD, occlude = false) => {
    const groups = new Map();
    for (const p of placed) { const k = p.cx + ',' + p.cz; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    for (const list of groups.values()) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => { im.setMatrixAt(i, p.m); im.setColorAt(i, p.c); });
      im.computeBoundingSphere();
      im.castShadow = shadow;
      im.receiveShadow = true;
      group.add(im);
      if (occlude) ctx.occluders.push(im); // the camera pulls in instead of ending up inside a bush
      if (maxD) small.push({ mesh: im, cx: (list[0].cx + 0.5) * CHUNK, cz: (list[0].cz + 0.5) * CHUNK, maxD2: maxD * maxD });
    }
  };
  trees.forEach((list, i) => {
    const tg = jungleTreeGeometries(300 + i * 31);
    const set = place(list, { scale: [0.9, 1.6], collide: 0.5, sink: 0.25 });
    add(tg.trunk, mats.trunkMat, set, true);
    add(tg.leaves, mats.canopyMat, set, true);
  });
  const palm = palmGeometries();
  const pset = place(palms, { scale: [0.9, 1.2], collide: 0.33, sink: 0.1 });
  add(palm.trunk, mats.trunkMat, pset, true);
  add(palm.leaves, mats.palmLeafMat, pset, true);
  add(bushGeometry(11), mats.canopyMat, place(bushes, { scale: [0.8, 1.7], sink: 0.1 }), true, 80, true);
  add(fernGeometry(), mats.smallMat, place(ferns, { scale: [0.8, 1.6], tint: 1.1 }), false, 60);
  add(grassGeometry(), mats.smallMat, place(grass, { scale: [0.8, 1.4] }), false, 45);
  void cabin;
  return small;
}
