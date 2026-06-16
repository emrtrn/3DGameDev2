import type { Box3 } from "three";

import { round } from "@editor/core/numeric";
import type { Vec3 } from "@engine/scene/layout";

export const DEFAULT_FLOOR_Y = 0;
export const FLOOR_SNAP_EPSILON = 1e-3;

/** Returns the transform position that places `worldBox.min.y` on the floor plane. */
export function floorSnapPosition(
  worldBox: Box3,
  currentPosition: Vec3,
  floorY = DEFAULT_FLOOR_Y,
): Vec3 | null {
  if (worldBox.isEmpty()) return null;
  const deltaY = floorY - worldBox.min.y;
  if (Math.abs(deltaY) < FLOOR_SNAP_EPSILON) return null;
  return [currentPosition[0], round(currentPosition[1] + deltaY), currentPosition[2]];
}
