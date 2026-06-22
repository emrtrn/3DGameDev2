import { Group, InstancedMesh, Matrix4, Object3D } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { Entity } from "@engine/scene/entity";
import { readMeshRendererComponent, readTransformComponent } from "@engine/scene/components";
import type { LayoutCharacter, LayoutPlacement, Vec3 } from "@engine/scene/layout";
import { readRotation, readScale } from "@engine/scene/transform";
import { isRenderableMesh } from "./materials";
import { applyEulerDegrees, composePlacementMatrix, composeTransformMatrix } from "./transforms";

const HIDDEN_INSTANCE_MATRIX = new Matrix4().makeScale(0, 0, 0);

export interface InstancedModelGroup {
  group: Group;
  meshes: InstancedMesh[];
}

/** Normalized per-placement render input, decoupled from the layout format. */
export interface InstanceRenderItem {
  matrix: Matrix4;
  hidden: boolean;
}

/** Legacy builder: derives render items straight from layout placements. */
export function placementInstanceItems(placements: LayoutPlacement[]): InstanceRenderItem[] {
  return placements.map((placement) => ({
    matrix: composePlacementMatrix(placement),
    hidden: placement.hidden ?? false,
  }));
}

/**
 * Entity-driven builder: derives render items from scene entities' transform
 * components and the `hidden` tag. Produces matrices identical to
 * `placementInstanceItems` because both compose through `composeTransformMatrix`.
 */
export function entityInstanceItems(entities: Entity[]): InstanceRenderItem[] {
  return entities.map((entity) => {
    const transform = readTransformComponent(entity);
    const matrix = transform
      ? composeTransformMatrix(transform.position, transform.rotation, transform.scale)
      : new Matrix4();
    return { matrix, hidden: entity.tags?.includes("hidden") ?? false };
  });
}

export interface CreateInstancedModelGroupOptions {
  assetId: string;
  gltf: GLTF;
  items: InstanceRenderItem[];
  castShadow: boolean;
  receiveShadow: boolean;
}

export function createInstancedModelGroup(
  options: CreateInstancedModelGroupOptions,
): InstancedModelGroup {
  const { assetId, gltf, items, castShadow, receiveShadow } = options;
  const group = new Group();
  const meshes: InstancedMesh[] = [];
  group.name = `instanced-${assetId}`;

  gltf.scene.updateMatrixWorld(true);

  gltf.scene.traverse((object) => {
    if (!isRenderableMesh(object)) return;

    const instanced = new InstancedMesh(object.geometry, object.material, items.length);
    instanced.name = `${assetId}-${object.name || "mesh"}`;
    instanced.frustumCulled = false;
    instanced.castShadow = castShadow;
    instanced.receiveShadow = receiveShadow;
    instanced.userData.assetId = assetId;
    instanced.userData.sourceMatrix = object.matrixWorld.clone();

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item) continue;
      if (item.hidden) {
        instanced.setMatrixAt(index, HIDDEN_INSTANCE_MATRIX);
        continue;
      }
      const matrix = item.matrix.clone().multiply(object.matrixWorld);
      instanced.setMatrixAt(index, matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    group.add(instanced);
    meshes.push(instanced);
  });

  return { group, meshes };
}

/** Normalized character render input, decoupled from the layout format. */
export interface CharacterRenderItem {
  name: string;
  position: Vec3;
  /** XYZ-order Euler rotation in degrees. */
  rotation: Vec3;
  scale: Vec3;
  hidden: boolean;
  castShadow: boolean;
}

/** Legacy builder: derives a character render item straight from a placement. */
export function placementCharacterItem(placement: LayoutCharacter): CharacterRenderItem {
  return {
    name: placement.name ?? placement.assetId,
    position: [placement.position[0], placement.position[1], placement.position[2]],
    rotation: readRotation(placement),
    scale: readScale(placement),
    hidden: placement.hidden ?? false,
    castShadow: placement.castShadow ?? true,
  };
}

/**
 * Entity-driven builder: derives a character render item from a scene entity's
 * transform/mesh-renderer components and the `hidden` tag. Produces the same
 * inputs as `placementCharacterItem` because the adapter fills those components
 * via the same readRotation/readScale transform read.
 */
export function entityCharacterItem(entity: Entity): CharacterRenderItem {
  const transform = readTransformComponent(entity);
  const renderer = readMeshRendererComponent(entity);
  // The placement Transform positions the actor in the world; the MeshRenderer's
  // local scale (authored on the class node) shrinks/grows the visual on top of
  // it, so a "small character" class renders small wherever it is placed/spawned.
  const placementScale: Vec3 = transform ? transform.scale : [1, 1, 1];
  const meshScale: Vec3 = renderer?.scale ?? [1, 1, 1];
  return {
    name: entity.name ?? renderer?.assetId ?? "character",
    position: transform ? [...transform.position] : [0, 0, 0],
    rotation: transform ? [...transform.rotation] : [0, 0, 0],
    scale: [
      placementScale[0] * meshScale[0],
      placementScale[1] * meshScale[1],
      placementScale[2] * meshScale[2],
    ],
    hidden: entity.tags?.includes("hidden") ?? false,
    castShadow: renderer?.castShadow ?? true,
  };
}

export function createCharacterSceneObject(
  gltf: GLTF,
  item: CharacterRenderItem,
): Object3D {
  const character = gltf.scene.clone();
  character.name = item.name;
  character.position.set(...item.position);
  applyEulerDegrees(character, item.rotation);
  character.scale.set(...item.scale);
  character.visible = !item.hidden;

  character.traverse((object) => {
    if (!isRenderableMesh(object)) return;
    object.castShadow = item.castShadow;
    object.receiveShadow = true;
  });

  return character;
}
