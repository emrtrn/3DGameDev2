/**
 * Runtime/game behavior registry: concrete script id -> update function map.
 *
 * Game content lives here, not in the engine. Each behavior receives the engine
 * tick context, the input action map, its authored params, and a mutable entity
 * transform it may edit. The BehaviorSubsystem syncs the transform back to the
 * rendered object after each tick.
 */
import type {
  BehaviorRegistry,
  BehaviorUpdate,
} from "@engine/behavior/behaviorSubsystem";

function numberParam(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Spins an entity around one axis at `speedDeg` degrees per second. */
const spin: BehaviorUpdate = ({ engine, params, transform }) => {
  const speedDeg = numberParam(params.speedDeg, 90);
  const axis = params.axis === "x" ? 0 : params.axis === "z" ? 2 : 1;
  transform.rotation[axis] += speedDeg * engine.deltaSeconds;
};

/**
 * Moves an entity on the XZ plane from the named movement actions at `speed`
 * units per second. Demonstrates the spine driving gameplay from input.
 */
const inputMove: BehaviorUpdate = ({ engine, actions, params, transform }) => {
  const step = numberParam(params.speed, 3) * engine.deltaSeconds;
  if (actions.held("move-forward")) transform.position[2] -= step;
  if (actions.held("move-back")) transform.position[2] += step;
  if (actions.held("move-left")) transform.position[0] -= step;
  if (actions.held("move-right")) transform.position[0] += step;
};

/** Builds the runtime behavior registry used by the BehaviorSubsystem. */
export function createBehaviorRegistry(): BehaviorRegistry {
  const behaviors = new Map<string, BehaviorUpdate>([
    ["spin", spin],
    ["input-move", inputMove],
  ]);
  return { get: (scriptId) => behaviors.get(scriptId) };
}
