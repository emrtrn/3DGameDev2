import type { Entity, SceneJsonValue } from "./entity";
import type { LayoutPhysicsAxisLocks, ParticleMaterialMode, Vec3 } from "./layout";

export type { ParticleMaterialMode };

export const TRANSFORM_COMPONENT = "Transform";
export const MESH_RENDERER_COMPONENT = "MeshRenderer";
export const LIGHT_COMPONENT = "Light";
export const METADATA_COMPONENT = "Metadata";
export const BEHAVIOR_COMPONENT = "Behavior";
export const COLLIDER_COMPONENT = "Collider";
export const AUDIO_COMPONENT = "Audio";
export const PARTICLE_EMITTER_COMPONENT = "ParticleEmitter";
export const INTERACTION_COMPONENT = "Interaction";

export type SceneLightType = "directional" | "point" | "spot";
export type ColliderShape = "box" | "sphere" | "capsule" | "cylinder" | "cone" | "convex";

export interface TransformComponent {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export interface MeshRendererComponent {
  assetId: string;
  materialSlot?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export interface LightComponent {
  type: SceneLightType;
  color?: string;
  intensity?: number;
  castShadow?: boolean;
  distance?: number;
  angle?: number;
  penumbra?: number;
  decay?: number;
}

export interface MetadataComponent {
  values: Record<string, SceneJsonValue>;
}

/**
 * Attaches a runtime script to an entity: a registered behavior `scriptId` plus
 * opaque JSON `params`. The behavior registry (a runtime concern) resolves the
 * id to an update function; the engine layer only stores the reference.
 */
export interface BehaviorComponent {
  scriptId: string;
  params?: Record<string, SceneJsonValue>;
}

/**
 * One simple-collision shape of a (possibly compound) collider. Sizes/centers
 * are world-scaled (placement scale baked in), like {@link ColliderComponent};
 * `rotation` is a local Euler rotation in degrees for oriented shapes.
 */
export interface ColliderPrimitive {
  shape: ColliderShape;
  size: Vec3;
  center?: Vec3;
  rotation?: Vec3;
  /** Baked convex hull points (world-scaled, relative to body origin) for `shape === "convex"`. */
  points?: Vec3[];
}

export interface ColliderComponent {
  shape: ColliderShape;
  /** World-axis-aligned full size (placement scale already baked in). */
  size: Vec3;
  /**
   * Offset of the collider center from the entity's transform position, in world
   * space (placement scale baked in). Absent means centered on the position.
   */
  center?: Vec3;
  /**
   * Authored compound collision shapes (Static Mesh editor). When present, the
   * physics backend builds one collider per primitive; `shape`/`size`/`center`
   * above describe the encompassing AABB used by the broad-phase / movement.
   */
  primitives?: ColliderPrimitive[];
  isStatic: boolean;
  isSensor: boolean;
  /** Surface friction (Rapier). Absent uses the backend default. */
  friction?: number;
  /** Surface restitution / bounciness (Rapier). Absent uses the backend default. */
  restitution?: number;
  /** Emit begin/end overlap events for sensors. Absent means true. */
  generateOverlapEvents?: boolean;
  /** Emit hit events while simulating physics. Absent means true. */
  simulationGeneratesHitEvents?: boolean;
  /** Packed Rapier interaction groups (membership<<16 | filter). Absent = interact with all. */
  collisionGroups?: number;
  simulatePhysics?: boolean;
  massKg?: number;
  linearDamping?: number;
  angularDamping?: number;
  enableGravity?: boolean;
  lockPosition?: LayoutPhysicsAxisLocks;
  lockRotation?: LayoutPhysicsAxisLocks;
}

export interface AudioComponent {
  clipId: string;
  volume: number;
  loop: boolean;
  spatial: boolean;
  /** Play automatically on scene load (ambient). Absent means false. */
  autoPlay?: boolean;
}

/**
 * Drives a particle/VFX emitter from a manifest `effectId`. Sizes are in world
 * units, `rate` in particles/second, `lifetime` in seconds; `materialMode` picks
 * the blend and `worldSpace` keeps spawned particles in world space (vs. local to
 * the moving emitter). Absent optional fields let the VFX system apply its
 * defaults. The engine layer only stores the reference; a VFX system (a runtime
 * concern) resolves `effectId` and simulates, like Behavior resolves `scriptId`.
 */
export interface ParticleEmitterComponent {
  effectId: string;
  loop?: boolean;
  rate?: number;
  lifetime?: number;
  startSize?: number;
  endSize?: number;
  velocity?: Vec3;
  spread?: number;
  materialMode?: ParticleMaterialMode;
  worldSpace?: boolean;
  autoPlay?: boolean;
}

/**
 * Marks an entity as interactable: an `action` id the runtime interprets, an
 * optional player-facing `prompt`, a default `enabled` flag, an optional
 * `requires` gate (e.g. an inventory/key id) and an optional `cooldown` in
 * seconds. Project gameplay rules (runtime) interpret these; the engine only
 * stores the authored data, like Behavior/Metadata. Typically paired with a
 * (sensor) {@link ColliderComponent} so an InteractionSystem can detect overlap.
 */
export interface InteractionComponent {
  action: string;
  prompt?: string;
  enabled?: boolean;
  requires?: string;
  cooldown?: number;
}

function readVec3(value: SceneJsonValue | undefined): Vec3 | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  const [x, y, z] = value;
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") return undefined;
  return [x, y, z];
}

function readPhysicsAxisLocks(
  value: SceneJsonValue | undefined,
): LayoutPhysicsAxisLocks | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  const [x, y, z] = value;
  if (typeof x !== "boolean" || typeof y !== "boolean" || typeof z !== "boolean") {
    return undefined;
  }
  return [x, y, z];
}

/** Reads a typed transform from an entity's serializable component data. */
export function readTransformComponent(entity: Entity): TransformComponent | undefined {
  const data = entity.components[TRANSFORM_COMPONENT];
  if (!data) return undefined;
  const position = readVec3(data.position);
  const rotation = readVec3(data.rotation);
  const scale = readVec3(data.scale);
  if (!position || !rotation || !scale) return undefined;
  return { position, rotation, scale };
}

/** Reads a typed mesh renderer from an entity's serializable component data. */
export function readMeshRendererComponent(entity: Entity): MeshRendererComponent | undefined {
  const data = entity.components[MESH_RENDERER_COMPONENT];
  if (!data) return undefined;
  if (typeof data.assetId !== "string") return undefined;
  const component: MeshRendererComponent = { assetId: data.assetId };
  if (typeof data.materialSlot === "string") component.materialSlot = data.materialSlot;
  if (typeof data.castShadow === "boolean") component.castShadow = data.castShadow;
  if (typeof data.receiveShadow === "boolean") component.receiveShadow = data.receiveShadow;
  return component;
}

/** Reads a typed metadata component from an entity's serializable component data. */
export function readMetadataComponent(entity: Entity): MetadataComponent | undefined {
  const data = entity.components[METADATA_COMPONENT];
  if (!data) return undefined;
  const values = data.values;
  if (typeof values !== "object" || values === null || Array.isArray(values)) return undefined;
  return { values: { ...(values as Record<string, SceneJsonValue>) } };
}

/** Reads a typed behavior reference from an entity's serializable component data. */
export function readBehaviorComponent(entity: Entity): BehaviorComponent | undefined {
  const data = entity.components[BEHAVIOR_COMPONENT];
  if (!data) return undefined;
  if (typeof data.scriptId !== "string" || data.scriptId.length === 0) return undefined;
  const component: BehaviorComponent = { scriptId: data.scriptId };
  const params = data.params;
  if (typeof params === "object" && params !== null && !Array.isArray(params)) {
    component.params = { ...(params as Record<string, SceneJsonValue>) };
  }
  return component;
}

const COLLIDER_SHAPES: readonly ColliderShape[] = [
  "box",
  "sphere",
  "capsule",
  "cylinder",
  "cone",
  "convex",
];

/** Parses the optional compound-collider `primitives` array. */
function readColliderPrimitives(
  value: SceneJsonValue | undefined,
): ColliderPrimitive[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const primitives: ColliderPrimitive[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, SceneJsonValue>;
    if (
      typeof record.shape !== "string" ||
      !COLLIDER_SHAPES.includes(record.shape as ColliderShape)
    ) {
      continue;
    }
    const size = readVec3(record.size);
    if (!size) continue;
    const primitive: ColliderPrimitive = { shape: record.shape as ColliderShape, size };
    const center = readVec3(record.center);
    if (center) primitive.center = center;
    const rotation = readVec3(record.rotation);
    if (rotation) primitive.rotation = rotation;
    if (Array.isArray(record.points)) {
      const points = record.points
        .map((point) => readVec3(point))
        .filter((point): point is Vec3 => point !== undefined);
      if (points.length > 0) primitive.points = points;
    }
    primitives.push(primitive);
  }
  return primitives.length > 0 ? primitives : undefined;
}

/** Reads a typed collider from an entity's serializable component data. */
export function readColliderComponent(entity: Entity): ColliderComponent | undefined {
  const data = entity.components[COLLIDER_COMPONENT];
  if (!data) return undefined;
  if (typeof data.shape !== "string" || !COLLIDER_SHAPES.includes(data.shape as ColliderShape)) {
    return undefined;
  }
  const size = readVec3(data.size);
  if (!size) return undefined;
  if (typeof data.isStatic !== "boolean" || typeof data.isSensor !== "boolean") return undefined;
  const center = readVec3(data.center);
  const component: ColliderComponent = {
    shape: data.shape as ColliderShape,
    size,
    isStatic: data.isStatic,
    isSensor: data.isSensor,
  };
  if (center) component.center = center;
  const primitives = readColliderPrimitives(data.primitives);
  if (primitives) component.primitives = primitives;
  if (typeof data.friction === "number") component.friction = data.friction;
  if (typeof data.restitution === "number") component.restitution = data.restitution;
  if (typeof data.generateOverlapEvents === "boolean") {
    component.generateOverlapEvents = data.generateOverlapEvents;
  }
  if (typeof data.simulationGeneratesHitEvents === "boolean") {
    component.simulationGeneratesHitEvents = data.simulationGeneratesHitEvents;
  }
  if (typeof data.collisionGroups === "number") component.collisionGroups = data.collisionGroups;
  if (typeof data.simulatePhysics === "boolean") component.simulatePhysics = data.simulatePhysics;
  if (typeof data.massKg === "number") component.massKg = data.massKg;
  if (typeof data.linearDamping === "number") component.linearDamping = data.linearDamping;
  if (typeof data.angularDamping === "number") component.angularDamping = data.angularDamping;
  if (typeof data.enableGravity === "boolean") component.enableGravity = data.enableGravity;
  const lockPosition = readPhysicsAxisLocks(data.lockPosition);
  if (lockPosition) component.lockPosition = lockPosition;
  const lockRotation = readPhysicsAxisLocks(data.lockRotation);
  if (lockRotation) component.lockRotation = lockRotation;
  return component;
}

/** Reads a typed audio cue from an entity's serializable component data. */
export function readAudioComponent(entity: Entity): AudioComponent | undefined {
  const data = entity.components[AUDIO_COMPONENT];
  if (!data) return undefined;
  if (typeof data.clipId !== "string" || data.clipId.length === 0) return undefined;
  if (typeof data.volume !== "number" || !Number.isFinite(data.volume)) return undefined;
  if (typeof data.loop !== "boolean" || typeof data.spatial !== "boolean") return undefined;
  const component: AudioComponent = {
    clipId: data.clipId,
    volume: data.volume,
    loop: data.loop,
    spatial: data.spatial,
  };
  if (typeof data.autoPlay === "boolean") component.autoPlay = data.autoPlay;
  return component;
}

const PARTICLE_MATERIAL_MODES: readonly ParticleMaterialMode[] = ["additive", "alpha"];

/** Reads a typed particle emitter from an entity's serializable component data. */
export function readParticleEmitterComponent(
  entity: Entity,
): ParticleEmitterComponent | undefined {
  const data = entity.components[PARTICLE_EMITTER_COMPONENT];
  if (!data) return undefined;
  if (typeof data.effectId !== "string" || data.effectId.length === 0) return undefined;
  const component: ParticleEmitterComponent = { effectId: data.effectId };
  if (typeof data.loop === "boolean") component.loop = data.loop;
  if (typeof data.rate === "number") component.rate = data.rate;
  if (typeof data.lifetime === "number") component.lifetime = data.lifetime;
  if (typeof data.startSize === "number") component.startSize = data.startSize;
  if (typeof data.endSize === "number") component.endSize = data.endSize;
  const velocity = readVec3(data.velocity);
  if (velocity) component.velocity = velocity;
  if (typeof data.spread === "number") component.spread = data.spread;
  if (
    typeof data.materialMode === "string" &&
    PARTICLE_MATERIAL_MODES.includes(data.materialMode as ParticleMaterialMode)
  ) {
    component.materialMode = data.materialMode as ParticleMaterialMode;
  }
  if (typeof data.worldSpace === "boolean") component.worldSpace = data.worldSpace;
  if (typeof data.autoPlay === "boolean") component.autoPlay = data.autoPlay;
  return component;
}

/** Reads a typed interaction marker from an entity's serializable component data. */
export function readInteractionComponent(entity: Entity): InteractionComponent | undefined {
  const data = entity.components[INTERACTION_COMPONENT];
  if (!data) return undefined;
  if (typeof data.action !== "string" || data.action.length === 0) return undefined;
  const component: InteractionComponent = { action: data.action };
  if (typeof data.prompt === "string") component.prompt = data.prompt;
  if (typeof data.enabled === "boolean") component.enabled = data.enabled;
  if (typeof data.requires === "string") component.requires = data.requires;
  if (typeof data.cooldown === "number") component.cooldown = data.cooldown;
  return component;
}

const LIGHT_TYPES: readonly SceneLightType[] = ["directional", "point", "spot"];

/** Reads a typed light from an entity's serializable component data. */
export function readLightComponent(entity: Entity): LightComponent | undefined {
  const data = entity.components[LIGHT_COMPONENT];
  if (!data) return undefined;
  if (typeof data.type !== "string" || !LIGHT_TYPES.includes(data.type as SceneLightType)) {
    return undefined;
  }
  const component: LightComponent = { type: data.type as SceneLightType };
  if (typeof data.color === "string") component.color = data.color;
  if (typeof data.intensity === "number") component.intensity = data.intensity;
  if (typeof data.castShadow === "boolean") component.castShadow = data.castShadow;
  if (typeof data.distance === "number") component.distance = data.distance;
  if (typeof data.angle === "number") component.angle = data.angle;
  if (typeof data.penumbra === "number") component.penumbra = data.penumbra;
  if (typeof data.decay === "number") component.decay = data.decay;
  return component;
}
