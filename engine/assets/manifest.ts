export interface AssetRecord {
  id: string;
  file: string;
  type: "model";
  category: string;
  loadGroup: string;
  source: {
    origin: string;
    pack?: string;
    packVersion?: string;
    url?: string;
  };
  license: string;
  bytes: number;
}

export interface AssetManifest {
  version: number;
  generated: string;
  ktx2: boolean;
  assets: AssetRecord[];
}

export type PlacementSurface = "floor" | "wall" | "room" | "character";

export interface AssetPlacementRules {
  surface: PlacementSurface;
  snapToWall: boolean;
  allowRotation: boolean;
  allowScale: boolean;
}

export interface AssetCatalogRecord {
  id: string;
  name: string;
  type: "model";
  category: string;
  model: string;
  preview?: string;
  placement: AssetPlacementRules;
  tags?: string[];
}

export interface AssetCatalog {
  schema: 1;
  assets: AssetCatalogRecord[];
}

export interface EditableAsset extends AssetRecord {
  displayName: string;
  catalogCategory: string;
  placement: AssetPlacementRules;
  tags: string[];
}

export function assetRecordById(
  manifest: AssetManifest,
  id: string,
): AssetRecord | null {
  return manifest.assets.find((asset) => asset.id === id) ?? null;
}

export function recordsForGroup(
  manifest: AssetManifest,
  loadGroup: string,
): AssetRecord[] {
  return manifest.assets.filter((asset) => asset.loadGroup === loadGroup);
}

export function totalBytesForGroups(
  manifest: AssetManifest,
  loadGroups: string[],
): number {
  const groupSet = new Set(loadGroups);
  return manifest.assets
    .filter((asset) => groupSet.has(asset.loadGroup))
    .reduce((total, asset) => total + asset.bytes, 0);
}

export function editableAssetsFromManifest(
  manifest: AssetManifest,
  catalog: AssetCatalog | null,
): EditableAsset[] {
  const catalogById = new Map(catalog?.assets.map((asset) => [asset.id, asset]));
  return manifest.assets
    .filter((asset) => asset.type === "model")
    .map((asset) => {
      const catalogAsset = catalogById.get(asset.id);
      return {
        ...asset,
        displayName: catalogAsset?.name ?? asset.id,
        catalogCategory: catalogAsset?.category ?? asset.category,
        placement:
          catalogAsset?.placement ?? defaultPlacementForCategory(asset.category),
        tags: catalogAsset?.tags ?? [],
      };
    });
}

export function defaultPlacementForCategory(
  category: string,
): AssetPlacementRules {
  if (category === "room-shell") {
    return {
      surface: "room",
      snapToWall: false,
      allowRotation: true,
      allowScale: false,
    };
  }
  if (category === "customer-character") {
    return {
      surface: "character",
      snapToWall: false,
      allowRotation: true,
      allowScale: true,
    };
  }
  return {
    surface: "floor",
    snapToWall: false,
    allowRotation: true,
    allowScale: true,
  };
}
