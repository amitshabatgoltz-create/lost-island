// Shared environment that lives for the whole session: scene, sky, sun/moon, fog and time of day.
// Zones add their own content group to env.scene and are disposed independently.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export const SUN_DIR = new THREE.Vector3(-0.38, 0.17, 0.91).normalize();
const MOON_DIR = new THREE.Vector3(0.45, 0.62, 0.64).normalize();

const PRESETS = {
  day: {
    fog: 0xa9b4b8, fogDensity: 0.0058, sky: true, hemiSky: 0xbfd4ee, hemiGround: 0x8a7457, hemi: 0.9,
    light: 0xffd2a1, lightI: 2.6, dir: SUN_DIR, envI: 0.55, exposure: 0.92, moon: false,
  },
  night: {
    fog: 0x182638, fogDensity: 0.012, sky: false, hemiSky: 0x7088b8, hemiGround: 0x2a2a30, hemi: 0.95,
    light: 0xa9c0f0, lightI: 1.25, dir: MOON_DIR, envI: 0.12, exposure: 1.3, moon: true,
  },
};

export function createEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xa9b4b8, 0.0058);
  scene.background = new THREE.Color(0xa9b4b8);

  const sky = new Sky();
  sky.scale.setScalar(3000);
  const su = sky.material.uniforms;
  su.turbidity.value = 7;
  su.rayleigh.value = 1.6;
  su.mieCoefficient.value = 0.006;
  su.mieDirectionalG.value = 0.86;
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

  const hemi = new THREE.HemisphereLight(0xbfd4ee, 0x8a7457, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd2a1, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
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
    update(dt, t, focus, camera) {
      shared.time.value = t;
      const d = preset.dir;
      sun.position.set(focus.x + d.x * 90, focus.y + d.y * 90, focus.z + d.z * 90);
      sun.target.position.set(focus.x, focus.y, focus.z);
      if (nightSky.visible && camera) {
        nightSky.position.copy(camera.position);
        moon.position.copy(MOON_DIR).multiplyScalar(110);
      }
    },
  };
}
