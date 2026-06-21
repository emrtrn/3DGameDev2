import { Color, PlaneGeometry, type ShaderMaterial, type Sprite } from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

import type { Vec3 } from "@engine/scene/layout";
import type { ResolvedReflectionPlane } from "@engine/scene/reflectionPlane";
import { createActorBillboardIcon } from "./actorIcon";

export {
  resolveReflectionPlane,
  REFLECTION_PLANE_DEFAULTS,
  uniqueReflectionPlaneId,
  uniqueReflectionPlaneName,
  type ResolvedReflectionPlane,
} from "@engine/scene/reflectionPlane";

/**
 * Planar Reflection render binding — the web/three counterpart to Unreal's Planar
 * Reflection, built on three.js's {@link Reflector}. The reflector is a unit
 * `PlaneGeometry` mesh whose reflective surface faces local **+Z**; the actor's
 * transform (position/rotation/scale) orients and sizes it. `Reflector` updates
 * itself via its own `onBeforeRender` hook (it renders the scene from a mirrored
 * camera into its texture), so the render loop never has to drive it.
 *
 * Resolution is baked into the render target at construction, so a resolution
 * change requires rebuilding the object; color is a live shader uniform.
 */

/** The three.js object backing a Planar Reflection actor. */
export type ReflectionPlaneObject = Reflector;

/** Resolved settings + world transform the binding needs to build/sync a plane. */
export interface ReflectionPlaneRenderItem extends ResolvedReflectionPlane {
  position: Vec3;
  /** XYZ-order Euler rotation in degrees. */
  rotation: Vec3;
  /** Per-axis scale (z is unused by the flat plane but kept for the gizmo). */
  scale: Vec3;
}

/** Builds a reflector mesh; resolution/color are fixed here, transform via {@link applyReflectionPlaneTransform}. */
export function createReflectionPlaneObject(item: ReflectionPlaneRenderItem): ReflectionPlaneObject {
  const reflector = new Reflector(new PlaneGeometry(1, 1), {
    color: new Color(item.color),
    textureWidth: item.resolution,
    textureHeight: item.resolution,
    clipBias: 0.003,
  });
  reflector.name = item.name;
  applyReflectionPlaneTransform(reflector, item);
  return reflector;
}

/** Pushes the transform + visibility + (live) color onto an existing reflector. */
export function applyReflectionPlaneTransform(
  reflector: ReflectionPlaneObject,
  item: ReflectionPlaneRenderItem,
): void {
  reflector.position.set(item.position[0], item.position[1], item.position[2]);
  reflector.rotation.set(
    (item.rotation[0] * Math.PI) / 180,
    (item.rotation[1] * Math.PI) / 180,
    (item.rotation[2] * Math.PI) / 180,
    "XYZ",
  );
  reflector.scale.set(item.scale[0], item.scale[1], item.scale[2] || 1);
  reflector.visible = !item.hidden;
  const material = reflector.material as ShaderMaterial;
  (material.uniforms.color!.value as Color).set(item.color);
}

/** Frees the reflector's render target, material, and geometry. */
export function disposeReflectionPlaneObject(reflector: ReflectionPlaneObject): void {
  reflector.geometry.dispose();
  reflector.dispose();
}

/**
 * Unreal-style billboard icon marking a Mirror Plane actor's center: a small
 * camera-facing sprite drawn over the scene so the (otherwise flat) mirror is
 * easy to spot and click in the viewport, like the editor's light-actor icons.
 * The mirror surface stays independently pickable; this is an additional handle.
 */
export function createReflectionPlaneIcon(): Sprite {
  return createActorBillboardIcon("reflection-plane", drawMirrorGlyph);
}

/** Paints a framed mirror panel with diagonal shine streaks. */
function drawMirrorGlyph(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.clearRect(0, 0, size, size);
  ctx.lineJoin = "round";

  // Mirror panel (rounded rect, cool reflective tint).
  const x = 16;
  const y = 11;
  const w = 32;
  const h = 42;
  const r = 6;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = "#bcd8ec";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(20,32,42,0.92)";
  ctx.stroke();

  // Diagonal shine streaks.
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + h - 10);
  ctx.lineTo(x + w - 9, y + 6);
  ctx.moveTo(x + 13, y + h - 6);
  ctx.lineTo(x + w - 5, y + 14);
  ctx.stroke();
}
