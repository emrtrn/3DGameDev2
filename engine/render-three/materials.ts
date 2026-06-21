import {
  BackSide,
  Color,
  DoubleSide,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  type Material,
  type Texture,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ForgeMaterialDef, ForgeMaterialSide } from "../assets/material";

export interface MaterialStats {
  basic: number;
  lit: number;
  total: number;
}

export interface ForgeMaterialTextureMaps {
  baseColorTexture?: Texture | null;
  normalTexture?: Texture | null;
}

export type ForgeThreeMaterial = MeshStandardMaterial | MeshBasicMaterial;

export function isRenderableMesh(
  object: Object3D,
): object is Mesh & { material: Material | Material[] } {
  return object instanceof Mesh;
}

/**
 * Emissive is authored in intuitive ~1-based units (1 starts to read as bloom) but
 * the scene tone-maps from large linear-HDR values, so a small authored number must
 * map to a large actual emissive to glow/bloom. This factor scales the authored
 * `emissiveIntensity` to the three.js material's emissive strength (authored 1 →
 * 1000). It is the counterpart to the bloom strength scale in `postProcess.ts`.
 */
export const EMISSIVE_INTENSITY_SCALE = 1000;

export function createThreeMaterialFromForgeDef(
  def: ForgeMaterialDef,
  textures: ForgeMaterialTextureMaps = {},
): ForgeThreeMaterial {
  const shared = {
    name: def.name,
    color: new Color(def.baseColor),
    transparent: def.alphaMode === "blend" || def.opacity < 1,
    opacity: def.opacity,
    alphaTest: def.alphaMode === "mask" ? def.alphaTest : 0,
    depthWrite: def.alphaMode !== "blend",
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
          emissiveIntensity: def.emissiveIntensity * EMISSIVE_INTENSITY_SCALE,
        });

  if (textures.baseColorTexture) {
    textures.baseColorTexture.colorSpace = SRGBColorSpace;
    textures.baseColorTexture.wrapS = RepeatWrapping;
    textures.baseColorTexture.wrapT = RepeatWrapping;
    material.map = textures.baseColorTexture;
  }
  if (textures.normalTexture && material instanceof MeshStandardMaterial) {
    textures.normalTexture.wrapS = RepeatWrapping;
    textures.normalTexture.wrapT = RepeatWrapping;
    material.normalMap = textures.normalTexture;
  }

  material.needsUpdate = true;
  return material;
}

export function collectMaterialStats(models: Map<string, GLTF>): MaterialStats {
  const seen = new Set<Material>();
  for (const gltf of models.values()) {
    gltf.scene.traverse((object) => {
      if (!isRenderableMesh(object)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) seen.add(material);
    });
  }

  let basic = 0;
  let lit = 0;
  for (const material of seen) {
    if (material.type === "MeshBasicMaterial") basic += 1;
    else lit += 1;
  }

  return { basic, lit, total: seen.size };
}

export function convertUnlitModelMaterialsToLit(models: Map<string, GLTF>): number {
  const converted = new Map<Material, Material>();

  const resolveMaterial = (material: Material): Material => {
    if (!(material instanceof MeshBasicMaterial)) return material;
    const cached = converted.get(material);
    if (cached) return cached;

    const lit = new MeshStandardMaterial({
      name: material.name,
      color: material.color.clone(),
      map: material.map,
      alphaMap: material.alphaMap,
      transparent: material.transparent,
      opacity: material.opacity,
      alphaTest: material.alphaTest,
      side: material.side,
      depthTest: material.depthTest,
      depthWrite: material.depthWrite,
      wireframe: material.wireframe,
    });
    lit.vertexColors = material.vertexColors;
    lit.toneMapped = material.toneMapped;
    lit.needsUpdate = true;
    converted.set(material, lit);
    return lit;
  };

  for (const gltf of models.values()) {
    gltf.scene.traverse((object) => {
      if (!isRenderableMesh(object)) return;
      object.material = Array.isArray(object.material)
        ? object.material.map(resolveMaterial)
        : resolveMaterial(object.material);
    });
  }

  return converted.size;
}

function materialSide(side: ForgeMaterialSide): typeof FrontSide | typeof BackSide | typeof DoubleSide {
  if (side === "back") return BackSide;
  if (side === "double") return DoubleSide;
  return FrontSide;
}
