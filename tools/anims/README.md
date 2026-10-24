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

## The flashlight clips

`torch_start_walking`, `stop_walking`, `idle_to_running`, `turn_right_90` and `jump` hold the flashlight
in both hands. They were converted from the FBX files with the same converter
(`Start_Walking_1.fbx` → `Torch_Start_Walking`, `Turning_Right_90_Degrees.fbx` → `Turn_Right_90`, the others
under their own names). `src/player.js` mirrors `Turn_Right_90` into `Turn_Left_90` at load, and samples
`Stop_Walking` / `Idle_To_Running` for the hold pose that the upper body takes over the plain idle, walk and
run clips whenever the survivor has the flashlight.

## Falling

`falling` (the first 3.3 s of Mixamo's Falling, the airborne loop: `convert.mjs Falling.fbx Falling 3.3`)
plays while the survivor drops more than 1 m off a cliff; `fall_land` (Fall A Land To Standing Idle 02)
plays on landing after a fall of more than 2 m.
