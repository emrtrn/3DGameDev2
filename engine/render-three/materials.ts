import { Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D } from "three";
import type { Material } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface MaterialStats {
  basic: number;
  lit: number;
  total: number;
}

export function isRenderableMesh(
  object: Object3D,
): object is Mesh & { material: Material | Material[] } {
  return object instanceof Mesh;
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
