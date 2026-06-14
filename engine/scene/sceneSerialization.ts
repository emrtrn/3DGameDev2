import type { Entity, EntityComponentData, EntityComponentMap, SceneJsonValue } from "./entity";
import {
  SCENE_DOCUMENT_SCHEMA_VERSION,
  type SceneDocument,
  type SceneWorldSettings,
} from "./sceneDocument";

export interface SceneDocumentValidationResult {
  valid: boolean;
  errors: string[];
}

export function cloneSceneDocument(document: SceneDocument): SceneDocument {
  const clone: SceneDocument = {
    schema: SCENE_DOCUMENT_SCHEMA_VERSION,
    name: document.name,
    entities: document.entities.map(cloneEntity),
  };
  if (document.worldSettings) clone.worldSettings = cloneWorldSettings(document.worldSettings);
  return clone;
}

export function validateSceneDocument(value: unknown): SceneDocumentValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["scene document must be an object"] };
  }

  if (value.schema !== SCENE_DOCUMENT_SCHEMA_VERSION) {
    errors.push(`schema must be ${SCENE_DOCUMENT_SCHEMA_VERSION}`);
  }
  if (typeof value.name !== "string" || value.name.length === 0) {
    errors.push("name must be a non-empty string");
  }
  if (!Array.isArray(value.entities)) {
    errors.push("entities must be an array");
  } else {
    value.entities.forEach((entity, index) => validateEntity(entity, `entities[${index}]`, errors));
  }
  if (value.worldSettings !== undefined && !isRecord(value.worldSettings)) {
    errors.push("worldSettings must be an object when present");
  }

  return { valid: errors.length === 0, errors };
}

function cloneEntity(source: Entity): Entity {
  const entity: Entity = {
    id: source.id,
    components: cloneComponentMap(source.components),
  };
  if (source.name !== undefined) entity.name = source.name;
  if (source.tags !== undefined) entity.tags = [...source.tags];
  if (source.parentId !== undefined) entity.parentId = source.parentId;
  return entity;
}

function cloneComponentMap(source: EntityComponentMap): EntityComponentMap {
  const clone: EntityComponentMap = {};
  for (const [type, data] of Object.entries(source)) {
    clone[type] = cloneComponentData(data);
  }
  return clone;
}

function cloneComponentData(source: EntityComponentData): EntityComponentData {
  const clone: EntityComponentData = {};
  for (const [key, value] of Object.entries(source)) {
    clone[key] = cloneSceneJsonValue(value);
  }
  return clone;
}

function cloneSceneJsonValue(value: SceneJsonValue): SceneJsonValue {
  if (Array.isArray(value)) return value.map(cloneSceneJsonValue);
  if (isRecord(value)) {
    const clone: Record<string, SceneJsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      clone[key] = cloneSceneJsonValue(entry);
    }
    return clone;
  }
  return value;
}

function cloneWorldSettings(source: SceneWorldSettings): SceneWorldSettings {
  return { ...source };
}

function validateEntity(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    errors.push(`${path}.id must be a non-empty string`);
  }
  if (value.name !== undefined && typeof value.name !== "string") {
    errors.push(`${path}.name must be a string when present`);
  }
  if (value.parentId !== undefined && typeof value.parentId !== "string") {
    errors.push(`${path}.parentId must be a string when present`);
  }
  if (value.tags !== undefined && !isStringArray(value.tags)) {
    errors.push(`${path}.tags must be a string array when present`);
  }
  if (!isRecord(value.components)) {
    errors.push(`${path}.components must be an object`);
    return;
  }
  for (const [type, data] of Object.entries(value.components)) {
    if (!isRecord(data)) {
      errors.push(`${path}.components.${type} must be an object`);
      continue;
    }
    for (const [key, entry] of Object.entries(data)) {
      validateSceneJsonValue(entry, `${path}.components.${type}.${key}`, errors);
    }
  }
}

function validateSceneJsonValue(value: unknown, path: string, errors: string[]): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateSceneJsonValue(entry, `${path}[${index}]`, errors));
    return;
  }

  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      validateSceneJsonValue(entry, `${path}.${key}`, errors);
    }
    return;
  }

  errors.push(`${path} must be JSON-safe`);
}

function isRecord(value: unknown): value is Record<string, SceneJsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
