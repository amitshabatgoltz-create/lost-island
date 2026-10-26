// Beach zone (Part 1 crash site): terrain, sea, wreckage, rocks, vegetation, distant signal mast.
// Everything is added to one group so the zone can be disposed when the player leaves.
import * as THREE from 'three';
import { fbm, mulberry32, smoothstep } from '../../noise.js';
import { heightAt, shoreZ, distToPaths, inlandDist, BOUNDS } from './terrain.js';
import { LAYOUT, ITEM_SPOTS } from './layout.js';
import {
  jitterGeometry, colorize, merge, shadowAll, makeSeat, makeSuitcaseMesh, softSprite,
  stencilTexture, palmGeometries, jungleTreeGeometries, bushGeometry, fernGeometry, grassGeometry,
} from '../shared.js';
import { createBeachInteractions } from './interactions.js';
import { buildBaseCamp } from './basecamp.js';
import { MINIMAP } from './minimap.js';
import { RESOURCE_NODES } from '../../data/resources.js';
import { terrainMaterial, bakeContactShade, vegetationMaterials, triplanar, scaleUV, shadeSpotsFromColliders } from '../../gfx/materials.js';
import { sandTex, grassTex, dirtTex, rockTex, rippleNormal, panelTex } from '../../gfx/textures.js';

const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

export async function build(env, api, onProgress = () => {}) {
  const group = new THREE.Group();
  group.name = 'zone:beach';
  const shared = env.shared;
  const colliders = []; // {type:'circle',x,z,r} | {type:'box',x,z,hw,hd,rot}
  const occluders = []; // meshes the camera should not pass through
  const updaters = [];
  const rnd = mulberry32(1337);

  onProgress(0.15, 'Island terrain');
  const terrain = buildTerrain();
  group.add(terrain);
  await yieldFrame();

  onProgress(0.3, 'The sea');
  group.add(buildSea(shared));
  await yieldFrame();

  onProgress(0.42, 'Plane wreckage');
  const wreck = buildWreck(group, colliders, occluders, updaters, rnd);
  await yieldFrame();

  onProgress(0.55, 'Rocks');
  buildRocks(group, colliders, occluders, rnd);
  await yieldFrame();

  onProgress(0.68, 'Jungle and plants');
  buildVegetation(group, colliders, shared, rnd);
  await yieldFrame();

  bakeContactShade(terrain, shadeSpotsFromColliders(colliders));

  onProgress(0.82, 'The signal');
  const signal = buildSignalMast(group);
  const peak = new THREE.Mesh(
    new THREE.ConeGeometry(90, 95, 9, 3),
    new THREE.MeshStandardMaterial({ color: 0x3d4a3a, roughness: 1, flatShading: true })
  );
  jitterGeometry(peak.geometry, 7, 5);
  peak.position.set(-40, heightAt(-40, -300) + 20, -300);
  group.add(peak);

  // floating debris that bobs on the waves
  const floaters = [];
  const floatMat = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.7 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0x27466e, roughness: 0.9 });
  [[-18, 44, 'p'], [6, 52, 'c'], [26, 47, 'p'], [-34, 58, 'c'], [44, 60, 'p']].forEach(([x, z, k]) => {
    const m = new THREE.Mesh(k === 'p' ? new THREE.BoxGeometry(2.2, 0.12, 1.1) : new THREE.BoxGeometry(0.9, 0.25, 0.6), k === 'p' ? floatMat : cushionMat);
    m.position.set(x, 0, z);
    m.rotation.y = rnd() * 6;
    m.castShadow = true;
    group.add(m);
    floaters.push(m);
  });

  onProgress(0.86, 'The camp');
  const base = buildBaseCamp(group, colliders, occluders, heightAt, LAYOUT.base);

  onProgress(0.9, 'Placing items');
  await yieldFrame();

  function waveHeight(x, z, t) {
    return Math.sin(x * 0.12 + t * 0.9) * 0.18 + Math.sin(z * 0.21 - t * 1.3 + x * 0.05) * 0.22 + Math.sin((x + z) * 0.35 + t * 1.7) * 0.07;
  }

  const zone = {
    id: 'beach',
    group, colliders, occluders, heightAt,
    bounds: BOUNDS,
    minimap: MINIMAP,
    deepWater: -0.6,
    cameraFar: 4000,
    wreck, signal, base,
    time: (s) => (s.flags.nightfall ? 'night' : 'day'),
    fogDensity: (s) => (s.flags.nightfall ? 0.009 : undefined),
    spawns: {
      wake: { x: LAYOUT.spawn.x, z: LAYOUT.spawn.z, yaw: Math.atan2(LAYOUT.fuselage.x - LAYOUT.spawn.x, LAYOUT.fuselage.z - LAYOUT.spawn.z) },
      fromForest: { x: 1, z: -93, yaw: 0 },
    },
    // walking north up the jungle trail opens the forest once Part 2 has begun
    exits: [{
      to: 'forest', spawn: 'fromBeach',
      when: (s) => s.questIndex >= 6,
      test: (x, z) => z < -96.5 && Math.abs(x - 1) < 8,
    }],
    trailhead: { x: 1, z: -97 },
    ambience(p) {
      const d = inlandDist(p.x, p.z);
      return { sea: Math.max(0, 1 - d / 35), forest: Math.min(1, Math.max(0, (d - 25) / 40)), stream: 0 };
    },
    // main lobby: the survivor stands on the sand facing the sea; the camera looks back at the wreck and the jungle
    lobby: {
      x: LAYOUT.lobby.x, z: LAYOUT.lobby.z, yaw: LAYOUT.lobby.yaw,
      cam: { dist: 5.2, side: 1.4, height: 1.25, lookSide: 1.3, lookY: 1.35 },
    },
    sync(s) {
      signal.setActive(s.questIndex >= 6);
      zone.syncInteractables && zone.syncInteractables(s);
    },
    update(dt, t) {
      for (const f of floaters) {
        f.position.y = waveHeight(f.position.x, f.position.z, t) + 0.05;
        f.rotation.z = Math.sin(t * 1.1 + f.position.x) * 0.08;
        f.rotation.x = Math.cos(t * 0.9 + f.position.z) * 0.08;
      }
      for (const u of updaters) u(dt, t);
      signal.update(dt, t);
    },
  };
  createBeachInteractions(zone, api);
  return zone;
}

// =====================================================================
// Terrain
// =====================================================================
function buildTerrain() {
  const W = 270, D = 250, SX = 216, SZ = 200;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  const cx = 0, cz = -65;
  geo.translate(cx, 0, cz);
  const pos = geo.attributes.position;
  // splat = texture layer weights (sand, grass, dirt, rock); color = large-scale tint; wet = darker, glossier
  const colors = new Float32Array(pos.count * 3), splat = new Float32Array(pos.count * 4), wet = new Float32Array(pos.count);
  const w = [0, 0, 0, 0];
  const lerpTo = (k, ch) => { for (let j = 0; j < 4; j++) w[j] += ((j === ch ? 1 : 0) - w[j]) * k; };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const d = inlandDist(x, z);
    const n = fbm(x * 0.08, z * 0.08, 3), n2 = fbm(x * 0.021 + 7, z * 0.021, 3);
    w[0] = 1; w[1] = w[2] = w[3] = 0;
    const grassK = smoothstep(15, 28, d + (n - 0.5) * 12);
    lerpTo(grassK, 1);
    const pd = distToPaths(x, z);
    if (d > 6) lerpTo((1 - smoothstep(0.7, 2.2, pd + (n - 0.5) * 1.2)) * 0.9 * smoothstep(11, 21, d), 2);
    // steep slopes become rock
    const slope = Math.abs(heightAt(x + 1, z) - h) + Math.abs(heightAt(x, z + 1) - h);
    lerpTo(smoothstep(0.5, 1.0, slope), 3);
    splat.set(w, i * 4);
    wet[i] = d < 0 ? 1 : 1 - smoothstep(0.4, 3.2, d);
    // tint: dry yellowish grass near the sand, deep green jungle floor, darker sea bed
    let r = 1, g = 1, b = 1;
    const v = 0.86 + n2 * 0.28;
    const dry = grassK * (1 - smoothstep(26, 40, d));
    r *= 1 + dry * 0.12; b *= 1 - dry * 0.18;
    const jungle = smoothstep(38, 62, d);
    r *= 1 - jungle * 0.32; g *= 1 - jungle * 0.18; b *= 1 - jungle * 0.3;
    if (d < 0) { const deep = Math.min(1, -d / 14); r *= 1 - deep * 0.55; g *= 1 - deep * 0.35; b *= 1 - deep * 0.25; }
    colors[i * 3] = r * v; colors[i * 3 + 1] = g * v; colors[i * 3 + 2] = b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
  geo.setAttribute('wet', new THREE.BufferAttribute(wet, 1));
  geo.computeVertexNormals();

  const mat = terrainMaterial([
    { tex: sandTex(), scale: 1 / 4, rough: 0.93 },
    { tex: grassTex(), scale: 1 / 2.6, rough: 0.96 },
    { tex: dirtTex(), scale: 1 / 3.2, rough: 0.95 },
    { tex: rockTex(), scale: 1 / 7, rough: 0.82 },
  ]);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}


// =====================================================================
// Sea with vertex waves, shallow tint and animated shore foam
// =====================================================================
function buildSea(shared) {
  const geo = new THREE.PlaneGeometry(900, 900, 160, 160);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 120);
  const ripple = rippleNormal();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a3a50, roughness: 0.16, metalness: 0.0, transparent: true, opacity: 0.94, envMapIntensity: 1.25,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.uniforms.tRipple = { value: ripple };
    const fn = `
      uniform float uTime;
      varying vec3 vWp;
      float shoreZv(float x){ return 28.0 + 7.0*sin(x*0.045+1.3) + 3.0*sin(x*0.12); }
      // waves calm down near the beach so the surface never rises above the wet sand
      float wH(vec2 p){
        float calm = smoothstep(-2.0, 14.0, p.y - shoreZv(p.x));
        return (sin(p.x*0.12 + uTime*0.9)*0.18 + sin(p.y*0.21 - uTime*1.3 + p.x*0.05)*0.22 + sin((p.x+p.y)*0.35 + uTime*1.7)*0.07) * (0.15 + 0.85 * calm) - 0.06 * (1.0 - calm);
      }`;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + fn)
      .replace('#include <beginnormal_vertex>', `
        vec2 wp0 = position.xz; float ee = 0.6;
        vec3 objectNormal = normalize(vec3(-(wH(wp0+vec2(ee,0.))-wH(wp0-vec2(ee,0.)))/(2.*ee), 1.0, -(wH(wp0+vec2(0.,ee))-wH(wp0-vec2(0.,ee)))/(2.*ee)));
      `)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position); transformed.y += wH(position.xz); vWp = (modelMatrix * vec4(transformed,1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; varying vec3 vWp; uniform sampler2D tRipple;
        float shoreZ(float x){ return 28.0 + 7.0*sin(x*0.045+1.3) + 3.0*sin(x*0.12); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float dd = vWp.z - shoreZ(vWp.x);
        if (dd < -1.0) discard; // never draw the sea inland, under the beach
        float edgeFade = 1.0 - smoothstep(70.0, 85.0, abs(vWp.x));
        // two scrolling ripple layers: small chop on top of the big vertex waves
        vec2 rp = vWp.xz;
        vec3 r1 = texture2D(tRipple, rp * 0.045 + vec2(uTime * 0.012, uTime * 0.02)).xyz * 2.0 - 1.0;
        vec3 r2 = texture2D(tRipple, rp * 0.11 + vec2(-uTime * 0.018, uTime * 0.011)).xyz * 2.0 - 1.0;
        vec2 rip = (r1.xy + r2.xy * 0.6);
        // colour by depth: clear turquoise over the sand, teal, then deep ocean blue
        float depthK = smoothstep(0.0, 26.0, dd);
        vec3 shallow = vec3(0.16, 0.56, 0.52), mid = vec3(0.04, 0.33, 0.40);
        diffuseColor.rgb = mix(mix(shallow, mid, smoothstep(0.0, 8.0, dd)), diffuseColor.rgb, depthK);
        // broken surf lines rolling in, and a soft foam edge on the sand
        float wv = sin(dd*1.3 - uTime*1.5 + sin(vWp.x*0.13)*2.0 + rip.x * 1.5);
        float brk = smoothstep(0.1, 0.7, 0.5 + 0.5*sin(vWp.x*0.9 + vWp.z*0.6 + uTime*0.7) + rip.y);
        float foam = smoothstep(0.86, 1.0, wv) * (1.0 - smoothstep(0.0, 9.0, dd)) * brk * 0.8;
        foam += (1.0 - smoothstep(0.0, 1.2 + rip.x * 0.6, dd)) * smoothstep(-0.3, 0.6, rip.y + 0.35) * 0.7;
        foam = clamp(foam * edgeFade, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9,0.93,0.93), foam);
        diffuseColor.a = mix(mix(0.42, opacity, smoothstep(0.0, 10.0, dd)), 0.92, foam);`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(roughness, 0.6, foam);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 nW = normalize((inverse(viewMatrix) * vec4(normal, 0.0)).xyz);
          nW = normalize(nW + vec3(rip.x, 0.0, -rip.y) * 0.35 * (1.0 - foam));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'sea';
  return mesh;
}

// =====================================================================
// Helpers
// =====================================================================
function placeOnGround(obj, x, z, sink = 0) {
  obj.position.set(x, heightAt(x, z) - sink, z);
  return obj;
}


// =====================================================================
// Wreckage
// =====================================================================
// painted aircraft aluminium: panel seams, rivets, grime streaks; tinted by the per-vertex livery and burn colours
const skin = (params = {}) => {
  const t = panelTex();
  return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.18, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), ...params });
};
const metalWhite = () => skin({ vertexColors: true });

function buildFuselage() {
  const R = 2.3, L = 20;
  const group = new THREE.Group();
  const jag = (a, end) => 0.3 + fbm(Math.cos(a) * 2 + end * 7, Math.sin(a) * 2, 3) * 2.2;
  function shell(radius, inner) {
    const g = new THREE.CylinderGeometry(radius, radius, L, 44, 18, true);
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x); // 0 = top after rotation
      const endT = y / (L / 2);
      if (endT > 0.99) y -= jag(a, 1);
      if (endT < -0.99) y += jag(a, 0) * 0.6;
      const dent = 1 - (fbm(y * 0.3 + 4, a * 2, 2) - 0.5) * 0.08;
      x *= dent; z *= dent;
      p.setXYZ(i, x, y, z);
      let r = 0.93, gg = 0.93, b = 0.92;
      const side = Math.abs(Math.abs(a) - Math.PI / 2);
      if (Math.abs(a) > 2.3) { r = 0.62; gg = 0.64; b = 0.66; }
      const dirt = fbm(y * 0.4, a * 3 + 2, 3);
      const burn = Math.max(0, endT - 0.6) * 1.4 + (dirt > 0.62 ? (dirt - 0.62) * 3 : 0);
      const k = Math.max(0.15, 1 - burn);
      if (inner) { r = 0.32; gg = 0.33; b = 0.35; }
      cols[i * 3] = r * k; cols[i * 3 + 1] = gg * k; cols[i * 3 + 2] = b * k;
      void side;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.rotateZ(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }
  // painted livery (cheatline, titles, window frames, door, grime) + the shared panel normal map tiled over it
  const panelN = panelTex().normalMap.clone();
  panelN.repeat.set(7, 10);
  panelN.needsUpdate = true;
  const outer = new THREE.Mesh(shell(R, false), new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness: 0.4, metalness: 0.15, map: liveryTexture(R, L), normalMap: panelN, normalScale: new THREE.Vector2(0.9, 0.9),
  }));
  const innerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.BackSide });
  const inner = new THREE.Mesh(shell(R * 0.965, true), innerMat);
  group.add(outer, inner);

  // windows
  const winGeos = [];
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 22; i++) {
      const xl = -8.6 + i * 0.75;
      if (xl > 7.2) continue;
      const a = s * (Math.PI / 2 - 0.3);
      const w = new THREE.CapsuleGeometry(0.13, 0.17, 4, 12);
      w.scale(1, 1, 0.22);
      w.rotateX(a - Math.PI / 2);
      const y = Math.cos(a) * (R + 0.01), z = Math.sin(a) * (R + 0.01);
      w.translate(xl, y, z);
      winGeos.push(w);
    }
  }
  const windows = new THREE.Mesh(merge(winGeos), new THREE.MeshStandardMaterial({ color: 0x0e151c, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.6 }));
  group.add(windows);

  // exposed structure at the torn end: bent frame rings, stringers and hanging cables
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8f969c, roughness: 0.45, metalness: 0.7 });
  const insul = new THREE.MeshStandardMaterial({ color: 0xc9b46a, roughness: 1 });
  [[-9.0, 0.3, 1.5], [-8.3, 1.4, 1.75], [-7.6, 2.6, 1.9]].forEach(([x, start, arc]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.95, 0.045, 5, 40, Math.PI * arc), frameMat);
    ring.rotation.set(0, Math.PI / 2, start);
    ring.position.x = x;
    group.add(ring);
  });
  for (let i = 0; i < 7; i++) {
    const th = 0.6 + i * 0.32;
    const st = new THREE.Mesh(new THREE.BoxGeometry(2.4 - (i % 3) * 0.5, 0.05, 0.03), frameMat);
    st.position.set(-8.9 + (i % 3) * 0.25, Math.sin(th) * R * 0.94, Math.cos(th) * R * 0.94);
    st.rotation.x = -th;
    group.add(st);
  }
  const insGeo = new THREE.PlaneGeometry(0.9, 0.6, 4, 3);
  const ip = insGeo.attributes.position;
  for (let i = 0; i < ip.count; i++) ip.setZ(i, Math.sin(ip.getX(i) * 7) * 0.05 + Math.sin(ip.getY(i) * 9) * 0.04);
  insGeo.computeVertexNormals();
  [[-8.7, 1.3, 1.25], [-8.0, 1.9, -0.6]].forEach(([x, y, z]) => {
    const pad = new THREE.Mesh(insGeo, insul);
    pad.position.set(x, y, z);
    pad.lookAt(x, 0, 0);
    pad.material.side = THREE.DoubleSide;
    group.add(pad);
  });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.6 });
  [[0.2, 0x1b1d20], [0.5, 0xb03a2e], [-0.3, 0x2e5fa0], [0.9, 0x1b1d20]].forEach(([z, col], i) => {
    const top = new THREE.Vector3(-9.3 + i * 0.15, R * 0.85, z);
    const curve = new THREE.CatmullRomCurve3([top, new THREE.Vector3(top.x - 0.5, R * 0.1, z * 1.4), new THREE.Vector3(top.x - 0.9 - i * 0.2, -0.85, z * 1.8 + 0.3)]);
    const cab = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.022, 5), i ? new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }) : cableMat);
    group.add(cab);
  });

  // cabin floor + a few seats inside
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L - 1.5, 0.1, 3.6), new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.95 }));
  floor.position.set(-0.5, -1.0, 0);
  group.add(floor);
  for (let i = 0; i < 6; i++) {
    for (const zz of [-1.2, -0.65, 0.65, 1.2]) {
      const seat = makeSeat(0x2a4a7a);
      seat.position.set(5.5 - i * 1.6, -0.95, zz);
      seat.rotation.y = -Math.PI / 2;
      if (i === 0 && zz > 1) { seat.rotation.z = 0.6; }
      group.add(seat);
    }
  }
  shadowAll(group);
  inner.castShadow = false;
  return { group, outer };
}



// Fuselage livery painted in cylinder UV space: u = angle around the body (0 = +z side, 0.25 = top),
// v = along the body (canvas top = the torn front end, -L/2).
function liveryTexture(R, L) {
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const X = (th) => ((th / (Math.PI * 2)) % 1 + 1) % 1 * W;
  const Y = (x) => ((x + L / 2) / L) * H;
  c.fillStyle = '#efefec'; c.fillRect(0, 0, W, H);
  // sides: [window angle, direction of "up" in u]
  const sides = [[Math.asin(0.3), 1], [Math.PI - Math.asin(0.3), -1]];
  // a band of angles; drawn at -W/0/+W so bands that cross the u = 0 seam wrap correctly
  const bandU = (th0, th1, color) => {
    const a = (Math.min(th0, th1) / (Math.PI * 2)) * W, b = (Math.max(th0, th1) / (Math.PI * 2)) * W;
    c.fillStyle = color;
    for (const ox of [-W, 0, W]) c.fillRect(a + ox, 0, b - a, H);
  };
  for (const [tw, up] of sides) {
    // cheatline below the windows, red pinstripe under it
    bandU(tw - up * 0.26, tw - up * 0.12, '#1d4373');
    bandU(tw - up * 0.33, tw - up * 0.29, '#b8352c');
    // window frames
    for (let i = 0; i < 22; i++) {
      const xl = -8.6 + i * 0.75;
      if (xl > 7.2) continue;
      const cx = X(tw), cy = Y(xl), rw = (0.21 / (Math.PI * 2 * R)) * W, rh = (0.17 / L) * H;
      c.fillStyle = '#c4c8cc';
      c.beginPath(); c.ellipse(cx, cy, rw, rh, 0, 0, 7); c.fill();
    }
    // titles above the windows
    c.save();
    c.translate(X(tw + up * 0.42), Y(up > 0 ? -5.5 : 4.2));
    c.rotate(up > 0 ? Math.PI / 2 : -Math.PI / 2);
    c.fillStyle = '#1d4373';
    c.font = `bold ${Math.round((0.55 / (Math.PI * 2 * R)) * W)}px Arial`;
    c.textBaseline = 'middle';
    c.scale((H / L) / (W / (Math.PI * 2 * R)), 1); // compensate the different pixel density along the body
    c.fillText('MERIDIAN', 0, 0);
    c.restore();
    // flight number near the rear
    c.save();
    c.translate(X(tw + up * 0.2), Y(up > 0 ? 8.1 : -8.9));
    c.rotate(up > 0 ? Math.PI / 2 : -Math.PI / 2);
    c.scale((H / L) / (W / (Math.PI * 2 * R)), 1);
    c.fillStyle = '#3a3f46';
    c.font = `bold ${Math.round((0.18 / (Math.PI * 2 * R)) * W)}px Arial`;
    c.textBaseline = 'middle';
    c.fillText('NV-2207', 0, 0);
    c.restore();
  }
  // passenger door on the +z side behind the last window
  c.strokeStyle = 'rgba(70,74,80,0.85)'; c.lineWidth = 3;
  // the door spans the u = 0 seam, so draw it twice: once shifted left by the full width
  const dl = X(-0.5) - W, dw = X(0.55) - dl;
  for (const ox of [0, W]) c.strokeRect(dl + ox, Y(7.45), dw, Y(8.4) - Y(7.45));
  c.fillStyle = '#b8352c'; c.fillRect(X(0.1), Y(7.55), 10, 22);
  // grime: streaks running down the sides and a darker, scuffed belly
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * W, y = Math.random() * H, len = 10 + Math.random() * 60;
    c.fillStyle = `rgba(80,74,64,${0.03 + Math.random() * 0.05})`;
    c.fillRect(x, y, len, 1 + Math.random() * 2);
  }
  const g = c.createLinearGradient(X(Math.PI * 1.1), 0, X(Math.PI * 1.9), 0);
  g.addColorStop(0, 'rgba(70,64,56,0)'); g.addColorStop(0.5, 'rgba(70,64,56,0.35)'); g.addColorStop(1, 'rgba(70,64,56,0)');
  c.fillStyle = g; c.fillRect(X(Math.PI * 1.1), 0, X(Math.PI * 1.9) - X(Math.PI * 1.1), H);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function buildWing() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -2.4);
  shape.lineTo(13, 0.6);
  shape.lineTo(13, 2.1);
  shape.lineTo(0, 2.4);
  shape.lineTo(-0.4, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.38, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.1, bevelSegments: 2, steps: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(-6.5, 0, 0);
  const m = new THREE.Mesh(scaleUV(geo, 0.45, 0.45), skin({ color: 0xc9cdd2, roughness: 0.4, metalness: 0.3 }));
  const g = new THREE.Group();
  g.add(m);
  // flap hanging off
  const flap = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(3.4, 0.1, 0.9), 1.6, 0.5), skin({ color: 0xb4b9be, roughness: 0.45, metalness: 0.3 }));
  flap.position.set(-1, 0.1, 3.0);
  flap.rotation.set(0.5, 0.1, 0.05);
  g.add(flap);
  return shadowAll(g);
}

function logoTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#16365f';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(128, 110, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const x = 70 + i * 2.9, y = 112 + Math.sin(i / 40 * Math.PI * 2) * 18;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#f2f2f2';
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('MERIDIAN', 128, 216);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildTail() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(2.1, 0.55, 9, 36, 8, true), 4, 4.5), skin({ color: 0xeeeeea, side: THREE.DoubleSide }));
  body.geometry.rotateZ(Math.PI / 2);
  // jagged front edge
  const p = body.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getX(i) < -4.4) p.setX(i, p.getX(i) + fbm(p.getY(i) * 2, p.getZ(i) * 2, 2) * 1.6);
  }
  body.geometry.computeVertexNormals();
  g.add(body);
  const finShape = new THREE.Shape();
  finShape.moveTo(-3.2, 0);
  finShape.lineTo(2.6, 0);
  finShape.lineTo(4.4, 5.6);
  finShape.lineTo(2.2, 5.6);
  finShape.closePath();
  const fin = new THREE.Mesh(scaleUV(new THREE.ExtrudeGeometry(finShape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), 0.45, 0.45), skin({ color: 0x1d4373, roughness: 0.38 }));
  fin.position.set(0.8, 0.9, -0.15);
  g.add(fin);
  const logoMat = new THREE.MeshStandardMaterial({ map: logoTexture(), roughness: 0.5 });
  for (const s of [-1, 1]) {
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), logoMat);
    logo.position.set(2.0, 3.6, s * 0.17);
    if (s < 0) logo.rotation.y = Math.PI;
    g.add(logo);
  }
  const stab = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(2.6, 0.18, 7.5), 1.3, 3.7), skin({ color: 0xdcdde0 }));
  stab.position.set(2.6, 0.3, 0);
  g.add(stab);
  return shadowAll(g);
}

function buildEngine() {
  const g = new THREE.Group();
  const nacelle = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(1.15, 0.95, 3.2, 36, 1, true), 3.5, 1.6), skin({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.55, side: THREE.DoubleSide }));
  nacelle.rotation.z = Math.PI / 2;
  const fan = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.6, metalness: 0.5 }));
  fan.position.x = 1.2;
  fan.rotation.y = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0x2b2d30, metalness: 0.7, roughness: 0.3 }));
  hub.rotation.z = -Math.PI / 2;
  hub.position.x = 1.45;
  const scorch = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.7, 1.0, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1, side: THREE.DoubleSide }));
  scorch.rotation.z = Math.PI / 2;
  scorch.position.x = -2.0;
  g.add(nacelle, fan, hub, scorch);
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.16), fan.material);
    b.position.x = 1.18;
    b.rotation.x = (i / 9) * Math.PI * 2;
    b.geometry.translate(0, 0.45, 0);
    g.add(b);
  }
  return shadowAll(g);
}


function buildSmoke(scene, x, y, z, updaters) {
  const N = 70;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), life = new Float32Array(N);
  for (let i = 0; i < N; i++) life[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: softSprite(70, 70, 72), size: 3.4, transparent: true, opacity: 0.42, depthWrite: false, sizeAttenuation: true, color: 0x555555 });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  const fireMat = new THREE.SpriteMaterial({ map: softSprite(255, 140, 50), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const fires = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(fireMat);
    s.position.set(x + (Math.random() - 0.5) * 0.8, y + 0.2, z + (Math.random() - 0.5) * 0.8);
    scene.add(s);
    fires.push(s);
  }
  const light = new THREE.PointLight(0xff7a2a, 6, 9, 1.6);
  light.position.set(x, y + 0.8, z);
  scene.add(light);
  updaters.push((dt, t) => {
    for (let i = 0; i < N; i++) {
      life[i] += dt * 0.13;
      if (life[i] > 1) life[i] -= 1;
      const L = life[i];
      pos[i * 3] = x + Math.sin(i * 12.9 + t * 0.3) * (0.3 + L * 2.5) - L * 6;
      pos[i * 3 + 1] = y + 0.5 + L * 16;
      pos[i * 3 + 2] = z + Math.cos(i * 7.3 + t * 0.2) * (0.3 + L * 2.5) + L * 2;
    }
    geo.attributes.position.needsUpdate = true;
    fires.forEach((s, i) => {
      const k = 0.7 + Math.sin(t * 13 + i * 2) * 0.2 + Math.sin(t * 7.7 + i) * 0.15;
      s.scale.setScalar(0.9 * k + 0.4);
    });
    light.intensity = 5 + Math.sin(t * 17) * 1.2 + Math.sin(t * 6.1) * 1.4;
  });
}

function buildWreck(scene, colliders, occluders, updaters, rnd) {
  const L = LAYOUT;
  // fuselage
  const fus = buildFuselage();
  fus.group.position.set(L.fuselage.x, heightAt(L.fuselage.x, L.fuselage.z) + 1.35, L.fuselage.z);
  fus.group.rotation.set(0.17, L.fuselage.rot, 0.03, 'YXZ');
  scene.add(fus.group);
  occluders.push(fus.outer);
  colliders.push({ type: 'box', x: L.fuselage.x, z: L.fuselage.z, hw: 9.6, hd: 2.35, rot: L.fuselage.rot, tag: 'fuselage' });

  // wing
  const wing = buildWing();
  placeOnGround(wing, L.wing.x, L.wing.z, -0.15);
  wing.rotation.set(0.05, L.wing.rot, 0.1);
  scene.add(wing);
  occluders.push(wing.children[0]);
  colliders.push({ type: 'box', x: L.wing.x, z: L.wing.z, hw: 6.4, hd: 1.9, rot: L.wing.rot, tag: 'wing' });

  // engine + fire + smoke
  const eng = buildEngine();
  placeOnGround(eng, L.engine.x, L.engine.z, -0.75);
  eng.rotation.set(0, 0.8, 0.12);
  scene.add(eng);
  colliders.push({ type: 'circle', x: L.engine.x, z: L.engine.z, r: 1.75 });
  buildSmoke(scene, L.engine.x - 0.9, heightAt(L.engine.x, L.engine.z) + 0.4, L.engine.z + 0.6, updaters);

  // tail section at the jungle edge
  const tail = buildTail();
  placeOnGround(tail, L.tail.x, L.tail.z, -1.2);
  tail.rotation.set(0.32, L.tail.rot, -0.05, 'YXZ');
  scene.add(tail);
  occluders.push(tail.children[0]);
  colliders.push({ type: 'box', x: L.tail.x, z: L.tail.z, hw: 4.6, hd: 2.1, rot: L.tail.rot, tag: 'tail' });

  // cargo container near the tail ("cache")
  const cont = new THREE.Group();
  const cmat = skin({ color: 0xa8aeb4, roughness: 0.5, metalness: 0.45 });
  const box = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(2.4, 1.9, 1.9), 1.2, 1), cmat);
  box.position.y = 0.95;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 1.7), new THREE.MeshStandardMaterial({ color: 0x5d6a74, roughness: 0.6, metalness: 0.4 }));
  door.position.set(1.4, 0.85, 0.75);
  door.rotation.y = 1.0;
  const stencil = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.35), new THREE.MeshStandardMaterial({ map: stencilTexture('AKE 40217 MR'), transparent: true, roughness: 0.6 }));
  stencil.position.set(0, 1.45, 0.96);
  cont.add(box, door, stencil);
  placeOnGround(cont, L.container.x, L.container.z, 0.1);
  cont.rotation.y = L.container.rot;
  shadowAll(cont);
  scene.add(cont);
  occluders.push(box);
  colliders.push({ type: 'box', x: L.container.x, z: L.container.z, hw: 1.25, hd: 1.0, rot: L.container.rot });

  // scattered seats near the engine
  const seatSpots = [[16, 9, 0.4, 0], [17.2, 9.6, 0.4, 0], [15.2, 11.6, 2.1, 1.4], [21, 4.5, -0.9, 0], [6, 14.5, 3.0, 1.5], [-2, 9, 1.0, 0], [28, 6, 2.2, 0], [12, -5, 0.3, 1.3]];
  for (const [x, z, ry, tip] of seatSpots) {
    const s = makeSeat(rnd() > 0.5 ? 0x2a4a7a : 0x31527f);
    placeOnGround(s, x, z, 0.05);
    s.rotation.set(0, ry, tip);
    shadowAll(s);
    scene.add(s);
    colliders.push({ type: 'circle', x, z, r: 0.45 });
  }

  // bent panels & shards
  const panelMat = skin({ color: 0xe2e3e4, side: THREE.DoubleSide });
  const darkMat = skin({ color: 0x4a4d52, roughness: 0.6, metalness: 0.35, side: THREE.DoubleSide });
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, r = 4 + rnd() * 22;
    const x = 6 + Math.cos(a) * r * 1.3, z = 2 + Math.sin(a) * r * 0.8;
    if (inlandDist(x, z) < 2) continue;
    const w = 0.6 + rnd() * 2.2, h = 0.4 + rnd() * 1.4;
    const geo = new THREE.PlaneGeometry(w, h, 5, 3);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setZ(k, Math.sin(p.getX(k) * 1.7 + i) * 0.15 + (rnd() - 0.5) * 0.06);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, rnd() > 0.3 ? panelMat : darkMat);
    placeOnGround(m, x, z, -0.05);
    m.rotation.set(-Math.PI / 2 + (rnd() - 0.5) * 1.0, rnd() * 6, (rnd() - 0.5) * 0.6);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }

  // life vests
  const vestMat = new THREE.MeshStandardMaterial({ color: 0xf0731c, roughness: 0.8 });
  [[0, 22], [-20, 14], [26, 19]].forEach(([x, z]) => {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.7), vestMat);
    placeOnGround(v, x, z, -0.05);
    v.rotation.y = rnd() * 6;
    v.castShadow = true;
    scene.add(v);
  });

  // ordinary suitcases (examinable)
  const suitcases = [];
  const suitcaseSpots = [[-1, 4, 0x7a2a2a], [9, 15, 0x2d5d44], [22, -2, 0x6b6b70], [-7, -3, 0x8a6a3a], [14, 18, 0x3a4c8a], [-19, 9, 0x5a3d5c], [26, 9.5, 0x996633]];
  for (const [x, z, col] of suitcaseSpots) {
    const s = makeSuitcaseMesh(col, 1);
    placeOnGround(s, x, z, 0.03);
    s.rotation.set((rnd() - 0.5) * 0.2, rnd() * 6, (rnd() - 0.5) * 0.25);
    scene.add(s);
    suitcases.push({ x, z, obj: s });
  }

  // the dark rock crevice with the black suitcase
  // (rocks themselves are added in buildRocks; the black suitcase is created by items.js)
  return { fuselage: fus.group, tail, suitcases };
}


// =====================================================================
// Rocks
// =====================================================================
function buildRocks(scene, colliders, occluders, rnd) {
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
  const mat = triplanar(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), rockTex(), 0.35, { normalStrength: 1.2 });
  const placements = [];
  const add = (x, z, s, sink = 0.35, collide = true) => placements.push({ x, z, s, sink, collide });

  // the crevice: two big boulders and a slab
  const C = LAYOUT.crevice;
  add(C.x - 2.3, C.z + 1.6, 2.5, 0.5);
  add(C.x + 2.0, C.z - 2.4, 2.3, 0.5);
  add(C.x - 1.6, C.z - 2.8, 2.0, 0.4);
  add(C.x - 4.5, C.z - 0.5, 1.8, 0.4);
  // shoreline rocks
  for (let i = 0; i < 46; i++) {
    const x = -85 + rnd() * 170;
    const z = shoreZ(x) - 2 + (rnd() - 0.4) * 10;
    if (Math.abs(x - LAYOUT.spawn.x) < 6 && Math.abs(z - LAYOUT.spawn.z) < 6) continue;
    if (distToPaths(x, z) < 2.5) continue;
    add(x, z, 0.4 + rnd() * rnd() * 2.4, 0.3, true);
  }
  // headland boulders & jungle stones
  for (let i = 0; i < 70; i++) {
    const side = rnd() > 0.5 ? 1 : -1;
    const x = side * (60 + rnd() * 35), z = -95 + rnd() * 135;
    add(x, z, 1 + rnd() * 3, 0.6);
  }
  for (let i = 0; i < 40; i++) {
    const x = -80 + rnd() * 160, z = -95 + rnd() * 80;
    if (distToPaths(x, z) < 3 || Math.hypot(x - LAYOUT.tail.x, z - LAYOUT.tail.z) < 9) continue;
    add(x, z, 0.4 + rnd() * 1.4, 0.3);
  }

  const buckets = [[], [], []];
  placements.forEach((p, i) => buckets[i % 3].push(p));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  buckets.forEach((list, vi) => {
    const im = new THREE.InstancedMesh(variants[vi], mat, list.length);
    list.forEach((p, i) => {
      e.set(rnd() * 0.4, rnd() * 6.28, rnd() * 0.4);
      q.setFromEuler(e);
      sc.set(p.s * (0.9 + rnd() * 0.3), p.s * (0.8 + rnd() * 0.4), p.s * (0.9 + rnd() * 0.3));
      v.set(p.x, heightAt(p.x, p.z) - p.sink * p.s * 0.5, p.z);
      m4.compose(v, q, sc);
      im.setMatrixAt(i, m4);
      const g = 0.8 + rnd() * 0.3;
      col.setRGB(g, g * 0.96, g * 0.9);
      im.setColorAt(i, col);
      if (p.collide && p.s > 0.55) colliders.push({ type: 'circle', x: p.x, z: p.z, r: p.s * 0.92 });
    });
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(im);
    occluders.push(im);
  });
}

// =====================================================================
// Vegetation (instanced, with wind sway in the vertex shader)
// =====================================================================






function buildVegetation(scene, colliders, shared, rnd) {
  const L = LAYOUT;
  const keepOut = [
    [L.fuselage.x, L.fuselage.z, 13], [L.wing.x, L.wing.z, 8], [L.engine.x, L.engine.z, 5], [L.tail.x, L.tail.z, 8],
    [L.container.x, L.container.z, 4], [L.crevice.x, L.crevice.z, 6], [L.spawn.x, L.spawn.z, 5], [L.seatsCluster.x, L.seatsCluster.z, 5],
    ...Object.values(ITEM_SPOTS).map((p) => [p.x, p.z, 2.2]),
    [L.base.x, L.base.z + 1, 6.5],
    ...RESOURCE_NODES.filter((n) => n.zone === 'beach').map((n) => [n.x, n.z, 1.8]),
  ];
  const free = (x, z, pathMargin) => {
    if (distToPaths(x, z) < pathMargin) return false;
    for (const [kx, kz, kr] of keepOut) if ((x - kx) ** 2 + (z - kz) ** 2 < kr * kr) return false;
    return true;
  };
  const inPlay = (x, z) => x > BOUNDS.minX - 5 && x < BOUNDS.maxX + 5 && z > BOUNDS.minZ - 5;

  const { trunkMat, palmTrunkMat, palmLeafMat, canopyMat, smallMat } = vegetationMaterials(shared);

  // --- sample positions
  const palms = [], trees = [[], [], []], bushes = [], ferns = [], grass = [];
  for (let i = 0; i < 9000; i++) {
    const x = -130 + rnd() * 260, z = -160 + rnd() * 200;
    const d = inlandDist(x, z);
    if (d < 4) continue;
    const h = heightAt(x, z);
    const r = rnd();
    if (d > 7 && d < 48 && r < 0.05 && free(x, z, 2.6)) palms.push([x, z]);
    else if (d > 34 && r < 0.05 + smoothstep(40, 90, d) * 0.1 && free(x, z, 3.2)) trees[i % 3].push([x, z]);
    else if (d > 16 && r < 0.2 && r > 0.17 && free(x, z, 1.8)) bushes.push([x, z]);
    else if (d > 22 && r > 0.2 && r < 0.25 && free(x, z, 1.4)) ferns.push([x, z]);
    else if (d > 12 && r > 0.25 && r < 0.32 && free(x, z, 1.2) && h < 8) grass.push([x, z]);
  }
  // a few palms that frame the wake-up spot
  palms.push([-11, 16], [-1.5, 23.5], [-16, 21], [-36, 13], [-42, 6]);

  // Instances are split into spatial chunks so the main and shadow passes can
  // frustum-cull whole blocks of jungle instead of drawing every tree each frame.
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const CHUNK = 40;
  function place(list, opts) {
    return list.map(([x, z]) => {
      const s = opts.scale[0] + rnd() * (opts.scale[1] - opts.scale[0]);
      e.set((rnd() - 0.5) * (opts.tilt || 0), rnd() * Math.PI * 2, (rnd() - 0.5) * (opts.tilt || 0));
      q.setFromEuler(e);
      sc.setScalar(s);
      v.set(x, heightAt(x, z) - (opts.sink || 0), z);
      const m = new THREE.Matrix4().compose(v, q, sc);
      const k = 0.85 + rnd() * 0.3;
      const c = new THREE.Color(k, k, k * (0.9 + rnd() * 0.15));
      if (opts.collide && inPlay(x, z)) colliders.push({ type: 'circle', x, z, r: opts.collide * s });
      return { m, c, key: `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}` };
    });
  }
  function addInstanced(geo, mat, placed, shadow, cullDist = 0) {
    const groups = new Map();
    for (const p of placed) { if (!groups.has(p.key)) groups.set(p.key, []); groups.get(p.key).push(p); }
    for (const list of groups.values()) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => { im.setMatrixAt(i, p.m); im.setColorAt(i, p.c); });
      im.computeBoundingSphere();
      im.castShadow = shadow;
      im.receiveShadow = true;
      im.userData.cullDist = cullDist; // small plants are not drawn far away (gfx/perf.js)
      scene.add(im);
    }
  }

  const palm = palmGeometries();
  const palmSet = place(palms, { scale: [0.85, 1.25], collide: 0.33, sink: 0.1 });
  addInstanced(palm.trunk, palmTrunkMat, palmSet, true);
  addInstanced(palm.leaves, palmLeafMat, palmSet, true);

  trees.forEach((list, i) => {
    const tg = jungleTreeGeometries(100 + i * 17);
    const set = place(list, { scale: [0.8, 1.35], collide: 0.5, sink: 0.2 });
    addInstanced(tg.trunk, trunkMat, set, true);
    addInstanced(tg.leaves, canopyMat, set, true);
  });
  addInstanced(bushGeometry(5), canopyMat, place(bushes, { scale: [0.7, 1.5], sink: 0.1 }), true);
  addInstanced(fernGeometry(), smallMat, place(ferns, { scale: [0.7, 1.4] }), false, 70);
  addInstanced(grassGeometry(), smallMat, place(grass, { scale: [0.8, 1.5] }), false, 55);

  // beach plants (low, spiky) on the sand
  const beachPlants = [];
  for (let i = 0; i < 160; i++) {
    const x = -80 + rnd() * 160, z = -20 + rnd() * 50;
    const d = inlandDist(x, z);
    if (d > 6 && d < 26 && free(x, z, 1.6)) beachPlants.push([x, z]);
  }
  addInstanced(fernGeometry(), smallMat, place(beachPlants, { scale: [0.4, 0.75] }), false);
}

// =====================================================================
// Signal mast deep in the jungle (lit only after the revelation)
// =====================================================================
function buildSignalMast(scene) {
  const { x, z } = LAYOUT.signal;
  const base = heightAt(x, z);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.7, metalness: 0.5 });
  const H = 42;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, H, 6), mat);
    leg.position.set(Math.cos(a) * 0.8, H / 2, Math.sin(a) * 0.8);
    g.add(leg);
  }
  for (let y = 3; y < H; y += 3.5) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 4, 3), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }
  g.position.set(x, base, z);
  scene.add(g);

  const glowMat = new THREE.SpriteMaterial({ map: softSprite(255, 40, 30), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(9);
  glow.position.set(x, base + H + 0.5, z);
  scene.add(glow);
  let active = false;
  return {
    position: new THREE.Vector3(x, base + H, z),
    setActive(v) { active = v; },
    update(dt, t) {
      if (!active) { glowMat.opacity = 0; return; }
      const blink = (t % 2.2) < 0.35 ? 1 : 0.08;
      glowMat.opacity += (blink - glowMat.opacity) * Math.min(1, dt * 14);
    },
  };
}
