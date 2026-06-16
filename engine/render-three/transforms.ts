import { Box3, Euler, Matrix4, Object3D, Quaternion, Vector3 } from "three";

import type { LayoutCharacter, LayoutPlacement, Vec3 } from "@engine/scene/layout";
import { degreesToRadians, readRotation, readScale } from "@engine/scene/transform";

/** Composes a TRS matrix from a position, an XYZ-degrees rotation, and a scale. */
export function composeTransformMatrix(position: Vec3, rotationDeg: Vec3, scale: Vec3): Matrix4 {
  return new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(eulerDegrees(rotationDeg)),
    new Vector3(...scale),
  );
}

export function composePlacementMatrix(
  placement: LayoutPlacement | LayoutCharacter,
): Matrix4 {
  return composeTransformMatrix(placement.position, readRotation(placement), readScale(placement));
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

/** A world-axis-aligned collider footprint: full `size` plus a `center` offset
 *  from the entity's transform position (both already incorporate the
 *  placement's rotation and scale). */
export interface ColliderBox {
  size: Vec3;
  center: Vec3;
}

/**
 * Derives the world-axis-aligned box that encloses a model's local bounds once
 * the placement's rotation and scale are applied, so a derived collider matches
 * the rendered mesh instead of a unit cube. `center` is returned relative to the
 * placement position (translation is excluded) so it stays valid as the entity
 * moves. Rotation is baked from the authored transform; the box does not track
 * runtime re-orientation.
 */
export function colliderBoxFromBounds(
  localBounds: Box3,
  placement: { position: Vec3; rotation?: Vec3; rotationYDeg?: number; scale?: number | Vec3 },
): ColliderBox {
  const world = localBounds
    .clone()
    .applyMatrix4(
      composeTransformMatrix(placement.position, readRotation(placement), readScale(placement)),
    );
  const size = world.getSize(new Vector3());
  const center = world.getCenter(new Vector3());
  return {
    size: [size.x, size.y, size.z],
    center: [
      center.x - placement.position[0],
      center.y - placement.position[1],
      center.z - placement.position[2],
    ],
  };
}
