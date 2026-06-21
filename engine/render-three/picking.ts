import { InstancedMesh, Object3D } from "three";

export function findParentInstancedMesh(object: Object3D): InstancedMesh | null {
  let current: Object3D | null = object;
  while (current) {
    if (current instanceof InstancedMesh) return current;
    current = current.parent;
  }
  return null;
}

export function findParentCharacter(object: Object3D): Object3D | null {
  let current: Object3D | null = object;
  while (current) {
    if (current.userData.characterIndex !== undefined) return current;
    current = current.parent;
  }
  return null;
}

export function findParentActor(object: Object3D): Object3D | null {
  let current: Object3D | null = object;
  while (current) {
    if (current.userData.actorIndex !== undefined) return current;
    current = current.parent;
  }
  return null;
}

export function findParentLight(object: Object3D): Object3D | null {
  let current: Object3D | null = object;
  while (current) {
    if (current.userData.lightIndex !== undefined) return current;
    current = current.parent;
  }
  return null;
}

export function findParentReflectionPlane(object: Object3D): Object3D | null {
  let current: Object3D | null = object;
  while (current) {
    if (current.userData.reflectionPlaneIndex !== undefined) return current;
    current = current.parent;
  }
  return null;
}

export function findParentReflectiveSurface(object: Object3D): Object3D | null {
  let current: Object3D | null = object;
  while (current) {
    if (current.userData.reflectiveSurfaceIndex !== undefined) return current;
    current = current.parent;
  }
  return null;
}

export function findParentReflectionCapture(object: Object3D): Object3D | null {
  let current: Object3D | null = object;
  while (current) {
    if (current.userData.reflectionCaptureIndex !== undefined) return current;
    current = current.parent;
  }
  return null;
}
