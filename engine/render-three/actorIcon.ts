import { CanvasTexture, Sprite, SpriteMaterial } from "three";

/**
 * Shared Unreal-style billboard icon factory for placed editor actors that have
 * no natural pickable mesh of their own (mirror planes, reflection-capture
 * probes, …). Each icon is a camera-facing {@link Sprite} painted from a cached
 * canvas glyph and drawn on top of geometry (depth test off), so it reads like
 * Unreal's component billboards and stays clickable even when buried in the
 * scene. Textures + materials are cached by `key` so every actor of a kind shares
 * one GPU texture/material; the canvas is only touched the first time a `key` is
 * requested, keeping this module import-safe in non-DOM contexts.
 */

/** Paints a 64×64 actor-icon glyph onto the supplied 2D context. */
export type ActorIconGlyph = (ctx: CanvasRenderingContext2D, size: number) => void;

const iconTextures = new Map<string, CanvasTexture>();
const iconMaterials = new Map<string, SpriteMaterial>();

/** Glyph canvas resolution (square). */
const ICON_CANVAS_SIZE = 64;

function actorIconTexture(key: string, draw: ActorIconGlyph): CanvasTexture {
  const cached = iconTextures.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = ICON_CANVAS_SIZE;
  canvas.height = ICON_CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, ICON_CANVAS_SIZE);
  const texture = new CanvasTexture(canvas);
  iconTextures.set(key, texture);
  return texture;
}

function actorIconMaterial(key: string, draw: ActorIconGlyph): SpriteMaterial {
  const cached = iconMaterials.get(key);
  if (cached) return cached;
  const material = new SpriteMaterial({
    map: actorIconTexture(key, draw),
    transparent: true,
    // Always visible (like Unreal's editor billboards), even behind geometry.
    depthTest: false,
    depthWrite: false,
  });
  iconMaterials.set(key, material);
  return material;
}

/**
 * Builds a billboard icon sprite for the cached glyph `key`. The sprite is named
 * `actor-icon`; the caller positions it, tags it for picking, and adds it to the
 * scene. All sprites sharing a `key` share one cached material/texture.
 */
export function createActorBillboardIcon(
  key: string,
  draw: ActorIconGlyph,
  scale = 0.5,
): Sprite {
  const sprite = new Sprite(actorIconMaterial(key, draw));
  sprite.scale.setScalar(scale);
  sprite.name = "actor-icon";
  return sprite;
}
