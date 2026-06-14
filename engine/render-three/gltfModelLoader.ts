import { MeshoptDecoder } from "meshoptimizer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export class GltfModelLoader {
  private readonly modelPromises = new Map<string, Promise<GLTF>>();
  private readonly gltfLoader = new GLTFLoader();

  constructor() {
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }

  load(id: string, url: string): Promise<GLTF> {
    let promise = this.modelPromises.get(id);
    if (!promise) {
      promise = this.gltfLoader.loadAsync(url);
      this.modelPromises.set(id, promise);
    }
    return promise;
  }
}
