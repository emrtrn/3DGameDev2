import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector2,
} from "three";
import type {
  Camera,
  Material,
  Object3D,
  Scene,
} from "three";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";

import { isRenderableMesh } from "@engine/render-three/materials";
import type { PostProcessPipeline } from "@engine/render-three/postProcess";

const OUTLINE_COLOR = new Color(0xff9a1f);

/**
 * Editor-only post-process selection outline. Proxy meshes live in the main
 * scene so OutlinePass can depth-test against real geometry, but their normal
 * material does not write color or depth in the beauty pass.
 */
export class EditorSelectionOutline {
  private readonly scene: Scene;
  private readonly outlinePass: OutlinePass;
  private readonly proxyRoot = new Group();
  private readonly invisibleMaterial = new MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
  });

  constructor(options: {
    scene: Scene;
    camera: Camera;
    pipeline: PostProcessPipeline;
    width: number;
    height: number;
  }) {
    this.scene = options.scene;
    this.proxyRoot.name = "editor-selection-outline-proxies";
    this.scene.add(this.proxyRoot);

    this.outlinePass = new OutlinePass(
      new Vector2(options.width, options.height),
      options.scene,
      options.camera,
      [],
    );
    this.outlinePass.visibleEdgeColor.copy(OUTLINE_COLOR);
    this.outlinePass.hiddenEdgeColor.copy(OUTLINE_COLOR);
    this.outlinePass.edgeStrength = 4.5;
    this.outlinePass.edgeThickness = 1.5;
    this.outlinePass.edgeGlow = 0;
    this.outlinePass.pulsePeriod = 0;
    options.pipeline.addPassBeforeOutput(this.outlinePass);
  }

  setTargets(targets: Object3D[]): void {
    this.clearTargets();
    for (const target of targets) {
      this.proxyRoot.add(target);
    }
    this.outlinePass.selectedObjects = [...this.proxyRoot.children];
  }

  dispose(): void {
    this.clearTargets();
    this.proxyRoot.removeFromParent();
    this.invisibleMaterial.dispose();
  }

  cloneRenderableMeshes(source: Object3D): Object3D | null {
    const group = new Group();
    group.name = `${source.name || "selection"}-outline-proxy`;
    source.updateMatrixWorld(true);
    source.traverse((object) => {
      if (!isRenderableMesh(object)) return;
      const proxy = new Mesh(object.geometry, this.invisibleMaterial);
      proxy.name = `${object.name || "mesh"}-outline-proxy`;
      proxy.matrix.copy(object.matrixWorld);
      proxy.matrixAutoUpdate = false;
      proxy.frustumCulled = false;
      proxy.castShadow = false;
      proxy.receiveShadow = false;
      proxy.raycast = () => {};
      group.add(proxy);
    });
    return group.children.length > 0 ? group : null;
  }

  getInvisibleMaterial(): Material {
    return this.invisibleMaterial;
  }

  private clearTargets(): void {
    this.outlinePass.selectedObjects = [];
    while (this.proxyRoot.children.length > 0) {
      const child = this.proxyRoot.children[0];
      if (!child) break;
      this.proxyRoot.remove(child);
    }
  }
}
