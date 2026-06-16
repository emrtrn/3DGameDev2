/**
 * Pure, headless-testable player movement math. No Three.js or DOM: behaviors
 * (src/game/behaviors.ts) feed it the current input snapshot and it returns the
 * planar position delta and facing yaw, which the behavior writes into the
 * mutable transform.
 *
 * Axis convention (matches the engine's WASD bindings):
 *   forward -> -z, back -> +z, left -> -x, right -> +x.
 * Yaw is in XYZ-order Euler degrees for `transform.rotation[1]`, the same
 * convention `applyEulerDegrees` consumes when rendering.
 */

/** Which of the four planar movement actions are held this tick. */
export interface PlanarMoveInput {
  readonly forward: boolean;
  readonly back: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

/** Planar position delta on the XZ plane for one tick. */
export interface PlanarMoveStep {
  readonly dx: number;
  readonly dz: number;
}

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Resolves the held movement actions into an XZ delta for one tick. The raw
 * direction is normalized before scaling by `speed * dt`, so a diagonal moves at
 * the same speed as a straight line (no ~1.41x diagonal boost). Opposing keys
 * cancel; no input (or a non-positive speed/dt) yields a zero delta.
 */
export function planarMoveStep(
  input: PlanarMoveInput,
  speed: number,
  dt: number,
): PlanarMoveStep {
  const rx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const rz = (input.back ? 1 : 0) - (input.forward ? 1 : 0);
  const magnitude = Math.hypot(rx, rz);
  if (magnitude === 0) return { dx: 0, dz: 0 };
  const distance = speed * dt;
  if (!(distance > 0)) return { dx: 0, dz: 0 };
  const scale = distance / magnitude;
  return { dx: rx * scale, dz: rz * scale };
}

/**
 * Yaw (in degrees) that faces the movement direction `(dx, dz)`, or `null` when
 * there is no movement so the caller holds the current facing.
 *
 * The demo character mesh is authored facing local `+z` (not Three.js' default
 * `-z`). A Y rotation of theta sends local `+z` to world `(sin theta, 0, cos
 * theta)`, so aligning that with `(dx, dz)` gives `theta = atan2(dx, dz)`. atan2
 * is invariant to positive scaling, so the scaled delta works directly. Cardinal
 * checks: forward -> 180deg, back -> 0deg, right -> 90deg, left -> -90deg.
 */
export function facingYawFromMove(dx: number, dz: number): number | null {
  if (dx === 0 && dz === 0) return null;
  return Math.atan2(dx, dz) * RAD_TO_DEG;
}
