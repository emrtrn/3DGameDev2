import type { MetadataValue } from "./layout";

/**
 * Schema-driven gameplay metadata for the Details panel.
 *
 * The base editor stays game-agnostic: it reads this schema from the project,
 * renders a generic typed form, and writes values into a generic
 * `placement.metadata` blob. The actual fields are declared by the game/project.
 */

export type MetadataFieldType = "text" | "number" | "boolean" | "select" | "tags";

/** Selection kinds a metadata group can apply to. */
export type MetadataAppliesTo = "instance" | "character";

export interface MetadataFieldDef {
  /** Key written under `placement.metadata[key]`. */
  key: string;
  label: string;
  type: MetadataFieldType;
  /** Choices for `select` fields. */
  options?: string[];
  /** Suggested choices for `tags` fields (free-form entry still allowed). */
  suggestions?: string[];
  /** Numeric constraints for `number` fields. */
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** Default value; when the current value equals it, the key is omitted on save. */
  default?: MetadataValue;
}

export interface MetadataGroupDef {
  title: string;
  /** Only show this group for these selection kinds. Absent = all kinds. */
  appliesTo?: MetadataAppliesTo[];
  /** Only show this group for these asset categories. Absent = all categories. */
  categories?: string[];
  fields: MetadataFieldDef[];
}

export interface MetadataSchema {
  schema: 1;
  groups: MetadataGroupDef[];
}

export interface MetadataTarget {
  kind: MetadataAppliesTo | "light" | "actor";
  category: string;
}

/** Filters schema groups down to those that apply to the given selection. */
export function metadataGroupsForTarget(
  schema: MetadataSchema | null,
  target: MetadataTarget,
): MetadataGroupDef[] {
  if (!schema) return [];
  // Lights have no project metadata schema; actor instances carry their schema on
  // the class (`*.actor.json` variables), not per-instance, so neither maps here.
  if (target.kind === "light" || target.kind === "actor") return [];
  const kind: MetadataAppliesTo = target.kind;
  return schema.groups.filter((group) => {
    if (group.appliesTo && !group.appliesTo.includes(kind)) return false;
    if (group.categories && !group.categories.includes(target.category)) return false;
    return group.fields.length > 0;
  });
}

/** True when a value should be omitted from saved data (equals default / empty). */
export function isDefaultMetadataValue(
  field: MetadataFieldDef,
  value: MetadataValue | undefined,
): boolean {
  if (value === undefined) return true;
  if (field.default !== undefined && metadataValuesEqual(value, field.default)) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "number") return Number.isNaN(value);
  return false;
}

export function metadataValuesEqual(
  a: MetadataValue | undefined,
  b: MetadataValue | undefined,
): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = Array.isArray(a) ? a : [];
    const bb = Array.isArray(b) ? b : [];
    return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
  }
  return a === b;
}
