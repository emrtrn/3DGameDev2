import { Box3 } from "three";

import type { RoomLayout } from "@engine/scene/layout";
import { composePlacementMatrix } from "./transforms";

/** A world-aligned collider box plus whether its owner is a (non-blocking) sensor. */
export interface CollisionWirebox {
  box: Box3;
  sensor: boolean;
}

/**
 * World-aligned collider boxes for every collidable placement and character in a
 * layout: the data behind the editor's "Show > Collision" overlay.
 *
 * Mirrors the collider the adapter derives (the model's local bounds under the
 * placement's transform; see `colliderBoxFromBounds`) and the same `collision` /
 * `sensor` flags, so the overlay shows exactly what physics uses. Placements that
 * opted out with `collision: false` are skipped; an asset with no loaded bounds
 * is skipped (its box is unknown).
 *
 * Pure: takes the layout and a bounds lookup, returns boxes. No DOM, no scene
 * mutation: the host turns each box into a `Box3Helper`.
 */
export function collisionWireboxes(
  layout: RoomLayout,
  localBounds: ReadonlyMap<string, Box3>,
): CollisionWirebox[] {
  const boxes: CollisionWirebox[] = [];
  for (const instance of layout.instances) {
    const bounds = localBounds.get(instance.assetId);
    if (!bounds || bounds.isEmpty()) continue;
    for (const placement of instance.placements) {
      if (placement.collision === false) continue;
      boxes.push({
        box: bounds.clone().applyMatrix4(composePlacementMatrix(placement)),
        sensor: placement.sensor === true,
      });
    }
  }
  for (const character of layout.characters) {
    if (character.collision === false) continue;
    const bounds = localBounds.get(character.assetId);
    if (!bounds || bounds.isEmpty()) continue;
    boxes.push({
      box: bounds.clone().applyMatrix4(composePlacementMatrix(character)),
      sensor: character.sensor === true,
    });
  }
  return boxes;
}
