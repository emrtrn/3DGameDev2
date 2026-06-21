import { defaultLightIntensity } from "@engine/scene/lights";
import { resolveSkyAtmosphere } from "@engine/scene/skyAtmosphere";
import { resolveHeightFog } from "@engine/scene/heightFog";
import { resolveCloudLayer } from "@engine/scene/cloudLayer";
import { resolveReflectionPlane } from "@engine/scene/reflectionPlane";
import { resolveReflectiveSurface } from "@engine/scene/reflectiveSurface";
import { resolveSphereReflectionCapture } from "@engine/scene/reflectionCapture";
import { resolvePostProcess } from "@engine/scene/postProcess";
import { readPivot, readRotation, readScale } from "@engine/scene/transform";
import type {
  LayoutCloudLayer,
  LayoutHeightFog,
  LayoutLightActor,
  LayoutPostProcess,
  LayoutReflectionPlane,
  LayoutReflectiveSurface,
  LayoutSkyAtmosphere,
  LayoutSphereReflectionCapture,
  RoomLayout,
} from "@engine/scene/layout";

import {
  type EditableSceneObject,
  type EditableSelection,
} from "./editableScene";
import { cloneBehavior, cloneMetadata, cloneParticle, clonePhysics } from "./layoutSnapshots";
import { selectionId, type Selection } from "./selection";

const DEFAULT_LIGHT_COLOR = "#ffffff";

/** Stable Outliner/Details asset id shown for the singleton Sky Atmosphere. */
export const SKY_ATMOSPHERE_ASSET_ID = "sky-atmosphere";

/** Stable Outliner/Details asset id shown for the singleton Height Fog. */
export const HEIGHT_FOG_ASSET_ID = "height-fog";

/** Stable Outliner/Details asset id shown for the singleton Cloud Layer. */
export const CLOUD_LAYER_ASSET_ID = "cloud-layer";

/** Stable Outliner/Details asset id shown for the singleton Post Process actor. */
export const POST_PROCESS_ASSET_ID = "post-process";

/**
 * Builds the transform-less Details/Outliner view-model for the Sky Atmosphere
 * singleton. It has no position/scale, so transform fields are zeroed and the
 * resolved scattering settings ride along in {@link EditableSelection.sky}. The
 * sun direction is owned by the Sun light, not the sky.
 */
function buildSkyEditableSelection(sky: LayoutSkyAtmosphere): EditableSelection {
  const resolved = resolveSkyAtmosphere(sky);
  return {
    id: "sky",
    kind: "sky",
    assetId: SKY_ATMOSPHERE_ASSET_ID,
    category: "visual-effects",
    label: resolved.name,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    pivot: [0, 0, 0],
    scaleLocked: true,
    locked: false,
    castShadow: false,
    collision: false,
    simulatePhysics: false,
    physics: {},
    sky: { ...resolved },
    metadata: {},
  };
}

/**
 * Builds the transform-less Details/Outliner view-model for the Height Fog
 * singleton. Like the sky it has no position/scale, so transform fields are
 * zeroed and the resolved fog settings ride along in {@link EditableSelection.fog}.
 */
function buildFogEditableSelection(fog: LayoutHeightFog): EditableSelection {
  const resolved = resolveHeightFog(fog);
  return {
    id: "fog",
    kind: "fog",
    assetId: HEIGHT_FOG_ASSET_ID,
    category: "visual-effects",
    label: resolved.name,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    pivot: [0, 0, 0],
    scaleLocked: true,
    locked: false,
    castShadow: false,
    collision: false,
    simulatePhysics: false,
    physics: {},
    fog: { ...resolved },
    metadata: {},
  };
}

/**
 * Builds the transform-less Details/Outliner view-model for the static Cloud
 * Layer singleton. Like the sky/fog it has no position/scale, so transform fields
 * are zeroed and the resolved cloud settings ride along in
 * {@link EditableSelection.cloud}.
 */
function buildCloudEditableSelection(cloud: LayoutCloudLayer): EditableSelection {
  const resolved = resolveCloudLayer(cloud);
  return {
    id: "cloud",
    kind: "cloud",
    assetId: CLOUD_LAYER_ASSET_ID,
    category: "visual-effects",
    label: resolved.name,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    pivot: [0, 0, 0],
    scaleLocked: true,
    locked: false,
    castShadow: false,
    collision: false,
    simulatePhysics: false,
    physics: {},
    cloud: { ...resolved },
    metadata: {},
  };
}

/** Builds the transform-less Details/Outliner view-model for Post Process. */
function buildPostEditableSelection(post: LayoutPostProcess): EditableSelection {
  const resolved = resolvePostProcess(post);
  return {
    id: "post",
    kind: "post",
    assetId: POST_PROCESS_ASSET_ID,
    category: "visual-effects",
    label: resolved.name,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    pivot: [0, 0, 0],
    scaleLocked: true,
    locked: false,
    castShadow: false,
    collision: false,
    simulatePhysics: false,
    physics: {},
    post: { ...resolved },
    metadata: {},
  };
}

/**
 * Builds the Details/Outliner view-model for a placed Planar Reflection (mirror)
 * actor. Unlike the environment singletons it carries a real transform; the
 * mirror tint rides along in `color` and the texture resolution in
 * `reflectionResolution`.
 */
function buildReflectionPlaneEditableSelection(
  plane: LayoutReflectionPlane,
  index: number,
): EditableSelection {
  const resolved = resolveReflectionPlane(plane);
  return {
    id: selectionId({ kind: "reflectionPlane", index }),
    kind: "reflectionPlane",
    assetId: "reflection-plane",
    category: "reflection",
    label: resolved.name,
    position: [...plane.position],
    rotation: readRotation(plane),
    scale: readScale(plane),
    pivot: [0, 0, 0],
    scaleLocked: plane.scaleLocked ?? false,
    locked: plane.locked ?? false,
    castShadow: false,
    collision: false,
    simulatePhysics: false,
    physics: {},
    color: resolved.color,
    reflectionResolution: resolved.resolution,
    metadata: {},
  };
}

/**
 * Builds the Details/Outliner view-model for a placed Reflective Surface actor.
 * Like the Planar Reflection it carries a real transform; the material reference +
 * reflection-blend settings ride along in {@link EditableSelection.reflectiveSurface}.
 */
function buildReflectiveSurfaceEditableSelection(
  surface: LayoutReflectiveSurface,
  index: number,
): EditableSelection {
  const resolved = resolveReflectiveSurface(surface);
  return {
    id: selectionId({ kind: "reflectiveSurface", index }),
    kind: "reflectiveSurface",
    assetId: "reflective-surface",
    category: "reflection",
    label: resolved.name,
    position: [...surface.position],
    rotation: readRotation(surface),
    scale: readScale(surface),
    pivot: [0, 0, 0],
    scaleLocked: surface.scaleLocked ?? false,
    locked: surface.locked ?? false,
    castShadow: false,
    collision: false,
    simulatePhysics: false,
    physics: {},
    reflectiveSurface: { ...resolved },
    metadata: {},
  };
}

/**
 * Builds the Details/Outliner view-model for a placed Sphere Reflection Capture
 * (probe) actor. Like the Planar Reflection it carries a real transform (position
 * only — there is no meaningful scale); the probe settings ride along in
 * {@link EditableSelection.reflectionCapture}.
 */
function buildReflectionCaptureEditableSelection(
  capture: LayoutSphereReflectionCapture,
  index: number,
): EditableSelection {
  const resolved = resolveSphereReflectionCapture(capture);
  return {
    id: selectionId({ kind: "reflectionCapture", index }),
    kind: "reflectionCapture",
    assetId: "reflection-capture",
    category: "reflection",
    label: resolved.name,
    position: [...capture.position],
    rotation: readRotation(capture),
    scale: [1, 1, 1],
    pivot: [0, 0, 0],
    scaleLocked: true,
    locked: capture.locked ?? false,
    castShadow: false,
    collision: false,
    simulatePhysics: false,
    physics: {},
    reflectionCapture: { ...resolved },
    metadata: {},
  };
}

/** Shared inputs the editable view-models need that aren't on the layout. */
export interface SceneObjectDeps {
  /** Resolves an asset's manifest category for Details display. */
  assetCategory: (assetId: string) => string;
  /** Resolved world-settings flag applied to all static instances. */
  staticObjectsCastShadow: boolean;
}

/**
 * Builds the Outliner row view-models for every object in the layout. Pure
 * transform from layout data → `EditableSceneObject[]`; `metadata` is left empty
 * here (the Details panel reads full metadata via {@link buildEditableSelection}).
 */
export function buildSceneObjects(
  layout: RoomLayout,
  deps: SceneObjectDeps & { isSelected: (selection: Selection) => boolean },
): EditableSceneObject[] {
  const objects: EditableSceneObject[] = [];

  for (const instance of layout.instances) {
    instance.placements.forEach((placement, placementIndex) => {
      const selection: Selection = {
        kind: "instance",
        assetId: instance.assetId,
        placementIndex,
      };
      objects.push({
        id: selectionId(selection),
        kind: "instance",
        assetId: instance.assetId,
        category: deps.assetCategory(instance.assetId),
        label: placement.name ?? `${instance.assetId} #${placementIndex + 1}`,
        position: [...placement.position],
        rotation: readRotation(placement),
        scale: readScale(placement),
        pivot: readPivot(placement),
        scaleLocked: placement.scaleLocked ?? false,
        selected: deps.isSelected(selection),
        hidden: placement.hidden ?? false,
        locked: placement.locked ?? false,
        castShadow: deps.staticObjectsCastShadow,
        collision: placement.collision ?? true,
        ...(placement.collisionPreset ? { collisionPreset: placement.collisionPreset } : {}),
        ...(placement.materialSlot ? { materialSlot: placement.materialSlot } : {}),
        simulatePhysics: placement.simulatePhysics ?? false,
        physics: clonePhysics(placement.physics) ?? {},
        metadata: {},
        groupId: placement.groupId,
        nodeId: placement.nodeId,
        parentId: placement.parentId,
      });
    });
  }

  layout.characters.forEach((character, index) => {
    const selection: Selection = { kind: "character", index };
    objects.push({
      id: selectionId(selection),
      kind: "character",
      assetId: character.assetId,
      category: deps.assetCategory(character.assetId),
      label: character.name ?? `${character.assetId} #${index + 1}`,
      position: [...character.position],
      rotation: readRotation(character),
      scale: readScale(character),
      pivot: readPivot(character),
      scaleLocked: character.scaleLocked ?? false,
      selected: deps.isSelected(selection),
      hidden: character.hidden ?? false,
      locked: character.locked ?? false,
      castShadow: character.castShadow ?? true,
      collision: character.collision ?? true,
      ...(character.collisionPreset ? { collisionPreset: character.collisionPreset } : {}),
      simulatePhysics: character.simulatePhysics ?? false,
      physics: clonePhysics(character.physics) ?? {},
      metadata: {},
      groupId: character.groupId,
      nodeId: character.nodeId,
      parentId: character.parentId,
    });
  });

  layout.lights?.forEach((light, index) => {
    const selection: Selection = { kind: "light", index };
    const sceneObject: EditableSceneObject = {
      id: selectionId(selection),
      kind: "light",
      assetId: light.type,
      category: "light",
      label: light.name ?? light.id,
      position: [...light.position],
      rotation: readRotation(light),
      scale: [1, 1, 1],
      pivot: [0, 0, 0],
      scaleLocked: true,
      selected: deps.isSelected(selection),
      hidden: light.hidden ?? false,
      locked: light.locked ?? false,
      castShadow: light.castShadow ?? light.type === "directional",
      collision: false,
      simulatePhysics: false,
      physics: {},
      metadata: {},
      groupId: light.groupId,
      nodeId: light.nodeId,
      parentId: light.parentId,
      lightType: light.type,
      color: light.color ?? DEFAULT_LIGHT_COLOR,
      intensity: light.intensity ?? defaultLightIntensity(light.type),
    };
    applyOptionalLightFields(sceneObject, light);
    objects.push(sceneObject);
  });

  if (layout.skyAtmosphere) {
    const selection: Selection = { kind: "sky" };
    objects.push({
      ...buildSkyEditableSelection(layout.skyAtmosphere),
      selected: deps.isSelected(selection),
      hidden: layout.skyAtmosphere.hidden ?? false,
      locked: false,
    });
  }

  if (layout.heightFog) {
    const selection: Selection = { kind: "fog" };
    objects.push({
      ...buildFogEditableSelection(layout.heightFog),
      selected: deps.isSelected(selection),
      hidden: layout.heightFog.hidden ?? false,
      locked: false,
    });
  }

  if (layout.cloudLayer) {
    const selection: Selection = { kind: "cloud" };
    objects.push({
      ...buildCloudEditableSelection(layout.cloudLayer),
      selected: deps.isSelected(selection),
      hidden: layout.cloudLayer.hidden ?? false,
      locked: false,
    });
  }

  if (layout.postProcess) {
    const selection: Selection = { kind: "post" };
    objects.push({
      ...buildPostEditableSelection(layout.postProcess),
      selected: deps.isSelected(selection),
      hidden: layout.postProcess.hidden ?? false,
      locked: false,
    });
  }

  layout.actors?.forEach((actor, index) => {
    const selection: Selection = { kind: "actor", index };
    objects.push({
      id: selectionId(selection),
      kind: "actor",
      assetId: actor.classRef,
      category: "actor",
      label: actor.name ?? actorClassName(actor.classRef),
      position: [...actor.position],
      rotation: readRotation(actor),
      scale: readScale(actor),
      pivot: [0, 0, 0],
      scaleLocked: actor.scaleLocked ?? false,
      selected: deps.isSelected(selection),
      hidden: actor.hidden ?? false,
      locked: actor.locked ?? false,
      castShadow: true,
      collision: true,
      simulatePhysics: false,
      physics: {},
      metadata: {},
      groupId: actor.groupId,
      nodeId: actor.nodeId,
      parentId: actor.parentId,
    });
  });

  layout.reflectionPlanes?.forEach((plane, index) => {
    const selection: Selection = { kind: "reflectionPlane", index };
    objects.push({
      ...buildReflectionPlaneEditableSelection(plane, index),
      selected: deps.isSelected(selection),
      hidden: plane.hidden ?? false,
      locked: plane.locked ?? false,
      groupId: plane.groupId,
      nodeId: plane.nodeId,
      parentId: plane.parentId,
    });
  });

  layout.reflectiveSurfaces?.forEach((surface, index) => {
    const selection: Selection = { kind: "reflectiveSurface", index };
    objects.push({
      ...buildReflectiveSurfaceEditableSelection(surface, index),
      selected: deps.isSelected(selection),
      hidden: surface.hidden ?? false,
      locked: surface.locked ?? false,
      groupId: surface.groupId,
      nodeId: surface.nodeId,
      parentId: surface.parentId,
    });
  });

  layout.reflectionCaptures?.forEach((capture, index) => {
    const selection: Selection = { kind: "reflectionCapture", index };
    objects.push({
      ...buildReflectionCaptureEditableSelection(capture, index),
      selected: deps.isSelected(selection),
      hidden: capture.hidden ?? false,
      locked: capture.locked ?? false,
      groupId: capture.groupId,
      nodeId: capture.nodeId,
      parentId: capture.parentId,
    });
  });

  return objects;
}

/** Display name for an actor class instance: its placement name or the class file basename. */
export function actorClassName(classRef: string): string {
  const base = classRef.split("/").pop() ?? classRef;
  return base.replace(/\.actor\.json$/i, "");
}

/**
 * Builds the Details-panel view-model for a single selection. Unlike
 * {@link buildSceneObjects} it carries the object's real (cloned) metadata and
 * omits Outliner-only tree/selection fields. Returns null if the selection no
 * longer resolves in the layout.
 */
export function buildEditableSelection(
  layout: RoomLayout,
  selection: Selection,
  deps: SceneObjectDeps,
): EditableSelection | null {
  if (selection.kind === "instance") {
    const instance = layout.instances.find((entry) => entry.assetId === selection.assetId);
    const placement = instance?.placements[selection.placementIndex];
    if (!placement) return null;
    return {
      id: selectionId(selection),
      kind: "instance",
      assetId: selection.assetId,
      category: deps.assetCategory(selection.assetId),
      label: placement.name ?? `${selection.assetId} #${selection.placementIndex + 1}`,
      position: [...placement.position],
      rotation: readRotation(placement),
      scale: readScale(placement),
      pivot: readPivot(placement),
      scaleLocked: placement.scaleLocked ?? false,
      locked: placement.locked ?? false,
      castShadow: deps.staticObjectsCastShadow,
      collision: placement.collision ?? true,
      ...(placement.collisionPreset ? { collisionPreset: placement.collisionPreset } : {}),
      ...(placement.materialSlot ? { materialSlot: placement.materialSlot } : {}),
      simulatePhysics: placement.simulatePhysics ?? false,
      physics: clonePhysics(placement.physics) ?? {},
      metadata: cloneMetadata(placement.metadata),
      ...(placement.audio ? { audio: { ...placement.audio } } : {}),
      ...(placement.behavior ? { behavior: cloneBehavior(placement.behavior) } : {}),
      ...(placement.particle ? { particle: cloneParticle(placement.particle) } : {}),
      ...(placement.interaction ? { interaction: { ...placement.interaction } } : {}),
    };
  }

  if (selection.kind === "light") {
    const light = layout.lights?.[selection.index];
    if (!light) return null;
    const editable: EditableSelection = {
      id: selectionId(selection),
      kind: "light",
      assetId: light.type,
      category: "light",
      label: light.name ?? light.id,
      position: [...light.position],
      rotation: readRotation(light),
      scale: [1, 1, 1],
      pivot: [0, 0, 0],
      scaleLocked: true,
      locked: light.locked ?? false,
      castShadow: light.castShadow ?? light.type === "directional",
      collision: false,
      simulatePhysics: false,
      physics: {},
      metadata: {},
      lightType: light.type,
      color: light.color ?? DEFAULT_LIGHT_COLOR,
      intensity: light.intensity ?? defaultLightIntensity(light.type),
    };
    applyOptionalLightFields(editable, light);
    return editable;
  }

  if (selection.kind === "sky") {
    if (!layout.skyAtmosphere) return null;
    return buildSkyEditableSelection(layout.skyAtmosphere);
  }

  if (selection.kind === "fog") {
    if (!layout.heightFog) return null;
    return buildFogEditableSelection(layout.heightFog);
  }

  if (selection.kind === "cloud") {
    if (!layout.cloudLayer) return null;
    return buildCloudEditableSelection(layout.cloudLayer);
  }

  if (selection.kind === "post") {
    if (!layout.postProcess) return null;
    return buildPostEditableSelection(layout.postProcess);
  }

  if (selection.kind === "reflectionPlane") {
    const plane = layout.reflectionPlanes?.[selection.index];
    if (!plane) return null;
    return buildReflectionPlaneEditableSelection(plane, selection.index);
  }

  if (selection.kind === "reflectiveSurface") {
    const surface = layout.reflectiveSurfaces?.[selection.index];
    if (!surface) return null;
    return buildReflectiveSurfaceEditableSelection(surface, selection.index);
  }

  if (selection.kind === "reflectionCapture") {
    const capture = layout.reflectionCaptures?.[selection.index];
    if (!capture) return null;
    return buildReflectionCaptureEditableSelection(capture, selection.index);
  }

  if (selection.kind === "actor") {
    const actor = layout.actors?.[selection.index];
    if (!actor) return null;
    return {
      id: selectionId(selection),
      kind: "actor",
      assetId: actor.classRef,
      category: "actor",
      label: actor.name ?? actorClassName(actor.classRef),
      position: [...actor.position],
      rotation: readRotation(actor),
      scale: readScale(actor),
      pivot: [0, 0, 0],
      scaleLocked: actor.scaleLocked ?? false,
      locked: actor.locked ?? false,
      castShadow: true,
      collision: true,
      simulatePhysics: false,
      physics: {},
      metadata: {},
    };
  }

  const character = layout.characters[selection.index];
  if (!character) return null;
  return {
    id: selectionId(selection),
    kind: "character",
    assetId: character.assetId,
    category: deps.assetCategory(character.assetId),
    label: character.name ?? character.assetId,
    position: [...character.position],
    rotation: readRotation(character),
    scale: readScale(character),
    pivot: readPivot(character),
    scaleLocked: character.scaleLocked ?? false,
    locked: character.locked ?? false,
    castShadow: character.castShadow ?? true,
    collision: character.collision ?? true,
    ...(character.collisionPreset ? { collisionPreset: character.collisionPreset } : {}),
    simulatePhysics: character.simulatePhysics ?? false,
    physics: clonePhysics(character.physics) ?? {},
    metadata: cloneMetadata(character.metadata),
    ...(character.audio ? { audio: { ...character.audio } } : {}),
    ...(character.behavior ? { behavior: cloneBehavior(character.behavior) } : {}),
    ...(character.particle ? { particle: cloneParticle(character.particle) } : {}),
    ...(character.interaction ? { interaction: { ...character.interaction } } : {}),
  };
}

/** Copies the optional point/spot-light fields onto a view-model when set. */
function applyOptionalLightFields(
  target: { distance?: number; angle?: number; penumbra?: number; decay?: number },
  light: LayoutLightActor,
): void {
  if (light.distance !== undefined) target.distance = light.distance;
  if (light.angle !== undefined) target.angle = light.angle;
  if (light.penumbra !== undefined) target.penumbra = light.penumbra;
  if (light.decay !== undefined) target.decay = light.decay;
}
