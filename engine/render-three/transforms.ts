import { Euler, Matrix4, Object3D, Quaternion, Vector3 } from "three";

import type { LayoutCharacter, LayoutPlacement, Vec3 } from "@engine/scene/layout";
import { degreesToRadians, readRotation, readScale } from "@engine/scene/transform";

export function composePlacementMatrix(
  placement: LayoutPlacement | LayoutCharacter,
): Matrix4 {
  const position = new Vector3(...placement.position);
  const rotation = new Quaternion().setFromEuler(eulerDegrees(readRotation(placement)));
  const scale = new Vector3(...readScale(placement));
  return new Matrix4().compose(position, rotation, scale);
}

/** Builds an XYZ-order Euler from a degrees vector. */
export function eulerDegrees(rotation: Vec3): Euler {
  return new Euler(
    degreesToRadians(rotation[0]),
    degreesToRadians(rotation[1]),
    degreesToRadians(rotation[2]),
    "XYZ",
  );
}

/** Applies a degrees rotation vector to an Object3D's Euler (XYZ order). */
export function applyEulerDegrees(object: Object3D, rotation: Vec3): void {
  object.rotation.copy(eulerDegrees(rotation));
}
