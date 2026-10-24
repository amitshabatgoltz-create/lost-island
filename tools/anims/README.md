# Adding an animation clip

The game's clips live in `public/models/survivor.glb` and are shared by every skin. Newer clips are
separate animation-only files in `public/models/anims/`, listed in `ANIM_URLS` in `src/player.js`;
a clip there replaces survivor.glb's clip of the same name.

1. Download the animation from [Mixamo](https://www.mixamo.com) as **FBX, without skin**. Leave
   "In Place" off if the game should read the clip's root motion (Start_Walking does).
2. Put the FBX in `tools/anims/fbx/` (ignored by git).
3. Convert: `node tools/anims/convert.mjs tools/anims/fbx/Start_Walking.fbx Start_Walking`
   → `public/models/anims/start_walking.glb` (about 40 KB). The converter renames the bones to
   survivor.glb's (`mixamorig10…`), keeps only the bones the game animates, scales the hips travel to
   survivor's legs, drops redundant keyframes and meshopt-compresses the rest.
4. Add the file to `ANIM_URLS`.
