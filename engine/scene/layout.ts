export type Vec3 = [number, number, number];
export type LayoutLightType = "directional" | "point" | "spot";

/**
 * Generic, project-defined gameplay metadata value. The base editor stays
 * schema-agnostic: it stores whatever scalar/list a project's metadata schema
 * declares without knowing the gameplay semantics.
 */
export type MetadataValue = string | number | boolean | string[];
export type LayoutMetadata = Record<string, MetadataValue>;

/**
 * Authoring reference to a runtime behavior script: a registered `script` id and
 * optional JSON-ish `params`. The runtime behavior registry resolves the id to
 * an update function; the saved layout only stores the reference.
 */
export interface LayoutBehavior {
  script: string;
  params?: LayoutMetadata;
}

export interface LayoutAudio {
  clipId: string;
  volume?: number;
  loop?: boolean;
  spatial?: boolean;
}

export type LayoutPhysicsAxisLocks = [boolean, boolean, boolean];

export interface LayoutPhysics {
  /** Override mass in kilograms. Absent lets the physics backend derive mass from the collider. */
  massKg?: number;
  /** Linear velocity damping. Absent means the runtime default. */
  linearDamping?: number;
  /** Angular velocity damping. Absent means the runtime default. */
  angularDamping?: number;
  /** Whether world gravity affects this body. Absent means true. */
  enableGravity?: boolean;
  /** Per-axis translation locks, X/Y/Z. Absent means all axes are free. */
  lockPosition?: LayoutPhysicsAxisLocks;
  /** Per-axis rotation locks, X/Y/Z. Absent means all axes are free. */
  lockRotation?: LayoutPhysicsAxisLocks;
}

export interface LayoutPlacement {
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  groupId?: string;
  /** Stable id assigned when this object becomes a parent (referenced by children). */
  nodeId?: string;
  /** This object's parent, referencing the parent's `nodeId`. */
  parentId?: string;
  position: Vec3;
  /** Legacy Y-only rotation in degrees. Read as a fallback when `rotation` is absent. */
  rotationYDeg?: number;
  /** Full Euler rotation (XYZ order) in degrees. Preferred over `rotationYDeg`. */
  rotation?: Vec3;
  /**
   * Authoring pivot: a point in the object's local (model) space that rotation
   * and scale gizmos act around. Absent/`[0,0,0]` means the model origin.
   * Editor-only; runtime should consume the baked world transform.
   */
  pivot?: Vec3;
  /** Uniform scalar (legacy) or per-axis scale. */
  scale?: number | Vec3;
  /** Editor hint: keep scale axes proportional when editing. */
  scaleLocked?: boolean;
  /** Legacy/runtime hint. Editor renderer controls instanced static shadows centrally. */
  castShadow?: boolean;
  /** Runtime hint: object participates in collision. Absent means true (default on). */
  collision?: boolean;
  /** Runtime hint: collider is a non-blocking sensor (trigger zone). Absent means false. */
  sensor?: boolean;
  /** Runtime hint: this object is a dynamic rigid body in Play mode. Absent means false. */
  simulatePhysics?: boolean;
  /** Runtime physics body settings used when this object simulates physics. */
  physics?: LayoutPhysics;
  /** Project-defined gameplay metadata (schema-driven; omitted when empty). */
  metadata?: LayoutMetadata;
  /** Runtime behavior script reference (resolved by the behavior registry). */
  behavior?: LayoutBehavior;
  /** Runtime audio cue attached to this object. */
  audio?: LayoutAudio;
}

export interface LayoutModelInstances {
  assetId: string;
  placements: LayoutPlacement[];
}

export interface LayoutCharacter {
  assetId: string;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  groupId?: string;
  /** Stable id assigned when this object becomes a parent (referenced by children). */
  nodeId?: string;
  /** This object's parent, referencing the parent's `nodeId`. */
  parentId?: string;
  position: Vec3;
  /** Legacy Y-only rotation in degrees. Read as a fallback when `rotation` is absent. */
  rotationYDeg?: number;
  /** Full Euler rotation (XYZ order) in degrees. Preferred over `rotationYDeg`. */
  rotation?: Vec3;
  /**
   * Authoring pivot: a point in the object's local (model) space that rotation
   * and scale gizmos act around. Absent/`[0,0,0]` means the model origin.
   * Editor-only; runtime should consume the baked world transform.
   */
  pivot?: Vec3;
  /** Uniform scalar (legacy) or per-axis scale. */
  scale?: number | Vec3;
  /** Editor hint: keep scale axes proportional when editing. */
  scaleLocked?: boolean;
  /** Runtime hint: character casts shadows. Absent means true (default on). */
  castShadow?: boolean;
  /** Runtime hint: object participates in collision. Absent means true (default on). */
  collision?: boolean;
  /** Runtime hint: collider is a non-blocking sensor (trigger zone). Absent means false. */
  sensor?: boolean;
  /** Runtime hint: this object is a dynamic rigid body in Play mode. Absent means false. */
  simulatePhysics?: boolean;
  /** Runtime physics body settings used when this object simulates physics. */
  physics?: LayoutPhysics;
  /** Project-defined gameplay metadata (schema-driven; omitted when empty). */
  metadata?: LayoutMetadata;
  animation?: string;
  /** Runtime behavior script reference (resolved by the behavior registry). */
  behavior?: LayoutBehavior;
  /** Runtime audio cue attached to this object. */
  audio?: LayoutAudio;
}

export interface LayoutWorldSettings {
  /** Central static/instanced shadow casting. Absent means false. */
  staticObjectsCastShadow?: boolean;
  /** Central static/instanced shadow receiving. Absent means true. */
  staticObjectsReceiveShadow?: boolean;
  /** Scene background color (hex). Absent means the default. */
  backgroundColor?: string;
  /** Ambient light color (hex). Absent means the default white. */
  ambientColor?: string;
  /** Ambient light intensity. Absent means 0 (no ambient). */
  ambientIntensity?: number;
  /** World gravity (units/s^2); negative Y pulls down. Absent means the default. */
  gravity?: Vec3;
  /**
   * Selected runtime Game Mode id (Unreal's GameMode analogue). Absent means the
   * built-in default camera mode; the runtime resolves unknown ids to that
   * default. Editor-authored; runtime-only behavior — never written back here by
   * a running session.
   */
  gameMode?: string;
}

export interface LayoutLightActor {
  id: string;
  type: LayoutLightType;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  scaleLocked?: boolean;
  groupId?: string;
  /** Stable id assigned when this object becomes a parent (referenced by children). */
  nodeId?: string;
  /** This object's parent, referencing the parent's `nodeId`. */
  parentId?: string;
  position: Vec3;
  /** Full Euler rotation (XYZ order) in degrees. */
  rotation?: Vec3;
  color?: string;
  intensity?: number;
  castShadow?: boolean;
  distance?: number;
  angle?: number;
  penumbra?: number;
  decay?: number;
}

export interface RoomLayout {
  schema: 1;
  name: string;
  loadGroups: string[];
  worldSettings?: LayoutWorldSettings;
  lights?: LayoutLightActor[];
  instances: LayoutModelInstances[];
  characters: LayoutCharacter[];
}
