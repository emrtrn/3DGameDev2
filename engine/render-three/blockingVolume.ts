import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type BufferGeometry,
} from "three";

import type { BrushShape, Vec3 } from "@engine/scene/layout";
import type { ResolvedBlockingVolume } from "@engine/scene/blockingVolume";

export {
  BRUSH_SHAPES,
  isBrushShape,
  resolveBlockingVolume,
  blockingVolumeCollisionDef,
  BLOCKING_VOLUME_DEFAULTS,
  DEFAULT_BRUSH_SIZE,
  uniqueBlockingVolumeId,
  uniqueBlockingVolumeName,
  type ResolvedBlockingVolume,
} from "@engine/scene/blockingVolume";

/**
 * Blocking Volume render binding — the web/three counterpart to Unreal's
 * BlockingVolume / brush volumes. A parametric primitive (box / cylinder / cone /
 * sphere) built at the brush `size`; the actor's transform (position/rotation/scale)
 * orients and further sizes it. In the **editor** it draws as a translucent orange
 * brush + wireframe (Unreal's brush look); in **runtime** (Play) it draws as a solid
 * neutral grey-box, and the caller toggles `visible` from `renderInGame`.
 *
 * Geometry is built from the shape + size, so a shape or size change requires
 * rebuilding the object (mirrors the Planar Reflection resolution rebuild).
 */

/** The three.js object backing a Blocking Volume actor (fill mesh + optional wireframe). */
export type BlockingVolumeObject = Group;

/** Resolved settings + world transform the binding needs to build/sync a volume. */
export interface BlockingVolumeRenderItem extends ResolvedBlockingVolume {
  position: Vec3;
  /** XYZ-order Euler rotation in degrees. */
  rotation: Vec3;
  /** Per-axis transform scale (multiplied onto the brush size). */
  scale: Vec3;
}

/** Neutral solid colour for the runtime grey-box. */
const RUNTIME_BLOCKING_VOLUME_COLOR = "#9aa0a6";

/** Builds the parametric brush geometry (full extents = `size`). */
export function createBlockingVolumeGeometry(shape: BrushShape, size: Vec3): BufferGeometry {
  const [sx, sy, sz] = size;
  switch (shape) {
    case "box":
      return new BoxGeometry(sx, sy, sz);
    case "cylinder":
      return new CylinderGeometry(sx / 2, sx / 2, sy, 24);
    case "cone":
      return new ConeGeometry(sx / 2, sy, 24);
    case "sphere":
      return new SphereGeometry(sx / 2, 24, 16);
  }
}

/**
 * Builds the editor brush object: a translucent orange fill + an orange wireframe.
 * The fill is single-sided + non-depth-writing so overlapping brushes read cleanly.
 */
export function createBlockingVolumeObject(item: BlockingVolumeRenderItem): BlockingVolumeObject {
  const group = new Group();
  group.name = item.name;
  const geometry = createBlockingVolumeGeometry(item.brushShape, item.size);
  const fill = new Mesh(
    geometry,
    new MeshStandardMaterial({
      color: new Color(item.color),
      transparent: true,
      opacity: 0.22,
      roughness: 0.9,
      metalness: 0,
      depthWrite: false,
    }),
  );
  fill.name = "blocking-volume-fill";
  fill.castShadow = false;
  fill.receiveShadow = false;
  group.add(fill);

  const wireframe = new LineSegments(
    new EdgesGeometry(geometry),
    new LineBasicMaterial({ color: new Color(item.color) }),
  );
  wireframe.name = "blocking-volume-wire";
  wireframe.raycast = () => {};
  group.add(wireframe);

  applyBlockingVolumeTransform(group, item);
  return group;
}

/**
 * Builds the runtime (Play) brush object: a solid neutral grey-box that casts +
 * receives shadows. Caller sets `visible` from `renderInGame` (off = invisible-but-
 * blocking; collision is independent of this mesh).
 */
export function createRuntimeBlockingVolumeObject(
  item: BlockingVolumeRenderItem,
): BlockingVolumeObject {
  const group = new Group();
  group.name = item.name;
  const fill = new Mesh(
    createBlockingVolumeGeometry(item.brushShape, item.size),
    new MeshStandardMaterial({
      color: new Color(RUNTIME_BLOCKING_VOLUME_COLOR),
      roughness: 0.85,
      metalness: 0,
    }),
  );
  fill.name = "blocking-volume-fill";
  fill.castShadow = true;
  fill.receiveShadow = true;
  group.add(fill);
  applyBlockingVolumeTransform(group, item);
  return group;
}

/** Pushes the transform + visibility onto an existing brush object. */
export function applyBlockingVolumeTransform(
  object: BlockingVolumeObject,
  item: BlockingVolumeRenderItem,
): void {
  object.position.set(item.position[0], item.position[1], item.position[2]);
  object.rotation.set(
    (item.rotation[0] * Math.PI) / 180,
    (item.rotation[1] * Math.PI) / 180,
    (item.rotation[2] * Math.PI) / 180,
    "XYZ",
  );
  object.scale.set(item.scale[0] || 1, item.scale[1] || 1, item.scale[2] || 1);
  object.visible = !item.hidden;
}

/** Frees every geometry + material under a brush object. */
export function disposeBlockingVolumeObject(object: BlockingVolumeObject): void {
  object.traverse((child) => {
    if (child instanceof Mesh || child instanceof LineSegments) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    }
  });
}
