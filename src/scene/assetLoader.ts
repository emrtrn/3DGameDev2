import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  projectFileUrl,
  projectPublicFileUrl,
  type ProjectManifest,
} from "@/project/ProjectSystem";
import {
  assetRecordById,
  editableAssetsFromManifest,
  recordsForGroup,
  totalBytesForGroups,
} from "@engine/assets/manifest";
import type {
  AssetCatalog,
  AssetManifest,
  AssetRecord,
  EditableAsset,
} from "@engine/assets/manifest";
import type { MetadataSchema } from "@engine/scene/metadataSchema";
import { GltfModelLoader } from "@engine/render-three/gltfModelLoader";

export type {
  AssetCatalog,
  AssetCatalogRecord,
  AssetManifest,
  AssetPlacementRules,
  AssetRecord,
  EditableAsset,
  PlacementSurface,
} from "@engine/assets/manifest";

export class AssetLoader {
  private manifestPromise: Promise<AssetManifest> | null = null;
  private catalogPromise: Promise<AssetCatalog | null> | null = null;
  private metadataSchemaPromise: Promise<MetadataSchema | null> | null = null;
  private readonly modelLoader = new GltfModelLoader();

  constructor(private readonly project: ProjectManifest) {}

  loadManifest(): Promise<AssetManifest> {
    this.manifestPromise ??= fetch(projectFileUrl(this.project.editor.assetManifest)).then(
      async (response) => {
        if (!response.ok) {
          throw new Error(
            `Asset manifest failed: ${response.status} ${response.statusText}`,
          );
        }
        return (await response.json()) as AssetManifest;
      },
    );
    return this.manifestPromise;
  }

  loadCatalog(): Promise<AssetCatalog | null> {
    const catalogPath = this.project.editor.assetCatalog;
    if (!catalogPath) return Promise.resolve(null);
    this.catalogPromise ??= fetch(projectFileUrl(catalogPath)).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Asset catalog failed: ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as AssetCatalog;
    });
    return this.catalogPromise;
  }

  loadMetadataSchema(): Promise<MetadataSchema | null> {
    const schemaPath = this.project.editor.metadataSchema;
    if (!schemaPath) return Promise.resolve(null);
    this.metadataSchemaPromise ??= fetch(projectFileUrl(schemaPath)).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Metadata schema failed: ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as MetadataSchema;
    });
    return this.metadataSchemaPromise;
  }

  async loadEditableAssets(): Promise<EditableAsset[]> {
    const [manifest, catalog] = await Promise.all([
      this.loadManifest(),
      this.loadCatalog().catch(() => null),
    ]);
    return editableAssetsFromManifest(manifest, catalog);
  }

  async recordsForGroup(loadGroup: string): Promise<AssetRecord[]> {
    const manifest = await this.loadManifest();
    return recordsForGroup(manifest, loadGroup);
  }

  async loadGroup(loadGroup: string): Promise<Map<string, GLTF>> {
    const records = await this.recordsForGroup(loadGroup);
    const entries = await Promise.all(
      records.map(async (record) => [record.id, await this.loadModel(record.id)] as const),
    );
    return new Map(entries);
  }

  async loadGroups(loadGroups: string[]): Promise<Map<string, GLTF>> {
    const groups = await Promise.all(
      loadGroups.map((loadGroup) => this.loadGroup(loadGroup)),
    );
    const models = new Map<string, GLTF>();
    for (const group of groups) {
      for (const [id, model] of group) models.set(id, model);
    }
    return models;
  }

  async loadModel(id: string): Promise<GLTF> {
    const manifest = await this.loadManifest();
    const record = assetRecordById(manifest, id);
    if (!record) throw new Error(`Asset not found in manifest: ${id}`);
    return this.modelLoader.load(
      id,
      projectPublicFileUrl(this.project, record.file),
    );
  }

  async totalBytesForGroups(loadGroups: string[]): Promise<number> {
    const manifest = await this.loadManifest();
    return totalBytesForGroups(manifest, loadGroups);
  }

}
