# The flashlight model

`public/models/flashlight.glb` (about 48 KB) is made from the original 10.9 MB Sketchfab flashlight.glb:

```
cd tools/flashlight
npm i @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 sharp meshoptimizer
node compress.mjs <flashlight.glb> ../../public/models/flashlight.glb
```

The script turns the model so the lens points along +Z, scales it to 0.22 m with its origin in the
middle, drops the unused UV sets and tangents, shrinks the 2048² PNG textures to small WebP
(512 base colour, 256 normal / metal-roughness, 128 emissive) and meshopt-compresses the mesh.
`src/gfx/torch.js` loads it once; the player holds it in the right hand (`updateFlashlight` in
`src/player.js`) and the beach pickup uses the same model.
