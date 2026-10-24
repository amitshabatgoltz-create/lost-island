# Adding a character skin

Every skin is a rigged [Mixamo](https://www.mixamo.com) character. The game's animation clips live in
`public/models/survivor.glb` and are shared by all skins, so a new character needs only its mesh,
skeleton and textures (download it from Mixamo as **FBX, T-pose, no animation**).

1. Put the FBX in `tools/skins/fbx/` (ignored by git; the files are 50–90 MB).
2. Run the dev server on port 5199: `npm run dev -- --port 5199`.
3. Convert: `node tools/skins/convert.cjs Ch01` → `public/models/skins/ch01.glb` (about 1 MB).
   The converter renames the bones to survivor.glb's (`mixamorig10…`), swaps the FBX materials for
   standard ones and compresses geometry and textures. `tools/skins/tmp/` gets a T-pose preview.
4. Add an entry to `SKINS` in `src/data/skins.js` (`height` in metres if the file is not in
   centimetres, `hide` for meshes that look wrong), and a 192×240 WebP portrait in
   `public/models/skins/portraits/<id>.webp`.

At load time `Player.prepareSkin` scales the hips travel of every clip to the new skeleton, so
walking, climbing and sitting keep their feet on the ground for taller or shorter characters.
