import {
  Color,
  CubeCamera,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PMREMGenerator,
  SphereGeometry,
  WebGLCubeRenderTarget,
  type Scene,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";

import type { Vec3 } from "@engine/scene/layout";
import type { ResolvedSphereReflectionCapture } from "@engine/scene/reflectionCapture";

export {
  resolveSphereReflectionCapture,
  SPHERE_REFLECTION_CAPTURE_DEFAULTS,
  uniqueSphereReflectionCaptureId,
  uniqueSphereReflectionCaptureName,
  type ResolvedSphereReflectionCapture,
} from "@engine/scene/reflectionCapture";

/**
 * Sphere Reflection Capture render binding. Faz 1 renders only the editor-side
 * **influence helper**: a wireframe sphere marking the probe's radius, drawn at
 * the actor's position. There is no cubemap bake yet (that is a later phase) — the
 * helper is purely an authoring aid that is selectable and movable in the
 * viewport. The radius is applied as a uniform three.js scale on a unit-sphere
 * mesh, so a radius edit is a cheap `scale` change with no geometry rebuild; the
 * actor's layout transform never stores a scale.
 */

/** Editor wireframe-sphere helper backing a Sphere Reflection Capture actor. */
export type SphereReflectionCaptureObject = Mesh<SphereGeometry, MeshBasicMaterial>;

/** Resolved settings + world transform the binding needs to build/sync a probe helper. */
export interface SphereReflectionCaptureRenderItem extends ResolvedSphereReflectionCapture {
  position: Vec3;
  /** XYZ-order Euler rotation in degrees (cosmetic for a sphere; kept for the gizmo). */
  rotation: Vec3;
}

/** Tint of the influence-sphere wireframe helper. */
const CAPTURE_HELPER_COLOR = "#46c8ff";

/** Builds the wireframe influence-sphere helper; transform via {@link applySphereReflectionCaptureTransform}. */
export function createSphereReflectionCaptureObject(
  item: SphereReflectionCaptureRenderItem,
): SphereReflectionCaptureObject {
  // Unit sphere scaled by the radius so radius edits never rebuild geometry.
  const geometry = new SphereGeometry(1, 24, 16);
  const material = new MeshBasicMaterial({
    color: new Color(CAPTURE_HELPER_COLOR),
    wireframe: true,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = item.name;
  applySphereReflectionCaptureTransform(mesh, item);
  return mesh;
}

/** Pushes the transform + visibility + radius (as scale) onto an existing helper. */
export function applySphereReflectionCaptureTransform(
  mesh: SphereReflectionCaptureObject,
  item: SphereReflectionCaptureRenderItem,
): void {
  mesh.position.set(item.position[0], item.position[1], item.position[2]);
  mesh.rotation.set(
    (item.rotation[0] * Math.PI) / 180,
    (item.rotation[1] * Math.PI) / 180,
    (item.rotation[2] * Math.PI) / 180,
    "XYZ",
  );
  mesh.scale.setScalar(Math.max(item.radius, 0.001));
  mesh.visible = !item.hidden;
}

/** Frees the helper's geometry + material. */
export function disposeSphereReflectionCaptureObject(mesh: SphereReflectionCaptureObject): void {
  mesh.geometry.dispose();
  mesh.material.dispose();
}

/**
 * A baked probe: the prefiltered (PMREM) environment captured from the probe's
 * position, plus the resolved scalars copied at bake time so the nearest-probe
 * envMap pass (Faz 3) has a self-contained descriptor. The owner must dispose the
 * `target` (via {@link disposeSphereReflectionCaptureBake}) before replacing it.
 */
export interface SphereReflectionCaptureBake {
  /** Prefiltered PMREM environment render target (`.texture` drives envMaps). */
  target: WebGLRenderTarget;
  /** World position the cubemap was captured from. */
  position: Vec3;
  /** Influence radius copied from the actor at bake time. */
  radius: number;
  /** Reflection strength multiplier copied at bake time. */
  intensity: number;
  /** Overlap tie-breaker copied at bake time. */
  priority: number;
  /** Cubemap face resolution this was baked at (lets the owner detect rebake-on-resolution). */
  resolution: number;
}

/**
 * Bakes a Sphere Reflection Capture: renders the scene into a cubemap from the
 * probe's position with a {@link CubeCamera}, then prefilters it into a PMREM
 * environment target (à la Unreal's static Sphere Reflection Capture). The capture
 * is a snapshot — callers bake on load / add / Recapture, never per frame. The
 * caller is responsible for hiding editor-only aids (helpers, gizmo) before baking
 * so they do not pollute the reflection. Tone mapping is forced off during the
 * bake so the environment is stored in neutral/linear space. The raw cube target
 * is freed here; only the returned PMREM target survives and the caller owns it.
 */
export function bakeSphereReflectionCapture(
  renderer: WebGLRenderer,
  scene: Scene,
  item: SphereReflectionCaptureRenderItem,
): SphereReflectionCaptureBake {
  const cubeTarget = new WebGLCubeRenderTarget(item.resolution, { type: HalfFloatType });
  const cubeCamera = new CubeCamera(item.near, item.far, cubeTarget);
  cubeCamera.position.set(item.position[0], item.position[1], item.position[2]);
  // The cube camera is not parented; update its world matrix so the six face
  // cameras render from the probe position.
  cubeCamera.updateMatrixWorld(true);

  const previousToneMapping = renderer.toneMapping;
  renderer.toneMapping = NoToneMapping;
  cubeCamera.update(renderer, scene);
  renderer.toneMapping = previousToneMapping;

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromCubemap(cubeTarget.texture);
  pmrem.dispose();
  cubeTarget.dispose();

  return {
    target,
    position: [item.position[0], item.position[1], item.position[2]],
    radius: item.radius,
    intensity: item.intensity,
    priority: item.priority,
    resolution: item.resolution,
  };
}

/** Frees a baked probe's PMREM render target. */
export function disposeSphereReflectionCaptureBake(bake: SphereReflectionCaptureBake): void {
  bake.target.dispose();
}
