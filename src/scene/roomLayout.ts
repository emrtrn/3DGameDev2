export type {
  LayoutCharacter,
  LayoutLightActor,
  LayoutLightType,
  LayoutMetadata,
  LayoutModelInstances,
  LayoutPlacement,
  LayoutWorldSettings,
  MetadataValue,
  RoomLayout,
  Vec3,
} from "@engine/scene/layout";

export {
  degreesToRadians,
  readPivot,
  readRotation,
  readScale,
} from "@engine/scene/transform";

import type { RoomLayout } from "@engine/scene/layout";

const BASE_URL = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export async function loadRoomLayout(pathOrName: string): Promise<RoomLayout> {
  // A ".json" value is a public-relative path (served by Vite from public/);
  // a bare name resolves to the bundled layouts/ folder.
  const url = pathOrName.endsWith(".json")
    ? `/${pathOrName.replace(/\\/g, "/").replace(/^\/+/, "")}`
    : `${BASE_URL}layouts/${pathOrName}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Room layout failed: ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as RoomLayout;
}
