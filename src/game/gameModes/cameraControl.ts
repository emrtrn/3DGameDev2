/**
 * Pure, headless-testable camera-pawn movement math. No Three.js or DOM: the
 * default camera Game Mode projects the live camera's facing onto the XZ plane
 * and feeds it here to turn WASD into a world-space planar pan.
 *
 * Axis convention matches the engine's WASD bindings (forward -> the camera's
 * horizontal facing; right -> 90deg clockwise of it when viewed from above).
 */

/** Which of the four planar movement actions are held this tick. */
export interface CameraPanInput {
  readonly forward: boolean;
  readonly back: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

/** World-space XZ pan delta for one tick. */
export interface CameraPanStep {
  readonly dx: number;
  readonly dz: number;
}

/**
 * World-space XZ pan for one tick. `forwardX`/`forwardZ` are the camera's
 * forward direction projected onto the ground plane (need not be normalized);
 * a degenerate (zero-length) forward falls back to world -z. The raw input is
 * normalized before scaling by `speed * dt`, so diagonals are not faster than
 * straight lines. Opposing keys cancel; no input or non-positive speed/dt yields
 * a zero delta.
 */
export function cameraPlanarPan(
  forwardX: number,
  forwardZ: number,
  input: CameraPanInput,
  speed: number,
  dt: number,
): CameraPanStep {
  const forwardAmount = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const rightAmount = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const magnitude = Math.hypot(forwardAmount, rightAmount);
  if (magnitude === 0) return { dx: 0, dz: 0 };
  const distance = speed * dt;
  if (!(distance > 0)) return { dx: 0, dz: 0 };

  // Normalized horizontal forward; fall back to world -z when the camera looks
  // straight down (zero-length XZ projection).
  const length = Math.hypot(forwardX, forwardZ);
  const fx = length > 1e-6 ? forwardX / length : 0;
  const fz = length > 1e-6 ? forwardZ / length : -1;
  // Horizontal right = cross(forward, worldUp) projected to XZ = (-fz, fx).
  const rx = -fz;
  const rz = fx;

  const scale = distance / magnitude;
  return {
    dx: (fx * forwardAmount + rx * rightAmount) * scale,
    dz: (fz * forwardAmount + rz * rightAmount) * scale,
  };
}
