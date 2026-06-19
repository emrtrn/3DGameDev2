/**
 * Actor Script editor 3D viewport — a self-contained, read-only preview of a
 * class's component tree, rendered with its own `WebGLRenderer` / camera /
 * scene / grid / orbit controls (the {@link StaticMeshEditor} viewport pattern).
 *
 * It consumes the pure {@link actorPreviewNodes} helper (engine, Three.js-free)
 * and builds one `Object3D` per node, parenting nodes via `parent` so Three.js
 * composes the world transform. Meshes load lazily (cached) with a placeholder
 * box until ready; colliders draw wireframes; lights add a light + gizmo; other
 * components render a small icon marker.
 *
 * Editor-only: lives under `src/editor/`, behind the dynamic `?editor` import,
 * so it never ships in the game build. The whole viewport disposes cleanly when
 * the editor closes.
 */
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  BoxHelper,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Spherical,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { MeshoptDecoder } from "meshoptimizer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  actorPreviewNodes,
  type ActorPreviewNode,
  type PreviewCollider,
  type PreviewLight,
} from "@engine/scene/actorPreview";
import type { ActorScriptDef } from "@engine/scene/actorScript";
import {
  createLightObject,
  disposeLightGizmo,
  type LightObjectRecord,
  type LightRenderItem,
} from "@engine/render-three/lights";
import { applyEulerDegrees } from "@engine/render-three/transforms";
import { projectFileUrl } from "@/project/ProjectSystem";

export interface ActorScriptViewportOptions {
  /** The element the canvas mounts into (the editor's `[data-as-viewport]`). */
  host: HTMLElement;
  /** Resolves a manifest asset id to a public-relative model path, or undefined. */
  resolveModelPath: (assetId: string) => string | undefined;
  /** Notified when the user clicks a node's object in the viewport (or empty → null). */
  onPickNode?: (nodeId: string | null) => void;
}

const PLACEHOLDER_COLOR = 0x8a8f96;
const COLLIDER_COLOR = 0x49e6a2;
const SENSOR_COLOR = 0xffb648;
const SELECT_COLOR = 0xffd166;
const MARKER_GLYPHS: Record<string, string> = {
  Audio: "♪",
  ParticleEmitter: "✺",
  Interaction: "☞",
  Behavior: "⚙",
  Metadata: "ℹ",
};

export class ActorScriptViewport {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(45, 1, 0.01, 1000);
  private readonly modelGroup = new Group();
  private readonly loader = new GLTFLoader();
  private readonly resizeObserver: ResizeObserver;
  private readonly raycaster = new Raycaster();
  private readonly hintEl: HTMLElement;

  private readonly target = new Vector3(0, 0.5, 0);
  private readonly spherical = new Spherical(5, Math.PI / 3, Math.PI / 4);
  private userAdjustedCamera = false;

  /** node id → its group (root of that node's local subtree). */
  private readonly nodeObjects = new Map<string, Group>();
  private selectionHelper: BoxHelper | null = null;
  private selectedNodeId: string | null = null;

  /** Loaded GLTF cache keyed by public-relative model path. */
  private readonly modelCache = new Map<string, Promise<GLTF>>();
  private buildGeneration = 0;

  // Per-build disposables (cleared on each rebuild + at teardown).
  private readonly buildGeometries: BufferGeometry[] = [];
  private readonly buildMaterials: Material[] = [];
  private readonly buildTextures: Texture[] = [];
  private readonly buildLightGizmos: Object3D[] = [];

  private rafId = 0;
  private disposed = false;

  constructor(private readonly options: ActorScriptViewportOptions) {
    this.loader.setMeshoptDecoder(MeshoptDecoder);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    options.host.append(this.renderer.domElement);

    this.hintEl = document.createElement("div");
    this.hintEl.className = "as-viewport-hint";
    this.hintEl.textContent = "Add components to preview this class.";
    options.host.append(this.hintEl);

    this.buildScene();
    this.bindCameraControls();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.host);
    this.resize();
    this.startRenderLoop();
  }

  // --- scene setup -------------------------------------------------------

  private buildScene(): void {
    this.scene.background = new Color(0x23262b);
    this.scene.add(new AmbientLight(0xffffff, 1.0));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 2.5);
    this.scene.add(key);
    const fill = new DirectionalLight(0xb9d4ff, 0.9);
    fill.position.set(-3, 2.5, -2);
    this.scene.add(fill);

    const grid = new GridHelper(20, 40, 0x55585c, 0x33373d);
    this.scene.add(grid);
    this.scene.add(this.modelGroup);
    this.updateCamera();
  }

  private updateCamera(): void {
    const offset = new Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  private startRenderLoop(): void {
    const tick = (): void => {
      if (this.disposed) return;
      // Keep the selection box tracking async-loaded meshes / live edits.
      this.selectionHelper?.update();
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private resize(): void {
    const width = this.options.host.clientWidth || 1;
    const height = this.options.host.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // --- camera controls (orbit / pan / dolly) -----------------------------

  private bindCameraControls(): void {
    const el = this.renderer.domElement;
    let mode: "orbit" | "pan" | null = null;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;

    el.addEventListener("contextmenu", (event) => event.preventDefault());
    el.addEventListener("pointerdown", (event) => {
      lastX = event.clientX;
      lastY = event.clientY;
      downX = event.clientX;
      downY = event.clientY;
      mode = event.button === 1 || event.shiftKey || event.button === 2 ? "pan" : "orbit";
      el.setPointerCapture(event.pointerId);
    });
    el.addEventListener("pointermove", (event) => {
      if (!mode) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      this.userAdjustedCamera = true;
      if (mode === "orbit") {
        this.spherical.theta -= dx * 0.01;
        this.spherical.phi = clamp(this.spherical.phi - dy * 0.01, 0.05, Math.PI - 0.05);
      } else {
        const panScale = this.spherical.radius * 0.0015;
        const right = new Vector3().setFromMatrixColumn(this.camera.matrix, 0);
        const up = new Vector3().setFromMatrixColumn(this.camera.matrix, 1);
        this.target.addScaledVector(right, -dx * panScale);
        this.target.addScaledVector(up, dy * panScale);
      }
      this.updateCamera();
    });
    const end = (event: PointerEvent): void => {
      const wasDragging = mode !== null;
      mode = null;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
      // A click (no meaningful drag, left button) picks a node under the cursor.
      if (
        wasDragging &&
        event.button === 0 &&
        Math.hypot(event.clientX - downX, event.clientY - downY) < 4
      ) {
        this.pickAt(event);
      }
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.userAdjustedCamera = true;
        const factor = Math.exp(event.deltaY * 0.001);
        this.spherical.radius = clamp(this.spherical.radius * factor, 0.2, 200);
        this.updateCamera();
      },
      { passive: false },
    );
  }

  // --- build the component tree ------------------------------------------

  /** Rebuilds the whole preview from the class def (full rebuild for v1). */
  setDef(def: ActorScriptDef): void {
    if (this.disposed) return;
    this.buildGeneration += 1;
    this.clearBuild();

    const nodes = actorPreviewNodes(def);
    // First pass: a group per node with its local transform applied.
    for (const node of nodes) {
      const group = new Group();
      group.name = node.id;
      group.userData.nodeId = node.id;
      group.position.set(...node.position);
      applyEulerDegrees(group, node.rotation);
      group.scale.set(...node.scale);
      this.nodeObjects.set(node.id, group);
    }
    // Second pass: parent each node (unresolved parent → modelGroup root) and
    // attach its kind-specific visual.
    let visibleCount = 0;
    for (const node of nodes) {
      const group = this.nodeObjects.get(node.id)!;
      const parent = node.parent ? this.nodeObjects.get(node.parent) : undefined;
      (parent ?? this.modelGroup).add(group);
      if (this.attachVisual(node, group)) visibleCount += 1;
    }

    this.hintEl.style.display = visibleCount > 0 ? "none" : "";
    this.refreshSelectionHelper();
    if (!this.userAdjustedCamera) this.frameToContent();
  }

  /** Adds the node's visual to its group; returns whether it produced content. */
  private attachVisual(node: ActorPreviewNode, group: Group): boolean {
    if (node.mesh) {
      this.attachMesh(node.mesh.assetId, group);
      return true;
    }
    if (node.collider) {
      group.add(this.buildColliderWire(node.collider));
      return true;
    }
    if (node.light) {
      group.add(this.buildLight(node.light));
      return true;
    }
    const glyph = MARKER_GLYPHS[node.component];
    if (glyph) {
      group.add(this.buildMarker(glyph));
      return true;
    }
    return false;
  }

  // --- mesh ---------------------------------------------------------------

  private attachMesh(assetId: string | undefined, group: Group): void {
    // Immediate placeholder; replaced by the model when it resolves.
    const placeholder = this.buildPlaceholderBox();
    placeholder.name = "as-placeholder";
    group.add(placeholder);

    const path = assetId ? this.options.resolveModelPath(assetId) : undefined;
    if (!path) return; // missing / shape: asset → keep the placeholder box

    const generation = this.buildGeneration;
    void this.loadModel(path)
      .then((gltf) => {
        // Drop the result if a rebuild happened or the group was detached.
        if (this.disposed || generation !== this.buildGeneration) return;
        const existing = group.getObjectByName("as-placeholder");
        if (existing) group.remove(existing);
        const model = gltf.scene.clone(true);
        model.name = "as-mesh";
        group.add(model);
        if (!this.userAdjustedCamera) this.frameToContent();
      })
      .catch(() => {
        // Leave the placeholder box on load failure.
      });
  }

  private loadModel(path: string): Promise<GLTF> {
    let promise = this.modelCache.get(path);
    if (!promise) {
      promise = this.loader.loadAsync(projectFileUrl(path));
      this.modelCache.set(path, promise);
    }
    return promise;
  }

  private buildPlaceholderBox(): Mesh {
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial({
      color: PLACEHOLDER_COLOR,
      roughness: 0.85,
      metalness: 0,
      transparent: true,
      opacity: 0.6,
    });
    this.buildGeometries.push(geometry);
    this.buildMaterials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.position.y = 0.5;
    return mesh;
  }

  // --- collider -----------------------------------------------------------

  private buildColliderWire(collider: PreviewCollider): Object3D {
    const solid = unitGeometryForShape(collider.shape);
    const wireGeometry = new EdgesGeometry(solid);
    solid.dispose();
    const material = new LineBasicMaterial({
      color: collider.isSensor ? SENSOR_COLOR : COLLIDER_COLOR,
      transparent: true,
      depthTest: false,
    });
    this.buildGeometries.push(wireGeometry);
    this.buildMaterials.push(material);
    const wire = new LineSegments(wireGeometry, material);
    wire.renderOrder = 3;
    const [sx, sy, sz] = collider.size;
    wire.scale.set(Math.max(sx, 0.001), Math.max(sy, 0.001), Math.max(sz, 0.001));
    if (collider.center) wire.position.set(...collider.center);
    if (collider.rotation) applyEulerDegrees(wire, collider.rotation);
    return wire;
  }

  // --- light --------------------------------------------------------------

  private buildLight(light: PreviewLight): Object3D {
    const item: LightRenderItem = {
      name: "preview-light",
      type: light.type,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      hidden: false,
    };
    if (light.color !== undefined) item.color = light.color;
    if (light.intensity !== undefined) item.intensity = light.intensity;
    if (light.distance !== undefined) item.distance = light.distance;
    if (light.angle !== undefined) item.angle = light.angle;
    if (light.penumbra !== undefined) item.penumbra = light.penumbra;
    if (light.decay !== undefined) item.decay = light.decay;
    const record: LightObjectRecord = createLightObject(item, light.color ?? "#ffffff");
    // Always show the reach wireframe in the editor preview.
    const wire = record.gizmo.getObjectByName("light-wire");
    if (wire) wire.visible = true;
    this.buildLightGizmos.push(record.gizmo);
    // The target is already positioned (and its world matrix updated) at creation;
    // leaving it out of the node subtree avoids a double transform when nested.
    return record.root;
  }

  // --- generic marker -----------------------------------------------------

  private buildMarker(glyph: string): Sprite {
    const texture = makeGlyphTexture(glyph);
    const material = new SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    this.buildTextures.push(texture);
    this.buildMaterials.push(material);
    const sprite = new Sprite(material);
    sprite.scale.set(0.5, 0.5, 0.5);
    sprite.position.y = 0.5;
    return sprite;
  }

  // --- selection ----------------------------------------------------------

  setSelection(nodeId: string | null): void {
    this.selectedNodeId = nodeId;
    this.refreshSelectionHelper();
  }

  private refreshSelectionHelper(): void {
    if (this.selectionHelper) {
      this.scene.remove(this.selectionHelper);
      this.selectionHelper.geometry.dispose();
      (this.selectionHelper.material as Material).dispose();
      this.selectionHelper = null;
    }
    if (!this.selectedNodeId) return;
    const group = this.nodeObjects.get(this.selectedNodeId);
    if (!group || group.children.length === 0) return;
    const helper = new BoxHelper(group, SELECT_COLOR);
    helper.material.depthTest = false;
    helper.renderOrder = 5;
    this.scene.add(helper);
    this.selectionHelper = helper;
  }

  private pickAt(event: PointerEvent): void {
    if (!this.options.onPickNode) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.modelGroup, true);
    for (const hit of hits) {
      const nodeId = findNodeId(hit.object);
      if (nodeId) {
        this.options.onPickNode(nodeId);
        return;
      }
    }
    this.options.onPickNode(null);
  }

  // --- framing ------------------------------------------------------------

  private frameToContent(): void {
    this.modelGroup.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(this.modelGroup);
    if (bounds.isEmpty()) {
      this.target.set(0, 0.5, 0);
      this.spherical.radius = 5;
      this.updateCamera();
      return;
    }
    const center = bounds.getCenter(new Vector3());
    const radius = Math.max(bounds.getSize(new Vector3()).length() / 2, 0.5);
    this.target.copy(center);
    this.spherical.radius = radius * 2.6;
    this.updateCamera();
  }

  // --- teardown -----------------------------------------------------------

  private clearBuild(): void {
    if (this.selectionHelper) {
      this.scene.remove(this.selectionHelper);
      this.selectionHelper.geometry.dispose();
      (this.selectionHelper.material as Material).dispose();
      this.selectionHelper = null;
    }
    // Remove every node group; cloned model children share cached resources, so
    // they are detached (not disposed) — only build-created resources dispose.
    for (const group of this.nodeObjects.values()) {
      group.removeFromParent();
    }
    this.nodeObjects.clear();
    this.modelGroup.clear();
    for (const geometry of this.buildGeometries) geometry.dispose();
    for (const material of this.buildMaterials) material.dispose();
    for (const texture of this.buildTextures) texture.dispose();
    for (const gizmo of this.buildLightGizmos) disposeLightGizmo(gizmo);
    this.buildGeometries.length = 0;
    this.buildMaterials.length = 0;
    this.buildTextures.length = 0;
    this.buildLightGizmos.length = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.clearBuild();
    // Dispose cached model resources once (clones shared these buffers).
    for (const promise of this.modelCache.values()) {
      void promise.then((gltf) => disposeGltf(gltf)).catch(() => {});
    }
    this.modelCache.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.hintEl.remove();
  }
}

// --- helpers --------------------------------------------------------------

/** Unit-sized solid geometry whose bounding box is 1×1×1 (scaled to collider size). */
function unitGeometryForShape(shape: PreviewCollider["shape"]): BufferGeometry {
  switch (shape) {
    // Capsule shares the sphere silhouette in the preview wireframe.
    case "sphere":
    case "capsule":
      return new SphereGeometry(0.5, 16, 12);
    case "cylinder":
    case "cone":
      return new CylinderGeometry(0.5, 0.5, 1, 20);
    default:
      return new BoxGeometry(1, 1, 1);
  }
}

function makeGlyphTexture(glyph: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = "rgba(20,23,27,0.85)";
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8fd0ff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#e7eef3";
    ctx.font = "32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(glyph, 32, 34);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Walks up the parent chain to the nearest node group's id. */
function findNodeId(object: Object3D): string | null {
  let current: Object3D | null = object;
  while (current) {
    const nodeId = current.userData?.nodeId;
    if (typeof nodeId === "string") return nodeId;
    current = current.parent;
  }
  return null;
}

function disposeGltf(gltf: GLTF): void {
  gltf.scene.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: Material): void {
  const slots = material as unknown as Record<string, unknown>;
  for (const value of Object.values(slots)) {
    if (value instanceof Texture) value.dispose();
  }
  material.dispose();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
