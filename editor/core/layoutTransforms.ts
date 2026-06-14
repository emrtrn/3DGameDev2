import type {
  LayoutCharacter,
  LayoutLightActor,
  LayoutPlacement,
  Vec3,
} from "@engine/scene/layout";

/**
 * Writes a rotation vector back to a placement. Y-only rotations stay in the
 * legacy `rotationYDeg` field for instances/characters; lights store all
 * non-zero rotation in `rotation`.
 */
export function writeRotation(
  target: LayoutPlacement | LayoutCharacter | LayoutLightActor,
  rotation: Vec3,
): void {
  const [x, y, z] = [round(rotation[0]), round(rotation[1]), round(rotation[2])];
  if ("assetId" in target) {
    target.rotationYDeg = y;
    if (x === 0 && z === 0) delete target.rotation;
    else target.rotation = [x, y, z];
  } else {
    if (x === 0 && y === 0 && z === 0) delete target.rotation;
    else target.rotation = [x, y, z];
  }
}

/** Writes a scale vector back to a placement (scalar when uniform, else array). */
export function writeScale(
  target: LayoutPlacement | LayoutCharacter | LayoutLightActor,
  scale: Vec3,
): void {
  if ("type" in target) return;
  const [x, y, z] = [round(scale[0]), round(scale[1]), round(scale[2])];
  target.scale = x === y && y === z ? x : [x, y, z];
}

function round(value: number): number {
  return Number(value.toFixed(2));
}
