import {
  BackSide,
  Color,
  DoubleSide,
  FrontSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
} from "three";

import { assetPath, assetRecordById, assetType, type AssetManifest } from "@engine/assets/manifest";
import {
  normalizeForgeMaterialDef,
  type ForgeMaterialSide,
} from "@engine/assets/material";
import { projectFileUrl } from "@/project/ProjectSystem";

export async function loadForgeMaterial(
  manifest: AssetManifest,
  materialId: string,
  textureLoader = new TextureLoader(),
): Promise<MeshStandardMaterial | MeshBasicMaterial> {
  const materialRecord = assetRecordById(manifest, materialId);
  if (!materialRecord || assetType(materialRecord) !== "material") {
    throw new Error(`Material asset not found: ${materialId}`);
  }
  const response = await fetch(projectFileUrl(assetPath(materialRecord)));
  if (!response.ok) {
    throw new Error(`Material asset failed: ${response.status} ${response.statusText}`);
  }
  const def = normalizeForgeMaterialDef(await response.json(), materialRecord.name);
  const shared = {
    name: def.name,
    color: new Color(def.baseColor ?? "#ffffff"),
    transparent: def.alphaMode === "blend" || def.opacity < 1,
    opacity: def.opacity,
    alphaTest: def.alphaMode === "mask" ? def.alphaTest : 0,
    side: materialSide(def.side),
  };
  const material =
    def.materialType === "basic"
      ? new MeshBasicMaterial(shared)
      : new MeshStandardMaterial({
          ...shared,
          roughness: def.roughness,
          metalness: def.metalness,
          emissive: new Color(def.emissive),
          emissiveIntensity: def.emissiveIntensity,
        });
  if (def.baseColorTexture) {
    const texture = await loadTextureByAssetId(manifest, def.baseColorTexture, textureLoader);
    texture.colorSpace = SRGBColorSpace;
    material.map = texture;
  }
  if (def.normalTexture && material instanceof MeshStandardMaterial) {
    material.normalMap = await loadTextureByAssetId(manifest, def.normalTexture, textureLoader);
  }
  material.needsUpdate = true;
  return material;
}

async function loadTextureByAssetId(
  manifest: AssetManifest,
  textureId: string,
  loader: TextureLoader,
) {
  const record = assetRecordById(manifest, textureId);
  if (!record || assetType(record) !== "texture") {
    throw new Error(`Texture asset not found: ${textureId}`);
  }
  const texture = await loader.loadAsync(projectFileUrl(assetPath(record)));
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

function materialSide(side: ForgeMaterialSide): typeof FrontSide | typeof BackSide | typeof DoubleSide {
  if (side === "back") return BackSide;
  if (side === "double") return DoubleSide;
  return FrontSide;
}
