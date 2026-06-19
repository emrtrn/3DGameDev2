import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  PerspectiveCamera,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  SphereGeometry,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "three";
import { MeshoptDecoder } from "meshoptimizer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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

  renderModel(url: string, materialTextureUrl?: string): Promise<string> {
    const cacheKey = materialTextureUrl ? `model:${url}:${materialTextureUrl}` : url;
    let cached = this.cache.get(cacheKey);
    if (!cached) {
      cached = this.renderModelUncached(url, materialTextureUrl);
      this.cache.set(cacheKey, cached);
    }
    return cached;
  }

  renderMaterial(key: string, textureUrl?: string): Promise<string> {
    const cacheKey = `material:${key}:${textureUrl ?? "none"}`;
    let cached = this.cache.get(cacheKey);
    if (!cached) {
      cached = this.renderMaterialUncached(textureUrl);
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

  private async renderModelUncached(url: string, materialTextureUrl?: string): Promise<string> {
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
    if (materialTextureUrl) {
      const texture = await this.textureLoader.loadAsync(materialTextureUrl);
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      const material = new MeshStandardMaterial({
        map: texture,
        roughness: 0.78,
        metalness: 0,
      });
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
    return this.renderer.domElement.toDataURL("image/png");
  }

  private async renderMaterialUncached(textureUrl?: string): Promise<string> {
    const scene = new Scene();
    scene.background = new Color(0x191b1f);
    scene.add(new AmbientLight(0xffffff, 1.1));

    const keyLight = new DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    const rimLight = new DirectionalLight(0xb9d4ff, 1.0);
    rimLight.position.set(-3, 2, -2);
    scene.add(rimLight);

    const material = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0,
    });
    if (textureUrl) {
      const texture = await this.textureLoader.loadAsync(textureUrl);
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      material.map = texture;
      material.needsUpdate = true;
    }

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
    material.map?.dispose();
    material.dispose();
    return url;
  }
}
