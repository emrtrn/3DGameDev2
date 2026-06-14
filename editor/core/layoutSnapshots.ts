import type {
  LayoutCharacter,
  LayoutLightActor,
  LayoutMetadata,
  LayoutPlacement,
  MetadataValue,
  Vec3,
} from "@engine/scene/layout";

export interface EditableTransformLike {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export function cloneMetadata(metadata: LayoutMetadata | undefined): LayoutMetadata {
  const clone: LayoutMetadata = {};
  if (!metadata) return clone;
  for (const [key, value] of Object.entries(metadata)) {
    clone[key] = cloneMetadataValue(value) as MetadataValue;
  }
  return clone;
}

export function cloneMetadataValue(
  value: MetadataValue | undefined,
): MetadataValue | undefined {
  return Array.isArray(value) ? [...value] : value;
}

export function cloneScale(scale: number | Vec3): number | Vec3 {
  return Array.isArray(scale) ? [scale[0], scale[1], scale[2]] : scale;
}

export function clonePlacement(placement: LayoutPlacement): LayoutPlacement {
  const clone: LayoutPlacement = {
    position: [...placement.position],
  };
  if (placement.name !== undefined) clone.name = placement.name;
  if (placement.hidden !== undefined) clone.hidden = placement.hidden;
  if (placement.locked !== undefined) clone.locked = placement.locked;
  if (placement.groupId !== undefined) clone.groupId = placement.groupId;
  if (placement.rotationYDeg !== undefined) clone.rotationYDeg = placement.rotationYDeg;
  if (placement.rotation !== undefined) clone.rotation = [...placement.rotation];
  if (placement.pivot !== undefined) clone.pivot = [...placement.pivot];
  if (placement.scale !== undefined) clone.scale = cloneScale(placement.scale);
  if (placement.scaleLocked !== undefined) clone.scaleLocked = placement.scaleLocked;
  if (placement.castShadow !== undefined) clone.castShadow = placement.castShadow;
  if (placement.collision !== undefined) clone.collision = placement.collision;
  if (placement.metadata !== undefined) clone.metadata = cloneMetadata(placement.metadata);
  if (placement.audio !== undefined) clone.audio = { ...placement.audio };
  if (placement.nodeId !== undefined) clone.nodeId = placement.nodeId;
  if (placement.parentId !== undefined) clone.parentId = placement.parentId;
  return clone;
}

export function cloneUngroupedPlacement(placement: LayoutPlacement): LayoutPlacement {
  const clone = clonePlacement(placement);
  delete clone.groupId;
  return clone;
}

export function cloneCharacter(character: LayoutCharacter): LayoutCharacter {
  const clone: LayoutCharacter = {
    assetId: character.assetId,
    position: [...character.position],
  };
  if (character.name !== undefined) clone.name = character.name;
  if (character.hidden !== undefined) clone.hidden = character.hidden;
  if (character.locked !== undefined) clone.locked = character.locked;
  if (character.groupId !== undefined) clone.groupId = character.groupId;
  if (character.rotationYDeg !== undefined) clone.rotationYDeg = character.rotationYDeg;
  if (character.rotation !== undefined) clone.rotation = [...character.rotation];
  if (character.pivot !== undefined) clone.pivot = [...character.pivot];
  if (character.scale !== undefined) clone.scale = cloneScale(character.scale);
  if (character.scaleLocked !== undefined) clone.scaleLocked = character.scaleLocked;
  if (character.castShadow !== undefined) clone.castShadow = character.castShadow;
  if (character.collision !== undefined) clone.collision = character.collision;
  if (character.metadata !== undefined) clone.metadata = cloneMetadata(character.metadata);
  if (character.audio !== undefined) clone.audio = { ...character.audio };
  if (character.nodeId !== undefined) clone.nodeId = character.nodeId;
  if (character.parentId !== undefined) clone.parentId = character.parentId;
  if (character.animation !== undefined) clone.animation = character.animation;
  return clone;
}

export function cloneUngroupedCharacter(character: LayoutCharacter): LayoutCharacter {
  const clone = cloneCharacter(character);
  delete clone.groupId;
  return clone;
}

export function cloneLightActor(light: LayoutLightActor): LayoutLightActor {
  const clone: LayoutLightActor = {
    id: light.id,
    type: light.type,
    position: [...light.position],
  };
  if (light.name !== undefined) clone.name = light.name;
  if (light.hidden !== undefined) clone.hidden = light.hidden;
  if (light.locked !== undefined) clone.locked = light.locked;
  if (light.scaleLocked !== undefined) clone.scaleLocked = light.scaleLocked;
  if (light.groupId !== undefined) clone.groupId = light.groupId;
  if (light.nodeId !== undefined) clone.nodeId = light.nodeId;
  if (light.parentId !== undefined) clone.parentId = light.parentId;
  if (light.rotation !== undefined) clone.rotation = [...light.rotation];
  if (light.color !== undefined) clone.color = light.color;
  if (light.intensity !== undefined) clone.intensity = light.intensity;
  if (light.castShadow !== undefined) clone.castShadow = light.castShadow;
  if (light.distance !== undefined) clone.distance = light.distance;
  if (light.angle !== undefined) clone.angle = light.angle;
  if (light.penumbra !== undefined) clone.penumbra = light.penumbra;
  if (light.decay !== undefined) clone.decay = light.decay;
  return clone;
}

export function cloneUngroupedLightActor(light: LayoutLightActor): LayoutLightActor {
  const clone = cloneLightActor(light);
  delete clone.groupId;
  return clone;
}

export function transformsEqual(
  left: EditableTransformLike,
  right: EditableTransformLike,
): boolean {
  return (
    vecEqual(left.position, right.position) &&
    vecEqual(left.rotation, right.rotation) &&
    vecEqual(left.scale, right.scale)
  );
}

export function vecEqual(left: Vec3, right: Vec3): boolean {
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

export function lightActorsEqual(left: LayoutLightActor, right: LayoutLightActor): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
