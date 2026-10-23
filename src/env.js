// Shared environment that lives for the whole session: scene, sky, sun/moon, fog and time of day.
// Zones add their own content group to env.scene and are disposed independently.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// late-morning sun from the south-west: high enough to model shapes, low enough for long soft shadows
export const SUN_DIR = new THREE.Vector3(-0.55, 0.52, 0.65).normalize();
const MOON_DIR = new THREE.Vector3(0.45, 0.62, 0.64).normalize();

const PRESETS = {
  day: {
    fog: 0xa3bbcf, fogDensity: 0.004, sky: true, hemiSky: 0xa9c6e8, hemiGround: 0x5e4f38, hemi: 0.5,
    light: 0xffe1bb, lightI: 3.0, dir: SUN_DIR, envI: 0.45, exposure: 0.88, moon: false,
  },
  night: {
    fog: 0x15202e, fogDensity: 0.012, sky: false, hemiSky: 0x5a74a8, hemiGround: 0x1c1c22, hemi: 0.6,
    light: 0x9fb8ec, lightI: 1.15, dir: MOON_DIR, envI: 0.1, exposure: 1.12, moon: true,
  },
};

// Height fog: exponential fog that is thicker near the ground and thins out with altitude, so distant
// hills and the sky keep their contrast while the low jungle and the sea horizon get atmospheric depth.
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth;
  varying float vFogY;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogY = (transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz)).y;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying float vFogY;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogH = max(0.5 * (vFogY + cameraPosition.y), 0.0);
    float fogD = fogDensity * (0.35 + 0.65 * exp(-fogH * 0.06));
    float fogFactor = 1.0 - exp(- fogD * fogD * vFogDepth * vFogDepth);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif`;

export function createEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PRESETS.day.fog, PRESETS.day.fogDensity);
  scene.background = new THREE.Color(PRESETS.day.fog);

  const sky = new Sky();
  sky.scale.setScalar(3000);
  const su = sky.material.uniforms;
  su.turbidity.value = 3.2;
  su.rayleigh.value = 2.0;
  su.mieCoefficient.value = 0.004;
  su.mieDirectionalG.value = 0.82;
  su.sunPosition.value.copy(SUN_DIR).multiplyScalar(1000);
  sky.userData.shared = true;
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene();
  const sky2 = new Sky();
  sky2.scale.setScalar(1000);
  sky2.material.uniforms.sunPosition.value.copy(su.sunPosition.value);
  ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'].forEach((k) => (sky2.material.uniforms[k].value = su[k].value));
  skyScene.add(sky2);
  const envTex = pmrem.fromScene(skyScene, 0, 0.1, 2000).texture;
  sky2.geometry.dispose();
  sky2.material.dispose();
  pmrem.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const hemi = new THREE.HemisphereLight(PRESETS.day.hemiSky, PRESETS.day.hemiGround, PRESETS.day.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PRESETS.day.light, PRESETS.day.lightI);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 260;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  // moon + stars follow the camera so they never hit the far plane
  const nightSky = new THREE.Group();
  nightSky.visible = false;
  const moonTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, 'rgba(235,240,255,1)');
    g.addColorStop(0.32, 'rgba(225,232,250,1)');
    g.addColorStop(0.38, 'rgba(160,185,235,0.35)');
    g.addColorStop(1, 'rgba(120,150,220,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = 'rgba(150,160,185,0.35)';
    [[54, 56, 7], [72, 70, 5], [66, 50, 4]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); });
    return new THREE.CanvasTexture(cv);
  })();
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true }));
  moon.scale.setScalar(16);
  nightSky.add(moon);
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 700; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
    const y = Math.abs(u) * 0.9 + 0.08, r = Math.sqrt(1 - y * y);
    sp.push(Math.cos(a) * r * 120, y * 120, Math.sin(a) * r * 120);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.55, fog: false, transparent: true, opacity: 0.8, depthWrite: false }));
  nightSky.add(stars);
  scene.add(nightSky);

  let preset = PRESETS.day;
  const UP = new THREE.Vector3(0, 1, 0), lsRight = new THREE.Vector3(), lsUp = new THREE.Vector3(), snapped = new THREE.Vector3(), center = new THREE.Vector3(), camDir = new THREE.Vector3();
  const shared = { time: { value: 0 } };

  return {
    scene, sky, sun, hemi, shared,
    get mode() { return preset === PRESETS.night ? 'night' : 'day'; },
    // zone can override fog density (dense in the forest)
    setTime(mode, { fogDensity } = {}) {
      preset = PRESETS[mode] || PRESETS.day;
      scene.fog.color.setHex(preset.fog);
      scene.fog.density = fogDensity ?? preset.fogDensity;
      scene.background = new THREE.Color(preset.fog);
      sky.visible = preset.sky;
      nightSky.visible = preset.moon;
      hemi.color.setHex(preset.hemiSky);
      hemi.groundColor.setHex(preset.hemiGround);
      hemi.intensity = preset.hemi;
      sun.color.setHex(preset.light);
      sun.intensity = preset.lightI;
      scene.environmentIntensity = preset.envI;
      renderer.toneMappingExposure = preset.exposure;
    },
    setShadows(on) { sun.castShadow = on; },
    // 4096 shadow map on the high setting: crisp contact shadows across the whole 96 m shadow area
    setShadowQuality(high) {
      const n = high ? 4096 : 2048;
      if (sun.shadow.mapSize.x === n) return;
      sun.shadow.mapSize.set(n, n);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    },
    update(dt, t, focus, camera) {
      shared.time.value = t;
      const d = preset.dir;
      // snap the shadow camera to whole shadow texels so shadow edges do not shimmer while walking
      const texel = (sc.right - sc.left) / sun.shadow.mapSize.x;
      // centre the shadow area ahead of the camera, where most of the visible ground is
      center.copy(focus);
      if (camera) {
        camera.getWorldDirection(camDir);
        camDir.y = 0;
        if (camDir.lengthSq() > 1e-4) center.addScaledVector(camDir.normalize(), 16);
      }
      focus = center;
      lsRight.crossVectors(UP, d).normalize();
      lsUp.crossVectors(d, lsRight);
      const u = focus.dot(lsRight), v = focus.dot(lsUp);
      snapped.copy(focus).addScaledVector(lsRight, Math.round(u / texel) * texel - u).addScaledVector(lsUp, Math.round(v / texel) * texel - v);
      sun.position.copy(snapped).addScaledVector(d, 120);
      sun.target.position.copy(snapped);
      if (nightSky.visible && camera) {
        nightSky.position.copy(camera.position);
        moon.position.copy(MOON_DIR).multiplyScalar(110);
      }
    },
  };
}
