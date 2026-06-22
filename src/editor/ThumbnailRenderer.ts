import {
  AmbientLight,
  BackSide,
  Box3,
  Color,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  GridHelper,
  Group,
  PerspectiveCamera,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Scene,
  SRGBColorSpace,
  SphereGeometry,
  type Material,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "three";
import { MeshoptDecoder } from "meshoptimizer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  ForgeMaterialAlphaMode,
  ForgeMaterialSide,
  ForgeMaterialType,
  ForgeMaterialUvTiling,
} from "@engine/assets/material";
import { configureForgeTexture } from "@engine/render-three/textureConfig";

export interface ThumbnailMaterialPreview {
  materialType: ForgeMaterialType;
  baseColor: string;
  baseColorTextureUrl?: string;
  normalTextureUrl?: string;
  uvTiling: ForgeMaterialUvTiling;
  roughness: number;
  metalness: number;
  opacity: number;
  alphaMode: ForgeMaterialAlphaMode;
  alphaTest: number;
  side: ForgeMaterialSide;
  emissive: string;
  emissiveIntensity: number;
}

export class ThumbnailRenderer {
  private readonly loader = new GLTFLoader();
  private readonly textureLoader = new TextureLoader();
  private readonly renderer: WebGLRenderer;
  private readonly cache = new Map<string, Promise<string>>();

  constructor(size = 192) {
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.renderer.outputColorSpace = SRGBColorSpace;
  }

  renderModel(url: string, material?: ThumbnailMaterialPreview): Promise<string> {
    const cacheKey = material ? `model:${url}:${materialCacheKey(material)}` : url;
    let cached = this.cache.get(cacheKey);
    if (!cached) {
      cached = this.renderModelUncached(url, material);
      this.cache.set(cacheKey, cached);
    }
    return cached;
  }

  renderMaterial(key: string, material: ThumbnailMaterialPreview): Promise<string> {
    const cacheKey = `material:${key}:${materialCacheKey(material)}`;
    let cached = this.cache.get(cacheKey);
    if (!cached) {
      cached = this.renderMaterialUncached(material);
      this.cache.set(cacheKey, cached);
    }
    return cached;
  }

  dispose(): void {
    this.renderer.dispose();
    this.cache.clear();
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async renderModelUncached(
    url: string,
    materialPreview?: ThumbnailMaterialPreview,
  ): Promise<string> {
    const gltf = await this.loader.loadAsync(url);
    const model = gltf.scene.clone(true);
    const scene = new Scene();
    scene.background = new Color(0x191b1f);
    scene.add(new AmbientLight(0xffffff, 1.2));

    const keyLight = new DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(2.5, 4, 3);
    scene.add(keyLight);

    const fillLight = new DirectionalLight(0xb9d4ff, 1.2);
    fillLight.position.set(-3, 2.5, -2);
    scene.add(fillLight);

    const group = new Group();
    const material = materialPreview
      ? await this.createMaterialFromPreview(materialPreview)
      : null;
    if (material) {
      model.traverse((object) => {
        if (object instanceof Mesh) object.material = material;
      });
    }
    group.add(model);
    scene.add(group);

    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z, 0.1);
    model.position.sub(center);
    model.position.y += size.y / 2;
    group.rotation.y = -Math.PI / 5;

    const grid = new GridHelper(Math.max(maxAxis * 2.6, 2), 12, 0x464a51, 0x292c31);
    grid.position.y = -0.01;
    scene.add(grid);

    const camera = new PerspectiveCamera(32, 1, 0.01, 100);
    const distance = maxAxis * 2.4;
    camera.position.set(distance * 0.85, distance * 0.7, distance);
    camera.lookAt(0, size.y * 0.38, 0);
    camera.updateProjectionMatrix();

    this.renderer.setClearColor(0x191b1f, 1);
    this.renderer.render(scene, camera);
    const imageUrl = this.renderer.domElement.toDataURL("image/png");
    disposeMaterial(material);
    return imageUrl;
  }

  private async renderMaterialUncached(materialPreview: ThumbnailMaterialPreview): Promise<string> {
    const scene = new Scene();
    scene.background = new Color(0x191b1f);
    scene.add(new AmbientLight(0xffffff, 1.1));

    const keyLight = new DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    const rimLight = new DirectionalLight(0xb9d4ff, 1.0);
    rimLight.position.set(-3, 2, -2);
    scene.add(rimLight);

    const material = await this.createMaterialFromPreview(materialPreview);

    const sphere = new Mesh(new SphereGeometry(0.82, 48, 32), material);
    sphere.rotation.y = -Math.PI / 7;
    scene.add(sphere);

    const camera = new PerspectiveCamera(28, 1, 0.01, 100);
    camera.position.set(0, 0.05, 4.2);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    this.renderer.setClearColor(0x191b1f, 1);
    this.renderer.render(scene, camera);
    const url = this.renderer.domElement.toDataURL("image/png");
    sphere.geometry.dispose();
    disposeMaterial(material);
    return url;
  }

  private async createMaterialFromPreview(
    preview: ThumbnailMaterialPreview,
  ): Promise<MeshStandardMaterial | MeshBasicMaterial> {
    const shared = {
      color: new Color(preview.baseColor),
      transparent: preview.alphaMode === "blend" || preview.opacity < 1,
      opacity: preview.opacity,
      alphaTest: preview.alphaMode === "mask" ? preview.alphaTest : 0,
      side: materialSide(preview.side),
    };
    const material =
      preview.materialType === "basic"
        ? new MeshBasicMaterial(shared)
        : new MeshStandardMaterial({
            ...shared,
            roughness: preview.roughness,
            metalness: preview.metalness,
            emissive: new Color(preview.emissive),
            emissiveIntensity: preview.emissiveIntensity,
          });
    if (preview.baseColorTextureUrl) {
      const texture = await this.textureLoader.loadAsync(preview.baseColorTextureUrl);
      material.map = configureForgeTexture(texture, {
        srgb: true,
        repeat: preview.uvTiling,
        maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      });
    }
    if (preview.normalTextureUrl && material instanceof MeshStandardMaterial) {
      const texture = await this.textureLoader.loadAsync(preview.normalTextureUrl);
      material.normalMap = configureForgeTexture(texture, {
        srgb: false,
        repeat: preview.uvTiling,
        maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      });
    }
    material.needsUpdate = true;
    return material;
  }
}

function disposeMaterial(material: Material | null): void {
  if (!material) return;
  if (material instanceof MeshBasicMaterial || material instanceof MeshStandardMaterial) {
    material.map?.dispose();
  }
  if (material instanceof MeshStandardMaterial) {
    material.normalMap?.dispose();
  }
  material.dispose();
}

function materialCacheKey(material: ThumbnailMaterialPreview): string {
  return JSON.stringify(material);
}

function materialSide(side: ForgeMaterialSide): typeof FrontSide | typeof BackSide | typeof DoubleSide {
  if (side === "back") return BackSide;
  if (side === "double") return DoubleSide;
  return FrontSide;
}
