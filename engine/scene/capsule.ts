import type { Vec3 } from "./layout";

export const DEFAULT_CAPSULE_RADIUS = 0.3;
export const DEFAULT_CAPSULE_HALF_HEIGHT = 0.9;

export interface CapsuleDimensions {
  /** Radius of the cylinder and both hemispherical end caps. */
  radius: number;
  /** Half-height from the capsule center to the top/bottom of the hemispheres. */
  halfHeight: number;
  /** Half-length of the straight cylinder section, excluding the hemispheres. */
  cylinderHalfHeight: number;
  /** Full AABB size used by existing collider and preview paths. */
  size: Vec3;
  /** Feet-at-origin center offset used by Character-style capsules. */
  center: Vec3;
}

export function resolveCapsuleDimensions(
  radius = DEFAULT_CAPSULE_RADIUS,
  halfHeight = DEFAULT_CAPSULE_HALF_HEIGHT,
): CapsuleDimensions {
  const safeRadius = positiveOrDefault(radius, DEFAULT_CAPSULE_RADIUS);
  const safeHalfHeight = Math.max(positiveOrDefault(halfHeight, DEFAULT_CAPSULE_HALF_HEIGHT), safeRadius);
  return {
    radius: safeRadius,
    halfHeight: safeHalfHeight,
    cylinderHalfHeight: Math.max(0, safeHalfHeight - safeRadius),
    size: [safeRadius * 2, safeHalfHeight * 2, safeRadius * 2],
    center: [0, safeHalfHeight, 0],
  };
}

function positiveOrDefault(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
