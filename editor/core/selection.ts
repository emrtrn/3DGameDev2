export type Selection =
  | { kind: "instance"; assetId: string; placementIndex: number }
  | { kind: "character"; index: number }
  | { kind: "light"; index: number };

export type InstanceSelection = Extract<Selection, { kind: "instance" }>;
export type CharacterSelection = Extract<Selection, { kind: "character" }>;
export type LightSelection = Extract<Selection, { kind: "light" }>;

export function selectionId(selection: Selection): string {
  if (selection.kind === "character") return `character:${selection.index}`;
  if (selection.kind === "light") return `light:${selection.index}`;
  return `instance:${encodeURIComponent(selection.assetId)}:${selection.placementIndex}`;
}

export function parseSelectionId(id: string): Selection | null {
  const [kind, encodedAssetId, rawIndex] = id.split(":");
  if (kind === "character") {
    const index = Number(encodedAssetId);
    return Number.isInteger(index) ? { kind: "character", index } : null;
  }
  if (kind === "light") {
    const index = Number(encodedAssetId);
    return Number.isInteger(index) ? { kind: "light", index } : null;
  }
  if (kind !== "instance" || rawIndex === undefined) return null;
  const placementIndex = Number(rawIndex);
  if (!Number.isInteger(placementIndex)) return null;
  return {
    kind: "instance",
    assetId: decodeURIComponent(encodedAssetId ?? ""),
    placementIndex,
  };
}

export function selectionsEqual(
  left: Selection | null,
  right: Selection | null,
): boolean {
  if (!left || !right || left.kind !== right.kind) return false;
  if (left.kind === "character" && right.kind === "character") {
    return left.index === right.index;
  }
  if (left.kind === "light" && right.kind === "light") {
    return left.index === right.index;
  }
  if (left.kind !== "instance" || right.kind !== "instance") return false;
  return left.assetId === right.assetId && left.placementIndex === right.placementIndex;
}

export function compareInstanceDeletes(
  left: { selection: Selection },
  right: { selection: Selection },
): number {
  if (left.selection.kind !== "instance" || right.selection.kind !== "instance") return 0;
  const assetSort = right.selection.assetId.localeCompare(left.selection.assetId);
  if (assetSort !== 0) return assetSort;
  return right.selection.placementIndex - left.selection.placementIndex;
}

export function compareInstanceRestores(
  left: { selection: Selection },
  right: { selection: Selection },
): number {
  if (left.selection.kind !== "instance" || right.selection.kind !== "instance") return 0;
  const assetSort = left.selection.assetId.localeCompare(right.selection.assetId);
  if (assetSort !== 0) return assetSort;
  return left.selection.placementIndex - right.selection.placementIndex;
}

export function compareCharacterDeletes(
  left: { selection: Selection },
  right: { selection: Selection },
): number {
  if (left.selection.kind !== "character" || right.selection.kind !== "character") return 0;
  return right.selection.index - left.selection.index;
}

export function compareCharacterRestores(
  left: { selection: Selection },
  right: { selection: Selection },
): number {
  if (left.selection.kind !== "character" || right.selection.kind !== "character") return 0;
  return left.selection.index - right.selection.index;
}

export function compareLightDeletes(
  left: { selection: Selection },
  right: { selection: Selection },
): number {
  if (left.selection.kind !== "light" || right.selection.kind !== "light") return 0;
  return right.selection.index - left.selection.index;
}

export function compareLightRestores(
  left: { selection: Selection },
  right: { selection: Selection },
): number {
  if (left.selection.kind !== "light" || right.selection.kind !== "light") return 0;
  return left.selection.index - right.selection.index;
}
