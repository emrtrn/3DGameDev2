/**
 * Actor Script *instance* spawning: turns a placed {@link LayoutActorInstance}
 * (a `classRef` + world transform) plus its resolved {@link ActorScriptDef}
 * class into an engine {@link Entity}.
 *
 * This is the runtime half of "Sınıf ≠ Instance": the class (`*.actor.json`) is
 * authored once; a level places it many times; here each placement is flattened
 * into a single entity the existing subsystems already understand (physics +
 * behavior read it via `setEntities`, the render shell reads its mesh/transform).
 *
 * v1 collapse (documented, not an oversight): Forge entities are flat — one
 * component per type. An actor's component *tree* (which can hold several nodes
 * of the same kind) collapses to a single entity taking the FIRST node of each
 * kind. The instance's world transform is authoritative (the root Transform
 * node's props are ignored for placement). Event bindings collapse to a single
 * Behavior (the first binding); per-instance overrides and multi-behavior /
 * multi-node hierarchy are later phases (see docs B4).
 *
 * Pure module: no Three.js, no DOM. Both the runtime (spawning) and headless
 * tests read this; `props` flow straight through as component data because
 * `read*Component` already parses an arbitrary `EntityComponentData` record.
 */
import type { ActorScriptDef } from "./actorScript";
import {
  BEHAVIOR_COMPONENT,
  TRANSFORM_COMPONENT,
  type TransformComponent,
} from "./components";
import type { Entity, EntityComponentData, EntityComponentMap } from "./entity";
import type { LayoutActorInstance } from "./layout";
import { readRotation, readScale } from "./transform";

/** A placed actor instance paired with its resolved class + layout index. */
export interface ResolvedActorClass {
  index: number;
  instance: LayoutActorInstance;
  def: ActorScriptDef;
}

/** Entity id for the actor instance at `index` (mirrors the `character:<n>` scheme). */
export function actorInstanceEntityId(index: number): string {
  return `actor:${index}`;
}

/** Parses an `actor:<index>` entity id back to its layout index, or null. */
export function parseActorInstanceEntityIndex(entityId: string): number | null {
  if (!entityId.startsWith("actor:")) return null;
  const index = Number(entityId.slice("actor:".length));
  return Number.isInteger(index) && index >= 0 ? index : null;
}

/**
 * Selects the single behavior an instance runs this version. Event bindings are
 * the authored "event graph" surface, so the first binding wins; a `Behavior`
 * component node in the tree is the fallback. Returns null when the class has
 * neither. (Multiple bindings/behaviors per entity = B4.)
 */
function selectBehaviorData(def: ActorScriptDef): EntityComponentData | null {
  const binding = def.eventBindings[0];
  if (binding) {
    const data: EntityComponentData = { scriptId: binding.scriptId };
    if (binding.params && Object.keys(binding.params).length > 0) {
      data.params = { ...binding.params };
    }
    return data;
  }
  const behaviorNode = def.components.find((node) => node.component === BEHAVIOR_COMPONENT);
  if (behaviorNode && typeof behaviorNode.props.scriptId === "string") {
    return { ...behaviorNode.props } as EntityComponentData;
  }
  return null;
}

/** Builds the instance's authoritative transform component data from its placement. */
function instanceTransform(instance: LayoutActorInstance): TransformComponent {
  return {
    position: [instance.position[0], instance.position[1], instance.position[2]],
    rotation: readRotation(instance),
    scale: readScale(instance),
  };
}

/**
 * Flattens a placed actor instance + its resolved class into one entity.
 *
 * The component map is seeded with the instance's Transform, then each non-root
 * component node contributes its props as that component's data (first node of
 * each kind wins). Authored event bindings compile to a Behavior when the tree
 * did not already place one. `parentId` is left to the caller to resolve from
 * the layout `nodeId`/`parentId` space (like the legacy adapter's second pass).
 */
export function actorInstanceToEntity(
  def: ActorScriptDef,
  instance: LayoutActorInstance,
  index: number,
): Entity {
  const components: EntityComponentMap = {
    [TRANSFORM_COMPONENT]: instanceTransform(instance) as unknown as EntityComponentData,
  };

  for (const node of def.components) {
    // The instance transform is authoritative; any Transform node is skipped.
    if (node.component === TRANSFORM_COMPONENT) continue;
    // First node of each kind wins (flat entity = one component per type).
    if (components[node.component]) continue;
    components[node.component] = { ...node.props };
  }

  if (!components[BEHAVIOR_COMPONENT]) {
    const behavior = selectBehaviorData(def);
    if (behavior) components[BEHAVIOR_COMPONENT] = behavior;
  }

  const tags: string[] = [];
  if (instance.hidden) tags.push("hidden");
  if (instance.locked) tags.push("locked");

  const entity: Entity = {
    id: actorInstanceEntityId(index),
    components,
  };
  const name = instance.name ?? def.name;
  if (name) entity.name = name;
  if (tags.length > 0) entity.tags = tags;
  return entity;
}
