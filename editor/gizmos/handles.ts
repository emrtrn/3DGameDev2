import { DoubleSide, Mesh, MeshBasicMaterial, Object3D } from "three";

import type { EditorTool } from "@editor/core/tools";
import type { GizmoAxis } from "./axes";

export interface GizmoHandle {
  tool: EditorTool;
  axis: GizmoAxis;
}

const GIZMO_RENDER_ORDER = 1000;
const GIZMO_OPACITY = 0.42;
const GIZMO_ACTIVE_OPACITY = 0.62;
const GIZMO_ACTIVE_COLOR = 0xff9f1a;
const GIZMO_HOVER_COLOR = 0xffc24d;
const GIZMO_HOVER_OPACITY = 0.9;

export function gizmoHandlesEqual(
  left: GizmoHandle | null | undefined,
  right: GizmoHandle | null | undefined,
): boolean {
  return left?.tool === right?.tool && left?.axis === right?.axis;
}

export function createGizmoHandleMaterial(
  handle: GizmoHandle,
  baseColor: number,
  activeHandle: GizmoHandle | null,
  hoveredHandle: GizmoHandle | null,
): MeshBasicMaterial {
  if (gizmoHandlesEqual(activeHandle, handle)) {
    return createGizmoMaterial(GIZMO_ACTIVE_COLOR, GIZMO_ACTIVE_OPACITY);
  }
  if (gizmoHandlesEqual(hoveredHandle, handle)) {
    return createGizmoMaterial(GIZMO_HOVER_COLOR, GIZMO_HOVER_OPACITY);
  }
  return createGizmoMaterial(baseColor, GIZMO_OPACITY);
}

export function registerGizmoHandlePickables(
  object: Object3D,
  handle: GizmoHandle,
  pickables: Object3D[],
): void {
  object.userData.gizmoHandle = handle;
  object.traverse((child) => {
    child.userData.gizmoHandle = handle;
    child.renderOrder = GIZMO_RENDER_ORDER;
    if (child instanceof Mesh) pickables.push(child);
  });
}

function createGizmoMaterial(color: number, opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity,
    side: DoubleSide,
  });
}
