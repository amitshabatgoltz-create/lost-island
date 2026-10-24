// The flashlight model (public/models/flashlight.glb, made by tools/flashlight/compress.mjs): 0.22 m long,
// centred, lens along +Z. Loaded once; the hand-held and the beach pickup each get their own clone.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

let promise;
export function loadTorch() {
  if (!promise) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    promise = loader.loadAsync('./models/flashlight.glb').then((g) => g.scene);
    promise.catch((err) => console.warn(err));
  }
  return promise.then((scene) => {
    const c = scene.clone();
    c.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
    return c;
  });
}
