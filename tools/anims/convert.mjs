// Converts a Mixamo animation FBX into an animation-only clip file (public/models/anims/<name>.glb).
// Usage (from the repo root): node tools/anims/convert.mjs <file.fbx> <Clip_Name> [end seconds]
// The clip is retargeted to survivor.glb's skeleton: bones renamed to `mixamorig10…`, only the bones the
// game's clips animate, hips travel scaled to survivor's leg length. Root motion is kept (the game reads it).
// Needs @gltf-transform/cli (npx downloads it) for resampling and meshopt compression.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'public/models/anims');
const TMP = path.join(ROOT, 'tools/anims/tmp');
const SURVIVOR_HIPS_Y = 96.055; // survivor.glb's hips height in its bind pose (cm)
const [src, name, endArg] = process.argv.slice(2);
if (!src || !name) { console.error('usage: node tools/anims/convert.mjs <file.fbx> <Clip_Name> [end seconds]'); process.exit(1); }
const end = endArg ? Number(endArg) : Infinity; // keep only the start of a long clip

// the bones survivor.glb's clips animate
const glb = fs.readFileSync(path.join(ROOT, 'public/models/survivor.glb'));
const sj = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
const animated = new Set(sj.animations[0].channels.map((c) => sj.nodes[c.target.node].name));

const buf = fs.readFileSync(src);
const fbx = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
const clip = fbx.animations[0];
if (end < clip.duration) { clip.tracks = clip.tracks.map((t) => t.trim(0, end)); clip.duration = end; }
const k = SURVIVOR_HIPS_Y / fbx.getObjectByName('mixamorigHips').position.y;

const tracks = [];
for (const t of clip.tracks) {
  const [bone, prop] = t.name.split('.');
  const node = bone.replace(/^mixamorig/, 'mixamorig10');
  if (!animated.has(node)) continue;
  if (prop === 'quaternion') tracks.push({ node, path: 'rotation', times: t.times, values: t.values, type: 'VEC4' });
  else if (prop === 'position' && node === 'mixamorig10Hips') tracks.push({ node, path: 'translation', times: t.times, values: t.values.map((v) => v * k), type: 'VEC3' });
}

// a minimal glTF: one node per animated bone, one sampler per track
const nodes = [...new Set(tracks.map((t) => t.node))];
const chunks = [], bufferViews = [], accessors = [];
let offset = 0;
const addAccessor = (arr, type) => {
  const data = Buffer.from(new Float32Array(arr).buffer);
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
  chunks.push(data);
  offset += data.length;
  const comps = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type];
  const acc = { bufferView: bufferViews.length - 1, componentType: 5126, count: arr.length / comps, type };
  if (type === 'SCALAR') { acc.min = [Math.min(...arr)]; acc.max = [Math.max(...arr)]; }
  accessors.push(acc);
  return accessors.length - 1;
};
const samplers = [], channels = [];
for (const t of tracks) {
  samplers.push({ input: addAccessor(t.times, 'SCALAR'), output: addAccessor(t.values, t.type), interpolation: 'LINEAR' });
  channels.push({ sampler: samplers.length - 1, target: { node: nodes.indexOf(t.node), path: t.path } });
}
const bin = Buffer.concat(chunks);
const json = {
  asset: { version: '2.0', generator: 'lost-island tools/anims' },
  scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }],
  nodes: nodes.map((n) => ({ name: n })),
  buffers: [{ byteLength: bin.length }], bufferViews, accessors,
  animations: [{ name, samplers, channels }],
};
let js = Buffer.from(JSON.stringify(json));
js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.write('glTF', 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
const chunk = (b, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(b.length, 0); h.write(type, 4); return Buffer.concat([h, b]); };
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const raw = path.join(TMP, `${name}.glb`);
fs.writeFileSync(raw, Buffer.concat([header, chunk(js, 'JSON'), chunk(bin, 'BIN\0')]));

// drop redundant keyframes, then meshopt-compress the keyframe data
const out = path.join(OUT, `${name.toLowerCase()}.glb`);
const cli = (...args) => execFileSync('npx', ['-y', '@gltf-transform/cli@4', ...args], { stdio: 'inherit' });
cli('resample', raw, out, '--tolerance', '0.0001');
cli('meshopt', out, out);
console.log(name, `${clip.duration.toFixed(2)} s`, `${tracks.length} tracks`, `${fs.statSync(out).size} bytes`);
