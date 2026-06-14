import type { Vec3 } from "./layout";

export function degreesToRadians(degrees: number | undefined): number {
  return ((degrees ?? 0) * Math.PI) / 180;
}

/** Resolves a placement's rotation to a full XYZ Euler vector (degrees). */
export function readRotation(
  source: { rotation?: Vec3; rotationYDeg?: number },
): Vec3 {
  if (source.rotation) {
    return [source.rotation[0], source.rotation[1], source.rotation[2]];
  }
  return [0, source.rotationYDeg ?? 0, 0];
}

/** Resolves a placement's scale (uniform scalar or per-axis) to an XYZ vector. */
export function readScale(source: { scale?: number | Vec3 }): Vec3 {
  const scale = source.scale;
  if (Array.isArray(scale)) return [scale[0], scale[1], scale[2]];
  const value = scale ?? 1;
  return [value, value, value];
}

/** Resolves a placement's local authoring pivot offset; absent means the origin. */
export function readPivot(source: { pivot?: Vec3 }): Vec3 {
  const pivot = source.pivot;
  return pivot ? [pivot[0], pivot[1], pivot[2]] : [0, 0, 0];
}
