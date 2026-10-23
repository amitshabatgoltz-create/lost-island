// Shader-patched materials built on MeshStandardMaterial, so they keep three's lighting, shadows and fog:
// - terrainMaterial: four height-blended texture layers driven by a per-vertex splat attribute
// - triplanar: world-space texturing for rocks and cliffs (works with instancing)
// - foliageMaterial: alpha-tested leaf cards with wind sway and back-lit translucency
import * as THREE from 'three';
import { foliageAtlas, barkTex, palmBarkTex } from './textures.js';

// global quality switch read by the shaders (0 = cheap, 1 = full detail)
export const GFX = { detail: { value: 1 } };

// ------------------------------------------------------------------ terrain
// layers: [{ tex: {map, normalMap}, scale (tiles per metre), rough }] x4, channel order = splat.xyzw
export function terrainMaterial(layers, { normalStrength = 1 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0 });
  const uniforms = {
    tA0: { value: layers[0].tex.map }, tA1: { value: layers[1].tex.map }, tA2: { value: layers[2].tex.map }, tA3: { value: layers[3].tex.map },
    tN0: { value: layers[0].tex.normalMap }, tN1: { value: layers[1].tex.normalMap }, tN2: { value: layers[2].tex.normalMap }, tN3: { value: layers[3].tex.normalMap },
    uScale: { value: new THREE.Vector4(...layers.map((l) => l.scale)) },
    uRough: { value: new THREE.Vector4(...layers.map((l) => l.rough)) },
    uNStr: { value: normalStrength },
    uDetail: GFX.detail,
  };
  mat.userData.terrainUniforms = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 splat; attribute float wet;
        varying vec4 vSplat; varying float vWet; varying vec3 vTWPos; varying vec3 vTWNormal;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vSplat = splat; vWet = wet;
        vTWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTWNormal = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tA0, tA1, tA2, tA3, tN0, tN1, tN2, tN3;
        uniform vec4 uScale, uRough; uniform float uNStr, uDetail;
        varying vec4 vSplat; varying float vWet; varying vec3 vTWPos; varying vec3 vTWNormal;
        // two decorrelated samples blended by a slow world-space mask: hides texture repetition
        float tMask(vec2 p) { return clamp(0.5 + 0.5 * sin(p.x * 0.071 + sin(p.y * 0.053) * 2.3) * sin(p.y * 0.067 + 1.7), 0.0, 1.0); }
        vec2 tRot(vec2 p) { return mat2(0.8, -0.6, 0.6, 0.8) * p * 0.43 + vec2(0.31, 0.17); }
        vec4 tSampA(sampler2D t, vec2 p, float m) { vec4 a = texture2D(t, p); if (uDetail > 0.5) a = mix(a, texture2D(t, tRot(p)), m * 0.6); return a; }
        vec3 tSampN(sampler2D t, vec2 p, float m) { vec3 a = texture2D(t, p).xyz; if (uDetail > 0.5) a = mix(a, texture2D(t, tRot(p)).xyz, m * 0.6); return a * 2.0 - 1.0; }`)
      .replace('#include <map_fragment>', `
        vec2 tp = vTWPos.xz;
        float tm = tMask(tp);
        vec4 ta0 = tSampA(tA0, tp * uScale.x, tm), ta1 = tSampA(tA1, tp * uScale.y, tm);
        vec4 ta2 = tSampA(tA2, tp * uScale.z, tm), ta3 = tSampA(tA3, tp * uScale.w, tm);
        // height-based blending: the taller texture wins at the borders (sand between pebbles, grass over soil)
        vec4 tw = max(vSplat, 0.0);
        vec4 th = vec4(ta0.a, ta1.a, ta2.a, ta3.a) * 0.55 + tw;
        float tmax = max(max(th.x, th.y), max(th.z, th.w)) - 0.18;
        vec4 tb = max(th - tmax, 0.0) * step(0.002, tw);
        tb /= max(dot(tb, vec4(1.0)), 1e-4);
        vec3 tAlb = ta0.rgb * tb.x + ta1.rgb * tb.y + ta2.rgb * tb.z + ta3.rgb * tb.w;
        diffuseColor.rgb *= tAlb * mix(1.0, 0.6, vWet);`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = mix(dot(tb, uRough), 0.32, vWet * 0.85);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 tn = tSampN(tN0, tp * uScale.x, tm) * tb.x + tSampN(tN1, tp * uScale.y, tm) * tb.y
                  + tSampN(tN2, tp * uScale.z, tm) * tb.z + tSampN(tN3, tp * uScale.w, tm) * tb.w;
          tn.xy *= uNStr;
          vec3 N = normalize(vTWNormal);
          vec3 T = normalize(vec3(1.0, 0.0, 0.0) - N * N.x);
          vec3 B = cross(T, N);
          vec3 nW = normalize(T * tn.x + B * tn.y + N * max(tn.z, 0.2));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }`);
  };
  mat.customProgramCacheKey = () => 'terrain4';
  return mat;
}

// ------------------------------------------------------------------ triplanar (rocks, cliffs, instanced or not)
export function triplanar(mat, tex, scale = 0.5, { normalStrength = 1 } = {}) {
  const uniforms = { tTA: { value: tex.map }, tTN: { value: tex.normalMap }, uTS: { value: scale }, uTNS: { value: normalStrength } };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev && prev.call(mat, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTpPos; varying vec3 vTpN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        {
          vec4 tpw = vec4(transformed, 1.0);
          vec3 tpn = objectNormal;
          #ifdef USE_INSTANCING
            tpw = instanceMatrix * tpw;
            tpn = mat3(instanceMatrix) * tpn;
          #endif
          vTpPos = (modelMatrix * tpw).xyz;
          vTpN = normalize(mat3(modelMatrix) * tpn);
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tTA, tTN; uniform float uTS, uTNS;
        varying vec3 vTpPos; varying vec3 vTpN;`)
      .replace('#include <map_fragment>', `
        vec3 tpN = normalize(vTpN);
        vec3 tpB = pow(abs(tpN), vec3(4.0)); tpB /= dot(tpB, vec3(1.0));
        vec3 tpP = vTpPos * uTS;
        vec3 tpAlb = texture2D(tTA, tpP.zy).rgb * tpB.x + texture2D(tTA, tpP.xz).rgb * tpB.y + texture2D(tTA, tpP.xy).rgb * tpB.z;
        diffuseColor.rgb *= tpAlb;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 nX = texture2D(tTN, tpP.zy).xyz * 2.0 - 1.0, nY = texture2D(tTN, tpP.xz).xyz * 2.0 - 1.0, nZ = texture2D(tTN, tpP.xy).xyz * 2.0 - 1.0;
          nX.xy *= uTNS; nY.xy *= uTNS; nZ.xy *= uTNS;
          // whiteout blend (Golus)
          nX = vec3(nX.xy + tpN.zy, abs(nX.z) * tpN.x);
          nY = vec3(nY.xy + tpN.xz, abs(nY.z) * tpN.y);
          nZ = vec3(nZ.xy + tpN.xy, abs(nZ.z) * tpN.z);
          vec3 nW = normalize(nX.zyx * tpB.x + nY.xzy * tpB.y + nZ.xyz * tpB.z);
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }`);
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => prevKey() + '|tri';
  return mat;
}

// ------------------------------------------------------------------ foliage
// Leaf cards: alpha-tested atlas, wind sway (instanced), and light passing through the leaves when back-lit.
export function foliageMaterial(shared, strength = 0.04, { translucency = 0.35, roughness = 0.78 } = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness, metalness: 0, map: foliageAtlas(),
    alphaTest: 0.5, side: THREE.DoubleSide,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float hh = max(position.y - 0.4, 0.0);
        float sw = sin(uTime*1.25 + ip.x*0.31 + ip.z*0.17) + 0.4*sin(uTime*2.7 + ip.z*0.5);
        float flutter = sin(uTime*6.0 + position.x*3.1 + position.z*2.3 + ip.x) * 0.012;
        transformed.x += sw * ${strength.toFixed(3)} * hh + flutter * hh;
        transformed.z += cos(uTime*1.05 + ip.x*0.21) * ${(strength * 0.6).toFixed(3)} * hh;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
      {
        float back = pow(max(0.0, dot(-geometryViewDir, directionalLights[0].direction)), 2.0);
        reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[0].color * (${translucency.toFixed(2)} * (0.25 + back));
      }
      #endif`);
  };
  m.customProgramCacheKey = () => 'foliage' + strength + translucency;
  return m;
}

// ------------------------------------------------------------------ baked contact shading on a terrain grid
// Darkens terrain vertex colours around objects (tree bases, rocks, wreckage, canopy shade). Cheap and static.
export function bakeContactShade(mesh, spots) {
  const geo = mesh.geometry, pos = geo.attributes.position, col = geo.attributes.color;
  const p = geo.parameters, sx = p.widthSegments + 1, sz = p.heightSegments + 1;
  const x0 = pos.getX(0), z0 = pos.getZ(0);
  const dx = p.width / p.widthSegments, dz = p.height / p.heightSegments;
  const shade = new Float32Array(pos.count).fill(1);
  for (const s of spots) {
    const i0 = Math.max(0, Math.floor((s.x - s.r - x0) / dx)), i1 = Math.min(sx - 1, Math.ceil((s.x + s.r - x0) / dx));
    const j0 = Math.max(0, Math.floor((s.z - s.r - z0) / dz)), j1 = Math.min(sz - 1, Math.ceil((s.z + s.r - z0) / dz));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * sx + i;
      const d = Math.hypot(pos.getX(k) - s.x, pos.getZ(k) - s.z) / s.r;
      if (d >= 1) continue;
      const f = 1 - (1 - d * d) * (1 - d * d) * s.k;
      if (f < shade[k]) shade[k] = shade[k] * 0.35 + f * 0.65;
    }
  }
  for (let k = 0; k < pos.count; k++) {
    if (shade[k] === 1) continue;
    col.setXYZ(k, col.getX(k) * shade[k], col.getY(k) * shade[k], col.getZ(k) * shade[k]);
  }
  col.needsUpdate = true;
}

// remap a geometry's UVs into one cell of the foliage atlas
export function toAtlas(geo, cell, inset = 0.006) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, cell[0] + inset + uv.getX(i) * (0.5 - 2 * inset), cell[1] + inset + uv.getY(i) * (0.5 - 2 * inset));
  }
  return geo;
}
export function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}

// the shared set used by both zones
export function vegetationMaterials(shared) {
  const bark = barkTex(), palmBark = palmBarkTex();
  return {
    trunkMat: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92, map: bark.map, normalMap: bark.normalMap, normalScale: new THREE.Vector2(1.2, 1.2) }),
    palmTrunkMat: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, map: palmBark.map, normalMap: palmBark.normalMap }),
    palmLeafMat: foliageMaterial(shared, 0.045, { translucency: 0.45, roughness: 0.7 }),
    canopyMat: foliageMaterial(shared, 0.025, { translucency: 0.35 }),
    smallMat: foliageMaterial(shared, 0.08, { translucency: 0.3, roughness: 0.85 }),
  };
}

// contact-shade spots derived from a zone's colliders (trees, rocks, wreckage)
export function shadeSpotsFromColliders(colliders) {
  const spots = [];
  for (const c of colliders) {
    if (c.type === 'circle') {
      spots.push({ x: c.x, z: c.z, r: c.r * 2.4 + 0.5, k: 0.5 });
      if (c.r > 0.35 && c.r < 1.2) spots.push({ x: c.x, z: c.z, r: 4.2, k: 0.16 }); // canopy shade
    } else if (c.type === 'box') {
      const cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0);
      const n = Math.max(1, Math.round(c.hw / 1.2));
      for (let i = -n; i <= n; i++) {
        const lx = (i / n) * c.hw;
        spots.push({ x: c.x + lx * cs, z: c.z - lx * sn, r: c.hd * 1.6 + 0.8, k: 0.42 });
      }
    }
  }
  return spots;
}
