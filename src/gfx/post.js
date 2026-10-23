// Post-processing for the high quality setting: multisampled HDR render -> soft bloom -> tone mapping
// (OutputPass, uses the renderer's tone mapping/exposure) -> colour grade + vignette.
// On the low setting the scene renders straight to the canvas with the renderer's own MSAA.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSat: { value: 1.08 },
    uContrast: { value: 1.06 },
    uVignette: { value: 0.32 },
    uTint: { value: new THREE.Vector3(1.0, 0.99, 0.97) },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSat, uContrast, uVignette; uniform vec3 uTint;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb = (c.rgb - 0.5) * uContrast + 0.5;
      c.rgb *= uTint;
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
    }`,
};

export function createPost(renderer) {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(null, null);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.55, 0.88);
  const output = new OutputPass();
  const grade = new ShaderPass(GradeShader);
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(output);
  composer.addPass(grade);

  const post = {
    enabled: true,
    composer, bloom, grade,
    render(scene, camera) {
      if (!post.enabled) { renderer.render(scene, camera); return; }
      renderPass.scene = scene;
      renderPass.camera = camera;
      composer.render();
    },
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
    // day: gentle bloom only on the brightest highlights; night: lights and the red signal glow more
    setMood(mode) {
      const night = mode === 'night';
      bloom.strength = night ? 0.55 : 0.28;
      bloom.threshold = night ? 0.55 : 0.9;
      grade.uniforms.uSat.value = night ? 1.0 : 1.1;
      grade.uniforms.uVignette.value = night ? 0.34 : 0.3;
      grade.uniforms.uTint.value.set(...(night ? [0.96, 0.99, 1.04] : [1.0, 0.99, 0.965]));
    },
  };
  post.setSize(size.x, size.y);
  return post;
}
