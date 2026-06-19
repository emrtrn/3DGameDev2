/**
 * Actor Script *editor preview* model.
 *
 * Turns an {@link ActorScriptDef} class into a flat list of {@link ActorPreviewNode}s
 * the Actor Script editor's 3D viewport renders. Unlike the runtime
 * `actorInstanceToEntity` (which collapses the component tree into one flat
 * entity), the preview keeps the *whole* tree: every node, with its parent link
 * and local transform, so the editor shows multiple meshes / colliders / lights
 * and their parent-child hierarchy.
 *
 * Pure module: no Three.js, no DOM. The viewport (a `src/editor/` consumer)
 * walks the list, builds an Object3D per node, applies the local transform, and
 * parents each node to its `parent` so Three.js composes the world transform.
 * Headless tests exercise the transform/payload extraction here.
 */
import type {
  ActorComponentKind,
  ActorScriptDef,
  ComponentTemplateNode,
} from "./actorScript";
import type { ColliderShape, SceneLightType } from "./components";
import type { SceneJsonValue } from "./entity";
import type { Vec3 } from "./layout";

/** MeshRenderer preview payload (mesh resolved by the viewport from `assetId`). */
export interface PreviewMesh {
  assetId?: string;
}

/** Collider preview payload (drives a wireframe shape, sensor → different color). */
export interface PreviewCollider {
  shape: ColliderShape;
  size: Vec3;
  center?: Vec3;
  rotation?: Vec3;
  isSensor: boolean;
}

/** Light preview payload (drives a Three.js light + gizmo). */
export interface PreviewLight {
  type: SceneLightType;
  color?: string;
  intensity?: number;
  distance?: number;
  angle?: number;
  penumbra?: number;
  decay?: number;
}

/**
 * One node of the preview tree: the template node's identity + parent link, its
 * local transform (parsed leniently from `props`), and a kind-specific payload
 * for the visual kinds. Non-visual kinds (Audio/Interaction/Behavior/Metadata)
 * carry only `component` and render as a small icon marker.
 */
export interface ActorPreviewNode {
  id: string;
  parent?: string;
  component: ActorComponentKind;
  /** Local position (props.position, default origin). */
  position: Vec3;
  /** Local XYZ-order Euler rotation in degrees (props.rotation, default 0). */
  rotation: Vec3;
  /** Local scale (props.scale, default unit). */
  scale: Vec3;
  mesh?: PreviewMesh;
  collider?: PreviewCollider;
  light?: PreviewLight;
}

const COLLIDER_SHAPES: readonly ColliderShape[] = [
  "box",
  "sphere",
  "capsule",
  "cylinder",
  "cone",
  "convex",
];
const LIGHT_TYPES: readonly SceneLightType[] = ["directional", "point", "spot"];

function readVec3(value: SceneJsonValue | undefined): Vec3 | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  const [x, y, z] = value;
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") return undefined;
  return [x, y, z];
}

function readNumber(value: SceneJsonValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function meshPayload(props: Record<string, SceneJsonValue>): PreviewMesh {
  const payload: PreviewMesh = {};
  if (typeof props.assetId === "string" && props.assetId.length > 0) payload.assetId = props.assetId;
  return payload;
}

function colliderPayload(props: Record<string, SceneJsonValue>): PreviewCollider {
  const shape =
    typeof props.shape === "string" && COLLIDER_SHAPES.includes(props.shape as ColliderShape)
      ? (props.shape as ColliderShape)
      : "box";
  const payload: PreviewCollider = {
    shape,
    size: readVec3(props.size) ?? [1, 1, 1],
    isSensor: props.isSensor === true,
  };
  const center = readVec3(props.center);
  if (center) payload.center = center;
  const rotation = readVec3(props.rotation);
  if (rotation) payload.rotation = rotation;
  return payload;
}

function lightPayload(props: Record<string, SceneJsonValue>): PreviewLight {
  const type =
    typeof props.type === "string" && LIGHT_TYPES.includes(props.type as SceneLightType)
      ? (props.type as SceneLightType)
      : "directional";
  const payload: PreviewLight = { type };
  if (typeof props.color === "string") payload.color = props.color;
  const intensity = readNumber(props.intensity);
  if (intensity !== undefined) payload.intensity = intensity;
  const distance = readNumber(props.distance);
  if (distance !== undefined) payload.distance = distance;
  const angle = readNumber(props.angle);
  if (angle !== undefined) payload.angle = angle;
  const penumbra = readNumber(props.penumbra);
  if (penumbra !== undefined) payload.penumbra = penumbra;
  const decay = readNumber(props.decay);
  if (decay !== undefined) payload.decay = decay;
  return payload;
}

/** Builds one preview node from a template node (lenient prop parsing). */
function previewNode(node: ComponentTemplateNode): ActorPreviewNode {
  const props = node.props;
  const preview: ActorPreviewNode = {
    id: node.id,
    component: node.component,
    position: readVec3(props.position) ?? [0, 0, 0],
    rotation: readVec3(props.rotation) ?? [0, 0, 0],
    scale: readVec3(props.scale) ?? [1, 1, 1],
  };
  if (node.component === "MeshRenderer") preview.mesh = meshPayload(props);
  else if (node.component === "Collider") {
    preview.collider = colliderPayload(props);
    // The collider shape carries its own size/center/rotation; keep the node
    // transform from position/scale only (rotation lives on the payload).
    preview.rotation = [0, 0, 0];
    preview.scale = [1, 1, 1];
  } else if (node.component === "Light") preview.light = lightPayload(props);
  if (node.parent !== undefined) preview.parent = node.parent;
  return preview;
}

/**
 * Flattens a class into its preview-node list (document order preserved).
 *
 * Every component node maps to one preview node; `parent` ids are kept verbatim
 * so the viewport can rebuild the parent-child Object3D graph. Nodes whose
 * `parent` does not resolve are treated as roots by the viewport (defensive: a
 * malformed class still renders).
 */
export function actorPreviewNodes(def: ActorScriptDef): ActorPreviewNode[] {
  return def.components.map(previewNode);
}
