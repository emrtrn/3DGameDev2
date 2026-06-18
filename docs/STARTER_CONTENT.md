# Forge Starter Content

This pack lives under `public/assets/starter-content` and is registered in
`public/assets/manifest.json`. It is meant for fast prototyping in the default
project, similar in purpose to Unreal Starter Content, but project-local and
replaceable.

## Created In Repo

- `StaticMeshes/Shapes`
  - `SM_Starter_Cube.glb`
  - `SM_Starter_Sphere.glb`
  - `SM_Starter_Cylinder.glb`
  - `SM_Starter_Cone.glb`
  - `SM_Starter_Plane.glb`
- `StaticMeshes/Prototype`
  - `SM_Prototype_Ramp.glb`
  - `SM_Prototype_Wall.glb`
  - `SM_Prototype_Platform.glb`
  - `SM_Prototype_Pillar.glb`
- `StaticMeshes/Props`
  - `SM_Prototype_Crate.glb`
- `Textures`
  - `T_Prototype_Grid.png`
  - `T_Checker_Neutral.png`
  - `T_Concrete_Noise.png`
  - `T_Grass_Noise.png`
  - `T_Flat_Normal.png`
  - `T_Roughness_Mid.png`
- `Materials`
  - `M_Prototype_Grid.material.json`
  - `M_Concrete.material.json`
  - `M_Grass.material.json`
  - `M_Metal.material.json`
  - `M_Glass.material.json`
  - `M_Emissive.material.json`
- `Sounds`
  - `S_UI_Click.wav`
  - `S_UI_Confirm.wav`
  - `S_Footstep_Stone.wav`
  - `S_Impact_Light.wav`
  - `S_Door_Open.wav`
  - `S_Ambient_Room.wav`
- `Effects`
  - `FX_Smoke_Puff.effect.json`
  - `FX_Spark_Burst.effect.json`
  - `FX_Dust_Hit.effect.json`
  - `FX_Interaction_Glow.effect.json`
- `Levels`
  - `L_Starter_Showcase.level.json`
  - `L_Greybox_Prototype.level.json`

## Needs User Replacement

These generated files are functional placeholders. Replace them with authored or
properly licensed production-quality content when available:

- Real PBR texture sets:
  - concrete: baseColor, normal, roughness
  - grass: baseColor, normal, roughness
  - wood: baseColor, normal, roughness
  - metal: baseColor, normal, roughness, metallic
  - water/noise masks for shader experiments
- Real audio:
  - footstep sets for stone, wood, metal, grass
  - UI click, hover, confirm, error
  - object impact, pickup, door open/close
  - short indoor and outdoor ambience loops
- Better prototype meshes:
  - stairs module
  - doorway module
  - arch/window module
  - floor/wall corner modules
  - gameplay markers or pickup props
- VFX textures and authored effect presets:
  - smoke sprite
  - spark sprite
  - dust sprite
  - glow/ring sprite

## License Note

Do not copy Unreal Engine Starter Content directly into Forge unless the license
for the target use is confirmed. Use it as a reference for coverage and folder
shape, then use original or compatible licensed assets here.
