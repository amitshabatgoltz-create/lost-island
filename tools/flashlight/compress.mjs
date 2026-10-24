// flashlight.glb -> game-ready (README.md): lens along +Z, 0.22 m long, origin at the middle, small WebP textures, meshopt
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, reorder, quantize, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
const meshNode = root.listNodes().find((n) => n.getMesh());
const mesh = meshNode.getMesh();
const prim = mesh.listPrimitives()[0];
const LEN = 0.22, Z0 = -1443.65, Z1 = -1.21;
const s = LEN / (Z1 - Z0), zc = (Z0 + Z1) / 2;
const xf = (a, f) => { const v = [0, 0, 0]; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); a.setElement(i, f(v)); } };
// rotate 180° about Y so the lens (local -Z end) points +Z
xf(prim.getAttribute('POSITION'), ([x, y, z]) => [-x * s, y * s, -(z - zc) * s]);
xf(prim.getAttribute('NORMAL'), ([x, y, z]) => [-x, y, -z]);
for (const sem of prim.listSemantics()) if (sem === 'TANGENT' || /TEXCOORD_[1-9]/.test(sem)) prim.setAttribute(sem, null);
// one root node holding the mesh
const scene = root.listScenes()[0];
for (const n of scene.listChildren()) scene.removeChild(n);
const node = doc.createNode('flashlight').setMesh(mesh);
scene.addChild(node);
const mat = prim.getMaterial();
mat.setAlphaMode('OPAQUE').setDoubleSided(false).setName('flashlight');
const sizes = new Map([[mat.getBaseColorTexture(), 512], [mat.getNormalTexture(), 256], [mat.getMetallicRoughnessTexture(), 256], [mat.getEmissiveTexture(), 128]]);
for (const [t, n] of sizes) {
  let img = sharp(Buffer.from(t.getImage())).resize(n, n).removeAlpha();
  if (t === mat.getEmissiveTexture()) img = img.grayscale(); // a white lens mask: the game picks the glow colour
  const buf = await img.webp({ quality: 82 }).toBuffer();
  t.setImage(new Uint8Array(buf)).setMimeType('image/webp');
}
await doc.transform(prune(), dedup(), weld(), reorder({ encoder: MeshoptEncoder }), quantize());
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
doc.createExtension((await import('@gltf-transform/extensions')).EXTTextureWebP).setRequired(true);
await io.write(process.argv[3], doc);
