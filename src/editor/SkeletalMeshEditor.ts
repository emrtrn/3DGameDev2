/**
 * Persona-style skeletal mesh editor shell. Opened from the Content Browser for
 * `skeletalMesh` assets and kept behind a dynamic editor import.
 */
import {
  AmbientLight,
  AnimationAction,
  AnimationClip,
  Bone,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  LoopOnce,
  LoopRepeat,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SkeletonHelper,
  SkinnedMesh,
  SphereGeometry,
  SRGBColorSpace,
  Spherical,
  Vector3,
  WebGLRenderer,
  type AnimationMixer,
  type Material,
} from "three";
import { MeshoptDecoder } from "meshoptimizer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { VertexNormalsHelper } from "three/examples/jsm/helpers/VertexNormalsHelper.js";
import { CrossfadeAnimator } from "@engine/render-three/characterAnimator";
import type { Vec3 } from "@engine/scene/layout";
import { projectFileUrl } from "@/project/ProjectSystem";
import {
  ANIMATION_SET_ROLES,
  BLEND_SPACE_TYPES,
  MONTAGE_SLOTS,
  defaultAssetSkeleton,
  defaultBlendSpaceAxis,
  loadAssetSkeleton,
  resolveBlendSpaceWeights,
  saveAssetSkeleton,
  type AnimationSetRole,
  type AssetSkeletonBlendSpaceDef,
  type AssetSkeletonDef,
  type AssetSkeletonMontageDef,
  type AssetSkeletonSocketDef,
  type BlendSpaceAxisDef,
  type BlendSpaceSampleDef,
  type BlendSpaceType,
  type MontageSlot,
} from "@/editor/assetSkeletonStore";

export interface SkeletalMeshEditorOptions {
  /** Public-relative path to the model file (e.g. `assets/characters/hero.glb`). */
  modelPath: string;
  /** Manifest asset id for the opened mesh. */
  assetId?: string;
  /** Display name shown in the editor header / tab. */
  label: string;
  /** Content Browser assets available for socket preview attachment. */
  assets?: AssetPickerItem[];
  /** Optional status sink (surfaces to the host editor's status bar). */
  onStatus?: (message: string, tone?: "info" | "warning" | "error") => void;
}

type PersonaMode = "skeleton" | "animation";
type SocketGizmoMode = "translate" | "rotate" | "scale";

interface AssetPickerItem {
  id: string;
  name: string;
  assetType: string;
  path: string;
}

interface BoneNode {
  bone: Bone;
  children: BoneNode[];
}

interface MeshStats {
  meshCount: number;
  skinnedMeshCount: number;
  sectionCount: number;
  materialCount: number;
  vertexCount: number;
  triangleCount: number;
}

interface MeshSectionInfo {
  meshName: string;
  materialName: string;
  vertexCount: number;
  triangleCount: number;
  skinned: boolean;
}

interface MorphTargetBinding {
  mesh: Mesh;
  index: number;
  meshName: string;
}

interface MorphTargetControl {
  key: string;
  name: string;
  bindings: MorphTargetBinding[];
}

interface SocketOverlay {
  root: Group;
  marker: Mesh;
  socket: AssetSkeletonSocketDef;
  previewRoot: Object3D | null;
  previewAssetId: string | null;
}

export class SkeletalMeshEditor {
  private static active: SkeletalMeshEditor | null = null;

  static open(options: SkeletalMeshEditorOptions): SkeletalMeshEditor {
    SkeletalMeshEditor.active?.close();
    const editor = new SkeletalMeshEditor(options);
    SkeletalMeshEditor.active = editor;
    return editor;
  }

  private readonly overlay: HTMLDivElement;
  private readonly viewportHost: HTMLDivElement;
  private readonly detailsHost: HTMLDivElement;
  private readonly toolbarHost: HTMLDivElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(45, 1, 0.01, 1000);
  private readonly loader = new GLTFLoader();
  private readonly modelGroup = new Group();
  private readonly helperGroup = new Group();
  private readonly resizeObserver: ResizeObserver;
  private readonly clock = new Clock();

  private readonly target = new Vector3();
  private readonly spherical = new Spherical(4, Math.PI / 3, Math.PI / 4);
  private modelRadius = 1;

  private mode: PersonaMode = "skeleton";
  private rafId = 0;
  private disposed = false;
  private skeletonHelper: SkeletonHelper | null = null;
  private readonly normalHelpers: VertexNormalsHelper[] = [];
  private readonly socketOverlays: SocketOverlay[] = [];
  private transformControls: TransformControls | null = null;
  private socketGizmoMode: SocketGizmoMode = "translate";
  private socketGizmoDragging = false;
  private selectedSocketName: string | null = null;
  private selectedBone: Bone | null = null;
  private readonly boneMarker = new Mesh(
    new SphereGeometry(0.045, 16, 10),
    new MeshBasicMaterial({ color: 0xffb648, depthTest: false }),
  );

  private stats: MeshStats = emptyStats();
  private readonly skinnedMeshes: SkinnedMesh[] = [];
  private readonly materials = new Set<Material>();
  private readonly meshSections: MeshSectionInfo[] = [];
  private readonly morphTargets: MorphTargetControl[] = [];
  private boneRoots: BoneNode[] = [];
  private bones: Bone[] = [];
  /** Every named node in the model — upper-body root candidates (skinned or rigid). */
  private nodeNames: string[] = [];
  private clips: AnimationClip[] = [];
  private skeleton: AssetSkeletonDef = defaultAssetSkeleton();

  private animator: CrossfadeAnimator | null = null;
  private mixer: AnimationMixer | null = null;
  private action: AnimationAction | null = null;
  private selectedClipName = "";
  private selectedBlendSpaceName: string | null = null;
  private selectedMontageName: string | null = null;
  private blendPreviewActive = false;
  private blendPreviewPhase = 0;
  private readonly blendPreviewParams = { x: 0, y: 0 };
  private readonly blendPreviewActions = new Map<string, AnimationAction>();
  private playing = false;
  private loop = true;
  private playRate = 1;
  private crossfadeDuration = 0.2;
  private showSkeleton = true;
  private showNormals = false;
  private wireframe = false;

  private constructor(private readonly options: SkeletalMeshEditorOptions) {
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.boneMarker.visible = false;
    this.boneMarker.renderOrder = 5;

    this.overlay = document.createElement("div");
    this.overlay.className = "sm-editor-overlay";
    this.overlay.innerHTML = `
      <div class="sm-editor-window">
        <header class="sm-editor-header">
          <span class="sm-editor-tab">
            <span class="sm-editor-tab-icon">♙</span>
            <strong data-sm-title></strong>
          </span>
          <div class="sm-editor-header-actions">
            <button type="button" class="sm-editor-save" data-sm-save title="Save skeleton metadata (Ctrl+S)">Save</button>
            <button type="button" class="sm-editor-close" data-sm-close title="Close (Esc)">✕</button>
          </div>
        </header>
        <div class="sm-editor-toolbar" data-sm-toolbar></div>
        <div class="sm-editor-body">
          <div class="sm-editor-viewport" data-sm-viewport></div>
          <aside class="sm-editor-details" data-sm-details></aside>
        </div>
        <footer class="sm-editor-status" data-sm-status>Loading...</footer>
      </div>
    `;
    document.body.append(this.overlay);

    this.toolbarHost = this.requireEl("[data-sm-toolbar]");
    this.viewportHost = this.requireEl("[data-sm-viewport]");
    this.detailsHost = this.requireEl("[data-sm-details]");
    this.requireEl("[data-sm-title]").textContent = options.label;
    this.requireEl<HTMLButtonElement>("[data-sm-close]").addEventListener("click", () =>
      this.close(),
    );
    this.requireEl<HTMLButtonElement>("[data-sm-save]").addEventListener("click", () =>
      void this.save(),
    );

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.viewportHost.append(this.renderer.domElement);

    this.buildScene();
    this.bindCameraControls();
    this.bindKeyboard();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewportHost);
    this.resize();

    this.renderToolbar();
    this.renderDetails();
    this.startRenderLoop();

    void this.loadModel();
  }

  private buildScene(): void {
    this.scene.background = new Color(0x23262b);
    this.scene.add(new AmbientLight(0xffffff, 1.1));

    const key = new DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 5, 2.5);
    this.scene.add(key);
    const fill = new DirectionalLight(0xb9d4ff, 1.0);
    fill.position.set(-3, 2.5, -2);
    this.scene.add(fill);

    const grid = new GridHelper(20, 40, 0x55585c, 0x33373d);
    this.scene.add(grid);
    this.scene.add(this.modelGroup);
    this.scene.add(this.helperGroup);
    this.helperGroup.add(this.boneMarker);

    const controls = new TransformControls(this.camera, this.renderer.domElement);
    controls.setSize(0.78);
    controls.addEventListener("dragging-changed", (event) => {
      this.socketGizmoDragging = event.value === true;
      if (!this.socketGizmoDragging) {
        this.commitSelectedSocketFromGizmo();
      }
    });
    controls.addEventListener("objectChange", () => this.commitSelectedSocketFromGizmo({ quiet: true }));
    this.scene.add(controls.getHelper());
    this.transformControls = controls;

    this.updateCamera();
  }

  private async loadModel(): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(projectFileUrl(this.options.modelPath));
      if (this.disposed) return;
      this.clips = gltf.animations;
      this.modelGroup.add(gltf.scene);
      this.collectModelInfo(gltf.scene);
      this.frameModel(gltf.scene);
      this.buildSkeletonHelper(gltf.scene);
      this.buildNormalHelpers(gltf.scene);
      this.animator = new CrossfadeAnimator(gltf.scene, this.clips);
      this.mixer = this.animator.mixer;
      await this.loadSkeleton();
      this.selectedClipName = this.resolveInitialClip();
      if (this.selectedClipName) this.selectClip(this.selectedClipName, { autoplay: false, crossfade: false });
      this.renderToolbar();
      this.renderDetails();
      this.setStatus(
        this.skinnedMeshes.length > 0
          ? `Ready. ${this.bones.length} bones, ${this.clips.length} animation clips.`
          : "Loaded, but no SkinnedMesh was found.",
        this.skinnedMeshes.length > 0 ? "info" : "warning",
      );
    } catch (error) {
      this.setStatus(`Failed to load skeletal mesh: ${describeError(error)}`, "error");
    }
  }

  private async loadSkeleton(): Promise<void> {
    this.skeleton = await loadAssetSkeleton(this.options.modelPath);
    this.sanitizeAnimationSet();
    this.sanitizeSockets();
    this.rebuildSocketOverlays();
  }

  private resolveInitialClip(): string {
    const preferred = this.skeleton.preview.selectedClip;
    if (preferred && this.clips.some((clip) => clip.name === preferred)) return preferred;
    const firstMapped = ANIMATION_SET_ROLES
      .map((role) => this.skeleton.animationSet[role])
      .find((clipName): clipName is string =>
        Boolean(clipName && this.clips.some((clip) => clip.name === clipName)),
      );
    return firstMapped ?? this.clips[0]?.name ?? "";
  }

  private sanitizeAnimationSet(): void {
    const available = new Set(this.clips.map((clip) => clip.name));
    const animationSet: Partial<Record<AnimationSetRole, string>> = {};
    for (const role of ANIMATION_SET_ROLES) {
      const clip = this.skeleton.animationSet[role];
      if (clip && available.has(clip)) animationSet[role] = clip;
    }
    this.skeleton = { ...this.skeleton, animationSet };
  }

  private sanitizeSockets(): void {
    const bones = new Set(this.bones.map((bone) => bone.name).filter(Boolean));
    const names = new Set<string>();
    const sockets = this.skeleton.sockets.filter((socket) => {
      if (!socket.name || names.has(socket.name)) return false;
      if (!bones.has(socket.bone)) return false;
      names.add(socket.name);
      return true;
    });
    this.skeleton = { ...this.skeleton, sockets };
  }

  private collectModelInfo(root: Object3D): void {
    this.skinnedMeshes.length = 0;
    this.materials.clear();
    this.meshSections.length = 0;
    this.morphTargets.length = 0;
    const morphTargetsByName = new Map<string, MorphTargetControl>();
    const boneSet = new Set<Bone>();
    const nodeNames: string[] = [];
    const seenNodeNames = new Set<string>();
    const stats = emptyStats();

    root.traverse((object) => {
      if (object.name && !seenNodeNames.has(object.name)) {
        seenNodeNames.add(object.name);
        nodeNames.push(object.name);
      }
      if (object instanceof Bone) boneSet.add(object);
      if (!(object instanceof Mesh)) return;
      stats.meshCount += 1;
      const geometry = object.geometry;
      const position = geometry.getAttribute("position");
      stats.vertexCount += position?.count ?? 0;
      stats.triangleCount += geometry.index
        ? Math.floor(geometry.index.count / 3)
        : Math.floor((position?.count ?? 0) / 3);
      const materials = materialList(object.material);
      for (const material of materials) this.materials.add(material);
      const groups = geometry.groups.length > 0
        ? geometry.groups
        : [{ start: 0, count: geometry.index?.count ?? position?.count ?? 0, materialIndex: 0 }];
      stats.sectionCount += groups.length;
      for (const [index, group] of groups.entries()) {
        const material = materials[group.materialIndex ?? 0] ?? materials[0];
        this.meshSections.push({
          meshName: object.name || `Mesh ${stats.meshCount}`,
          materialName: material?.name || material?.type || `Material ${group.materialIndex ?? index}`,
          vertexCount: group.count,
          triangleCount: Math.floor(group.count / 3),
          skinned: object instanceof SkinnedMesh,
        });
      }
      if (object instanceof SkinnedMesh) {
        stats.skinnedMeshCount += 1;
        this.skinnedMeshes.push(object);
        for (const bone of object.skeleton.bones) boneSet.add(bone);
      }
      this.collectMorphTargets(object, morphTargetsByName);
    });

    stats.materialCount = this.materials.size;
    this.morphTargets.push(...morphTargetsByName.values());
    this.stats = stats;
    this.bones = [...boneSet];
    this.boneRoots = buildBoneTree(this.bones);
    this.nodeNames = nodeNames;
  }

  private collectMorphTargets(mesh: Mesh, targets: Map<string, MorphTargetControl>): void {
    const influences = mesh.morphTargetInfluences;
    if (!influences || influences.length === 0) return;
    const dictionary = mesh.morphTargetDictionary ?? {};
    const namesByIndex = new Map<number, string>();
    for (const [name, index] of Object.entries(dictionary)) {
      namesByIndex.set(index, name);
    }
    for (let index = 0; index < influences.length; index += 1) {
      const name = namesByIndex.get(index) ?? `Morph ${index}`;
      let target = targets.get(name);
      if (!target) {
        target = { key: name, name, bindings: [] };
        targets.set(name, target);
      }
      target.bindings.push({ mesh, index, meshName: mesh.name || `Mesh ${targets.size}` });
    }
  }

  private frameModel(root: Object3D): void {
    const bounds = new Box3().setFromObject(root);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    this.modelRadius = Math.max(size.length() / 2, 0.5);
    this.target.copy(center);
    this.spherical.radius = this.modelRadius * 2.6;
    this.updateCamera();
  }

  private buildSkeletonHelper(root: Object3D): void {
    this.skeletonHelper?.dispose();
    this.skeletonHelper?.removeFromParent();
    this.skeletonHelper = null;
    if (this.bones.length === 0) return;
    const helper = new SkeletonHelper(root);
    helper.visible = this.showSkeleton;
    this.helperGroup.add(helper);
    this.skeletonHelper = helper;
  }

  private buildNormalHelpers(root: Object3D): void {
    this.disposeNormalHelpers();
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (!object.geometry.getAttribute("normal")) return;
      const helper = new VertexNormalsHelper(object, this.modelRadius * 0.025, 0x7ac7ff);
      helper.visible = this.showNormals;
      this.helperGroup.add(helper);
      this.normalHelpers.push(helper);
    });
  }

  private startRenderLoop(): void {
    const tick = (): void => {
      if (this.disposed) return;
      const delta = this.clock.getDelta();
      if (this.blendPreviewActive) {
        this.updateBlendPreview(delta);
      } else if (this.playing) {
        this.mixer?.update(delta * this.playRate);
        this.updateTimelineFromAction();
      }
      this.updateBoneMarker();
      this.updateNormalHelpers();
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private resize(): void {
    const width = this.viewportHost.clientWidth || 1;
    const height = this.viewportHost.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private updateCamera(): void {
    const offset = new Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  private bindCameraControls(): void {
    const el = this.renderer.domElement;
    let mode: "orbit" | "pan" | null = null;
    let lastX = 0;
    let lastY = 0;

    el.addEventListener("contextmenu", (event) => event.preventDefault());
    el.addEventListener("pointerdown", (event) => {
      if (this.transformControls?.axis) return;
      lastX = event.clientX;
      lastY = event.clientY;
      mode = event.button === 1 || event.shiftKey || event.button === 2 ? "pan" : "orbit";
      el.setPointerCapture(event.pointerId);
    });
    el.addEventListener("pointermove", (event) => {
      if (!mode || this.socketGizmoDragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
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
      mode = null;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const factor = Math.exp(event.deltaY * 0.001);
        this.spherical.radius = clamp(this.spherical.radius * factor, this.modelRadius * 0.2, this.modelRadius * 12);
        this.updateCamera();
      },
      { passive: false },
    );
  }

  private bindKeyboard(): void {
    this.overlay.addEventListener("keydown", (event) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, select, textarea")) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        this.close();
        return;
      }
      if (event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        void this.save();
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        this.togglePlayback();
      }
    });
    this.overlay.tabIndex = -1;
    this.overlay.focus();
  }

  private renderToolbar(): void {
    this.toolbarHost.innerHTML = `
      <div class="sm-tool-group sm-tool-modes" aria-label="Persona mode">
        <button type="button" class="sm-tool-btn ${this.mode === "skeleton" ? "is-active" : ""}" data-skel-mode="skeleton">Skeleton</button>
        <button type="button" class="sm-tool-btn ${this.mode === "animation" ? "is-active" : ""}" data-skel-mode="animation">Animation</button>
        <button type="button" class="sm-tool-btn" disabled title="Physics mode is planned for PhAT-lite">Physics</button>
      </div>
      <div class="sm-tool-sep"></div>
      <div class="sm-tool-group sm-tool-visibility">
        <label class="sm-tool-check">
          <input type="checkbox" data-skel-show-skeleton ${this.showSkeleton ? "checked" : ""} />
          <span>Skeleton</span>
        </label>
        <label class="sm-tool-check">
          <input type="checkbox" data-skel-wireframe ${this.wireframe ? "checked" : ""} />
          <span>Wireframe</span>
        </label>
        <label class="sm-tool-check">
          <input type="checkbox" data-skel-show-normals ${this.showNormals ? "checked" : ""} />
          <span>Normals</span>
        </label>
      </div>
      <div class="sm-tool-sep"></div>
      <div class="sm-tool-group">
        <button type="button" class="sm-tool-btn" data-skel-bind-pose>Bind Pose</button>
      </div>
      <div class="sm-tool-sep"></div>
      <div class="sm-tool-group sm-tool-modes" aria-label="Socket transform mode">
        <button type="button" class="sm-tool-btn sm-mode-btn ${this.socketGizmoMode === "translate" ? "is-active" : ""}" data-skel-socket-mode="translate" title="Move Socket">✥</button>
        <button type="button" class="sm-tool-btn sm-mode-btn ${this.socketGizmoMode === "rotate" ? "is-active" : ""}" data-skel-socket-mode="rotate" title="Rotate Socket">⟳</button>
        <button type="button" class="sm-tool-btn sm-mode-btn ${this.socketGizmoMode === "scale" ? "is-active" : ""}" data-skel-socket-mode="scale" title="Scale Socket">⤢</button>
      </div>
    `;
    this.toolbarHost.querySelectorAll<HTMLButtonElement>("[data-skel-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.skelMode === "animation" ? "animation" : "skeleton";
        if (nextMode !== this.mode && this.blendPreviewActive) this.stopBlendPreview();
        this.mode = nextMode;
        this.renderToolbar();
        this.renderDetails();
      });
    });
    this.toolbarHost
      .querySelector<HTMLInputElement>("[data-skel-show-skeleton]")
      ?.addEventListener("change", (event) => {
        this.showSkeleton = (event.target as HTMLInputElement).checked;
        if (this.skeletonHelper) this.skeletonHelper.visible = this.showSkeleton;
      });
    this.toolbarHost
      .querySelector<HTMLInputElement>("[data-skel-wireframe]")
      ?.addEventListener("change", (event) => {
        this.wireframe = (event.target as HTMLInputElement).checked;
        this.applyWireframe();
      });
    this.toolbarHost
      .querySelector<HTMLInputElement>("[data-skel-show-normals]")
      ?.addEventListener("change", (event) => {
        this.showNormals = (event.target as HTMLInputElement).checked;
        this.updateNormalVisibility();
      });
    this.toolbarHost.querySelector<HTMLButtonElement>("[data-skel-bind-pose]")?.addEventListener("click", () => {
      this.showBindPose();
    });
    this.toolbarHost.querySelectorAll<HTMLButtonElement>("[data-skel-socket-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        this.setSocketGizmoMode(button.dataset.skelSocketMode as SocketGizmoMode);
      });
    });
  }

  private renderDetails(): void {
    const modeBody = this.mode === "animation" ? this.renderAnimationDetails() : this.renderSkeletonDetails();
    this.detailsHost.innerHTML = `
      <div class="sm-details-heading">Details</div>
      ${modeBody}
      ${this.renderMorphDetails()}
      ${this.renderMeshDetails()}
    `;
    this.bindDetails();
  }

  private renderSkeletonDetails(): string {
    return `
      <div class="sm-section">
        <div class="sm-section-title">Skeleton Tree <span class="sm-count">${this.bones.length}</span></div>
        <div class="sm-bone-tree">
          ${
            this.boneRoots.length
              ? this.boneRoots.map((node) => this.renderBoneNode(node, 0)).join("")
              : `<div class="sm-empty">No bones found in this asset.</div>`
          }
        </div>
      </div>
      <div class="sm-section">
        <div class="sm-section-title">Selected Bone</div>
        ${
          this.selectedBone
            ? `
              <div class="sm-row"><span>Name</span><strong>${escapeHtml(this.selectedBone.name || "(unnamed)")}</strong></div>
              <div class="sm-row"><span>Children</span><strong>${this.selectedBone.children.filter((child) => child instanceof Bone).length}</strong></div>
              <div class="sm-row"><span>World Position</span><strong>${formatVec3(this.selectedBone.getWorldPosition(new Vector3()))}</strong></div>
            `
            : `<div class="sm-empty">Select a bone to inspect it in the viewport.</div>`
        }
      </div>
      <div class="sm-section">
        <div class="sm-section-title">Upper-Body Root</div>
        <div class="sm-row">
          <span>Current</span>
          <strong>${this.skeleton.upperBodyBone ? escapeHtml(this.skeleton.upperBodyBone) : "(none · full-body)"}</strong>
        </div>
        <label class="sm-row">
          <span>Node</span>
          <select data-skel-upper-root>${this.upperRootOptions(this.skeleton.upperBodyBone ?? "")}</select>
        </label>
        <div class="sm-prim-list">
          ${
            this.selectedBone?.name && this.selectedBone.name !== this.skeleton.upperBodyBone
              ? `<button type="button" class="sm-menu-item" data-skel-upper-root-set>Set “${escapeHtml(this.selectedBone.name)}” as Upper-Body Root</button>`
              : ""
          }
          ${
            this.skeleton.upperBodyBone
              ? `<button type="button" class="sm-menu-item" data-skel-upper-root-clear>Clear Upper-Body Root</button>`
              : ""
          }
        </div>
        <div class="sm-hint">Bones at/under this node blend to <strong>upperBody</strong> montages; the rest keep locomotion.</div>
      </div>
      <div class="sm-section">
        <div class="sm-section-title">Sockets <span class="sm-count">${this.skeleton.sockets.length}</span></div>
        <div class="sm-prim-list">
          ${
            this.selectedBone
              ? `<button type="button" class="sm-menu-item" data-skel-add-socket>Add Socket To ${escapeHtml(this.selectedBone.name || "Bone")}</button>`
              : `<div class="sm-empty">Select a bone before adding a socket.</div>`
          }
          ${
            this.skeleton.sockets.length
              ? this.skeleton.sockets.map((socket) => this.renderSocketRow(socket)).join("")
              : `<div class="sm-empty">No sockets authored yet.</div>`
          }
        </div>
      </div>
    `;
  }

  private renderSocketRow(socket: AssetSkeletonSocketDef): string {
    const selected = socket.name === this.selectedSocketName;
    const previewAsset = this.options.assets?.find((asset) => asset.id === socket.previewAssetId);
    return `
      <div class="sm-socket-row ${selected ? "is-selected" : ""}" data-skel-socket="${escapeHtml(socket.name)}">
        <button type="button" class="sm-socket-main" data-skel-socket-select="${escapeHtml(socket.name)}">
          <strong>${escapeHtml(socket.name)}</strong>
          <small>${escapeHtml(socket.bone)} · P ${formatVec3Array(socket.position)} · R ${formatVec3Array(socket.rotation)}</small>
        </button>
        <button type="button" class="sm-prim-del" data-skel-socket-delete="${escapeHtml(socket.name)}" title="Delete">✕</button>
      </div>
      ${
        selected
          ? `
            <label class="sm-row sm-socket-preview">
              <span>Preview Asset</span>
              <select data-skel-socket-preview="${escapeHtml(socket.name)}">
                ${this.socketPreviewOptions(socket.previewAssetId ?? "")}
              </select>
            </label>
            ${
              socket.previewAssetId && !previewAsset
                ? `<div class="sm-hint">Preview asset not found in the Content Browser manifest.</div>`
                : ""
            }
          `
          : ""
      }
    `;
  }

  private renderBoneNode(node: BoneNode, depth: number): string {
    const selected = this.selectedBone === node.bone;
    const index = this.bones.indexOf(node.bone);
    const name = node.bone.name || "(unnamed)";
    return `
      <button type="button" class="sm-bone-row ${selected ? "is-selected" : ""}" data-skel-bone-index="${index}" style="--bone-depth:${depth}">
        <span>${escapeHtml(name)}</span>
        <small>${node.children.length}</small>
      </button>
      ${node.children.map((child) => this.renderBoneNode(child, depth + 1)).join("")}
    `;
  }

  private renderAnimationDetails(): string {
    const clip = this.clips.find((item) => item.name === this.selectedClipName) ?? null;
    return `
      <div class="sm-section">
        <div class="sm-section-title">Animation Clips <span class="sm-count">${this.clips.length}</span></div>
        <div class="sm-prim-list">
          ${
            this.clips.length
              ? this.clips
                  .map(
                    (item) => `
                      <button type="button" class="sm-clip-row ${item.name === this.selectedClipName ? "is-selected" : ""}" data-skel-clip="${escapeHtml(item.name)}">
                        <span>${escapeHtml(item.name || "(unnamed)")}</span>
                        <small>${item.duration.toFixed(2)}s</small>
                      </button>
                    `,
                  )
                  .join("")
              : `<div class="sm-empty">No animation clips embedded in this GLTF.</div>`
          }
        </div>
      </div>
      <div class="sm-section">
        <div class="sm-section-title">Timeline</div>
        ${
          clip
            ? `
              <div class="sm-anim-controls">
                <button type="button" class="sm-tool-btn" data-skel-play>${this.playing ? "Pause" : "Play"}</button>
                <label class="sm-tool-check"><input type="checkbox" data-skel-loop ${this.loop ? "checked" : ""} /><span>Loop</span></label>
              </div>
              <input class="sm-timeline" type="range" min="0" max="${clip.duration}" step="0.001" value="${this.action?.time ?? 0}" data-skel-time />
              <div class="sm-row">
                <span>Time</span>
                <strong data-skel-time-label>${(this.action?.time ?? 0).toFixed(2)} / ${clip.duration.toFixed(2)}s</strong>
              </div>
              <label class="sm-row">
                <span>Play Rate</span>
                <input type="text" data-skel-rate value="${this.playRate.toFixed(2)}" />
              </label>
              <label class="sm-row">
                <span>Crossfade</span>
                <input type="text" data-skel-crossfade value="${this.crossfadeDuration.toFixed(2)}" />
              </label>
            `
            : `<div class="sm-empty">Select a clip to preview animation.</div>`
        }
      </div>
      <div class="sm-section">
        <div class="sm-section-title">Animation Set</div>
        ${
          this.clips.length
            ? ANIMATION_SET_ROLES.map(
                (role) => `
                  <label class="sm-row">
                    <span>${formatRoleLabel(role)}</span>
                    <select data-skel-role="${role}">
                      ${this.clipOptions(this.skeleton.animationSet[role] ?? "")}
                    </select>
                  </label>
                `,
              ).join("")
            : `<div class="sm-empty">No clips available for role mapping.</div>`
        }
      </div>
      ${this.renderBlendSpaceDetails()}
      ${this.renderMontageDetails()}
    `;
  }

  private renderBlendSpaceDetails(): string {
    const selected = this.getSelectedBlendSpace();
    return `
      <div class="sm-section">
        <div class="sm-section-title">Blend Spaces <span class="sm-count">${this.skeleton.blendSpaces.length}</span></div>
        <div class="sm-prim-list">
          ${
            this.clips.length
              ? `<button type="button" class="sm-menu-item" data-skel-blend-add>Add Blend Space</button>`
              : `<div class="sm-empty">Import a clip before authoring a blend space.</div>`
          }
          ${
            this.skeleton.blendSpaces.length
              ? this.skeleton.blendSpaces.map((blend) => this.renderBlendSpaceRow(blend)).join("")
              : `<div class="sm-empty">No blend spaces authored yet.</div>`
          }
        </div>
      </div>
      ${selected ? this.renderBlendSpaceEditor(selected) : ""}
    `;
  }

  private renderBlendSpaceRow(blend: AssetSkeletonBlendSpaceDef): string {
    const isSelected = blend.name === this.selectedBlendSpaceName;
    return `
      <div class="sm-socket-row ${isSelected ? "is-selected" : ""}">
        <button type="button" class="sm-socket-main" data-skel-blend-select="${escapeHtml(blend.name)}">
          <strong>${escapeHtml(blend.name)}</strong>
          <small>${blend.type.toUpperCase()} · ${blend.samples.length} sample${blend.samples.length === 1 ? "" : "s"}</small>
        </button>
        <button type="button" class="sm-prim-del" data-skel-blend-delete="${escapeHtml(blend.name)}" title="Delete">✕</button>
      </div>
    `;
  }

  private renderBlendSpaceEditor(blend: AssetSkeletonBlendSpaceDef): string {
    return `
      <div class="sm-section sm-blend-editor">
        <div class="sm-section-title">Edit “${escapeHtml(blend.name)}”</div>
        <label class="sm-row"><span>Name</span><input type="text" data-skel-blend-name value="${escapeHtml(blend.name)}" /></label>
        <label class="sm-row">
          <span>Type</span>
          <select data-skel-blend-type>
            ${BLEND_SPACE_TYPES.map(
              (type) => `<option value="${type}" ${type === blend.type ? "selected" : ""}>${type === "1d" ? "1D (single axis)" : "2D (two axes)"}</option>`,
            ).join("")}
          </select>
        </label>
        ${this.renderBlendAxisFields("x", blend.axisX)}
        ${blend.type === "2d" && blend.axisY ? this.renderBlendAxisFields("y", blend.axisY) : ""}
        <div class="sm-section-title">Samples <span class="sm-count">${blend.samples.length}</span></div>
        <div class="sm-prim-list">
          ${
            blend.samples.length
              ? blend.samples.map((sample, index) => this.renderBlendSampleRow(blend, sample, index)).join("")
              : `<div class="sm-empty">Add a sample to place a clip on the axis.</div>`
          }
          <button type="button" class="sm-menu-item" data-skel-blend-sample-add>Add Sample</button>
        </div>
        ${this.renderBlendPreview(blend)}
      </div>
    `;
  }

  private renderBlendAxisFields(axis: "x" | "y", def: BlendSpaceAxisDef): string {
    const label = axis === "x" ? "Axis X" : "Axis Y";
    return `
      <div class="sm-blend-axis">
        <div class="sm-blend-axis-label">${label}</div>
        <label class="sm-row"><span>Name</span><input type="text" data-skel-blend-axis="${axis}" data-skel-blend-axis-field="name" value="${escapeHtml(def.name)}" /></label>
        <label class="sm-row"><span>Min</span><input type="text" data-skel-blend-axis="${axis}" data-skel-blend-axis-field="min" value="${def.min}" /></label>
        <label class="sm-row"><span>Max</span><input type="text" data-skel-blend-axis="${axis}" data-skel-blend-axis-field="max" value="${def.max}" /></label>
      </div>
    `;
  }

  private renderBlendSampleRow(
    blend: AssetSkeletonBlendSpaceDef,
    sample: { clip: string; x: number; y?: number },
    index: number,
  ): string {
    return `
      <div class="sm-blend-sample">
        <select data-skel-blend-sample-clip="${index}">
          ${this.blendSampleClipOptions(sample.clip)}
        </select>
        <label class="sm-blend-coord"><span>${escapeHtml(blend.axisX.name || "X")}</span><input type="text" data-skel-blend-sample-coord="${index}" data-skel-blend-coord-axis="x" value="${sample.x}" /></label>
        ${
          blend.type === "2d"
            ? `<label class="sm-blend-coord"><span>${escapeHtml(blend.axisY?.name || "Y")}</span><input type="text" data-skel-blend-sample-coord="${index}" data-skel-blend-coord-axis="y" value="${sample.y ?? 0}" /></label>`
            : ""
        }
        <button type="button" class="sm-prim-del" data-skel-blend-sample-delete="${index}" title="Delete sample">✕</button>
      </div>
    `;
  }

  private renderBlendPreview(blend: AssetSkeletonBlendSpaceDef): string {
    const active = this.blendPreviewActive && this.selectedBlendSpaceName === blend.name;
    const canPreview = blend.samples.some((sample) => this.clips.some((clip) => clip.name === sample.clip));
    return `
      <div class="sm-section-title">Preview</div>
      <div class="sm-anim-controls">
        <button type="button" class="sm-tool-btn ${active ? "is-active" : ""}" data-skel-blend-preview ${canPreview ? "" : "disabled"}>
          ${active ? "Stop Preview" : "Preview Blend"}
        </button>
      </div>
      ${
        active
          ? `
            <label class="sm-row sm-blend-param">
              <span>${escapeHtml(blend.axisX.name || "X")}</span>
              <input type="range" min="${blend.axisX.min}" max="${blend.axisX.max}" step="0.01" value="${this.blendPreviewParams.x}" data-skel-blend-param="x" />
            </label>
            ${
              blend.type === "2d" && blend.axisY
                ? `<label class="sm-row sm-blend-param"><span>${escapeHtml(blend.axisY.name || "Y")}</span><input type="range" min="${blend.axisY.min}" max="${blend.axisY.max}" step="0.01" value="${this.blendPreviewParams.y}" data-skel-blend-param="y" /></label>`
                : ""
            }
            <div class="sm-blend-weights" data-skel-blend-weights>${escapeHtml(this.describeBlendWeights(blend))}</div>
          `
          : !canPreview
            ? `<div class="sm-hint">Assign clips that exist in this asset to preview the blend.</div>`
            : ""
      }
    `;
  }

  private renderMontageDetails(): string {
    const selected = this.getSelectedMontage();
    return `
      <div class="sm-section">
        <div class="sm-section-title">Montages <span class="sm-count">${this.skeleton.montages.length}</span></div>
        <div class="sm-prim-list">
          ${
            this.clips.length
              ? `<button type="button" class="sm-menu-item" data-skel-montage-add>Add Montage</button>`
              : `<div class="sm-empty">Import a clip before authoring a montage.</div>`
          }
          ${
            this.skeleton.montages.length
              ? this.skeleton.montages.map((montage) => this.renderMontageRow(montage)).join("")
              : `<div class="sm-empty">No montages authored yet.</div>`
          }
        </div>
        ${selected ? this.renderMontageEditor(selected) : ""}
        <div class="sm-hint">TPS convention: an <strong>upperBody</strong> montage named “aim” (held) and “fire” (one-shot) auto-bind to RMB/LMB in Play.</div>
      </div>
    `;
  }

  private renderMontageRow(montage: AssetSkeletonMontageDef): string {
    const isSelected = montage.name === this.selectedMontageName;
    const clipKnown = this.clips.some((clip) => clip.name === montage.clip);
    return `
      <div class="sm-socket-row ${isSelected ? "is-selected" : ""}">
        <button type="button" class="sm-socket-main" data-skel-montage-select="${escapeHtml(montage.name)}">
          <strong>${escapeHtml(montage.name)}</strong>
          <small>${escapeHtml(montage.clip)}${clipKnown ? "" : " (missing)"} · ${montage.slot === "fullBody" ? "Full Body" : "Upper Body"} · ${montage.loop ? "loop" : "one-shot"}</small>
        </button>
        <button type="button" class="sm-prim-del" data-skel-montage-delete="${escapeHtml(montage.name)}" title="Delete">✕</button>
      </div>
    `;
  }

  private renderMontageEditor(montage: AssetSkeletonMontageDef): string {
    return `
      <div class="sm-section sm-blend-editor">
        <div class="sm-section-title">Edit “${escapeHtml(montage.name)}”</div>
        <label class="sm-row"><span>Name</span><input type="text" data-skel-montage-name value="${escapeHtml(montage.name)}" /></label>
        <label class="sm-row">
          <span>Clip</span>
          <select data-skel-montage-clip>${this.blendSampleClipOptions(montage.clip)}</select>
        </label>
        <label class="sm-row">
          <span>Slot</span>
          <select data-skel-montage-slot>
            ${MONTAGE_SLOTS.map(
              (slot) => `<option value="${slot}" ${slot === montage.slot ? "selected" : ""}>${slot === "upperBody" ? "Upper Body" : "Full Body"}</option>`,
            ).join("")}
          </select>
        </label>
        <label class="sm-row sm-toggle"><input type="checkbox" data-skel-montage-loop ${montage.loop ? "checked" : ""} /><span>Loop while held</span></label>
        <label class="sm-row"><span>Blend In (s)</span><input type="text" data-skel-montage-blend="in" value="${montage.blendInSeconds}" /></label>
        <label class="sm-row"><span>Blend Out (s)</span><input type="text" data-skel-montage-blend="out" value="${montage.blendOutSeconds}" /></label>
        ${
          montage.slot === "upperBody" && !this.skeleton.upperBodyBone
            ? `<div class="sm-hint">Set an Upper-Body Root in Skeleton mode, or this montage plays full-body.</div>`
            : ""
        }
      </div>
    `;
  }

  private renderMeshDetails(): string {
    return `
      <div class="sm-section">
        <div class="sm-section-title">Mesh Stats</div>
        <div class="sm-row"><span>Meshes</span><strong>${this.stats.meshCount}</strong></div>
        <div class="sm-row"><span>Skinned Meshes</span><strong>${this.stats.skinnedMeshCount}</strong></div>
        <div class="sm-row"><span>Sections</span><strong>${this.stats.sectionCount}</strong></div>
        <div class="sm-row"><span>Vertices</span><strong>${this.stats.vertexCount.toLocaleString()}</strong></div>
        <div class="sm-row"><span>Triangles</span><strong>${this.stats.triangleCount.toLocaleString()}</strong></div>
        <div class="sm-row"><span>Materials</span><strong>${this.stats.materialCount}</strong></div>
        <div class="sm-row"><span>Bones</span><strong>${this.bones.length}</strong></div>
        <div class="sm-row"><span>Clips</span><strong>${this.clips.length}</strong></div>
      </div>
      <div class="sm-section">
        <div class="sm-section-title">Materials</div>
        ${
          this.materials.size
            ? [...this.materials]
                .map(
                  (material, index) => `
                    <div class="sm-row">
                      <span>Element ${index}</span>
                      <strong>${escapeHtml(material.name || material.type || "Material")}</strong>
                    </div>
                  `,
                )
                .join("")
            : `<div class="sm-empty">No materials found.</div>`
        }
      </div>
      <div class="sm-section">
        <div class="sm-section-title">Sections <span class="sm-count">${this.meshSections.length}</span></div>
        <div class="sm-prim-list">
          ${
            this.meshSections.length
              ? this.meshSections
                  .map(
                    (section) => `
                      <div class="sm-section-row">
                        <strong>${escapeHtml(section.meshName)}</strong>
                        <small>${escapeHtml(section.materialName)} · ${section.triangleCount.toLocaleString()} tris · ${section.vertexCount.toLocaleString()} verts${section.skinned ? " · skinned" : ""}</small>
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="sm-empty">No mesh sections found.</div>`
          }
        </div>
      </div>
    `;
  }

  private renderMorphDetails(): string {
    return `
      <div class="sm-section">
        <div class="sm-section-title">
          Morph Targets <span class="sm-count">${this.morphTargets.length}</span>
        </div>
        ${
          this.morphTargets.length
            ? `
              <div class="sm-prim-list">
                ${this.morphTargets
                  .map(
                    (target) => `
                      <label class="sm-morph-row">
                        <span title="${escapeHtml(target.name)}">${escapeHtml(target.name)}</span>
                        <input type="range" min="0" max="1" step="0.01" value="${this.morphValue(target).toFixed(2)}" data-skel-morph="${escapeHtml(target.key)}" />
                        <strong data-skel-morph-value="${escapeHtml(target.key)}">${this.morphValue(target).toFixed(2)}</strong>
                      </label>
                      <div class="sm-morph-meta">${escapeHtml(this.morphBindingLabel(target))}</div>
                    `,
                  )
                  .join("")}
                <button type="button" class="sm-menu-item" data-skel-morph-reset>Reset Morph Targets</button>
              </div>
            `
            : `<div class="sm-empty">No morph targets found in this asset.</div>`
        }
      </div>
    `;
  }

  private bindDetails(): void {
    this.detailsHost.querySelectorAll<HTMLButtonElement>("[data-skel-bone-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.skelBoneIndex);
        this.selectedBone = this.bones[index] ?? null;
        this.renderDetails();
      });
    });
    this.detailsHost.querySelector<HTMLButtonElement>("[data-skel-add-socket]")?.addEventListener("click", () => {
      this.addSocketToSelectedBone();
    });
    this.detailsHost.querySelectorAll<HTMLButtonElement>("[data-skel-socket-select]").forEach((button) => {
      button.addEventListener("click", () => this.selectSocket(button.dataset.skelSocketSelect ?? null));
    });
    this.detailsHost.querySelectorAll<HTMLButtonElement>("[data-skel-socket-delete]").forEach((button) => {
      button.addEventListener("click", () => this.deleteSocket(button.dataset.skelSocketDelete ?? ""));
    });
    this.detailsHost.querySelectorAll<HTMLSelectElement>("[data-skel-socket-preview]").forEach((select) => {
      select.addEventListener("change", () => {
        this.setSocketPreviewAsset(select.dataset.skelSocketPreview ?? "", select.value);
      });
    });
    this.detailsHost.querySelectorAll<HTMLButtonElement>("[data-skel-clip]").forEach((button) => {
      button.addEventListener("click", () =>
        this.selectClip(button.dataset.skelClip ?? "", { autoplay: true, crossfade: true }),
      );
    });
    this.detailsHost.querySelector<HTMLButtonElement>("[data-skel-play]")?.addEventListener("click", () => {
      this.togglePlayback();
    });
    this.detailsHost.querySelector<HTMLInputElement>("[data-skel-loop]")?.addEventListener("change", (event) => {
      this.loop = (event.target as HTMLInputElement).checked;
      this.applyLoopMode();
    });
    this.detailsHost.querySelector<HTMLInputElement>("[data-skel-time]")?.addEventListener("input", (event) => {
      this.scrubTo(Number((event.target as HTMLInputElement).value));
    });
    this.detailsHost.querySelector<HTMLInputElement>("[data-skel-rate]")?.addEventListener("change", (event) => {
      const next = Number((event.target as HTMLInputElement).value);
      this.playRate = Number.isFinite(next) ? clamp(next, 0.05, 4) : 1;
      this.renderDetails();
    });
    this.detailsHost.querySelector<HTMLInputElement>("[data-skel-crossfade]")?.addEventListener("change", (event) => {
      const next = Number((event.target as HTMLInputElement).value);
      this.crossfadeDuration = Number.isFinite(next) ? clamp(next, 0, 2) : 0.2;
      this.renderDetails();
    });
    this.detailsHost.querySelectorAll<HTMLSelectElement>("[data-skel-role]").forEach((select) => {
      select.addEventListener("change", () => {
        this.setAnimationRole(select.dataset.skelRole as AnimationSetRole, select.value);
      });
    });
    this.detailsHost.querySelectorAll<HTMLInputElement>("[data-skel-morph]").forEach((input) => {
      input.addEventListener("input", () => {
        this.setMorphTarget(input.dataset.skelMorph ?? "", Number(input.value));
      });
    });
    this.detailsHost.querySelector<HTMLButtonElement>("[data-skel-morph-reset]")?.addEventListener("click", () => {
      this.resetMorphTargets();
    });
    this.detailsHost.querySelector<HTMLSelectElement>("[data-skel-upper-root]")?.addEventListener("change", (event) => {
      this.setUpperBodyBone((event.target as HTMLSelectElement).value || null);
    });
    this.detailsHost.querySelector<HTMLButtonElement>("[data-skel-upper-root-set]")?.addEventListener("click", () => {
      this.setUpperBodyBone(this.selectedBone?.name ?? null);
    });
    this.detailsHost.querySelector<HTMLButtonElement>("[data-skel-upper-root-clear]")?.addEventListener("click", () => {
      this.setUpperBodyBone(null);
    });
    this.bindBlendSpaceControls();
    this.bindMontageControls();
  }

  private bindBlendSpaceControls(): void {
    this.detailsHost.querySelector<HTMLButtonElement>("[data-skel-blend-add]")?.addEventListener("click", () => {
      this.addBlendSpace();
    });
    this.detailsHost.querySelectorAll<HTMLButtonElement>("[data-skel-blend-select]").forEach((button) => {
      button.addEventListener("click", () => this.selectBlendSpace(button.dataset.skelBlendSelect ?? null));
    });
    this.detailsHost.querySelectorAll<HTMLButtonElement>("[data-skel-blend-delete]").forEach((button) => {
      button.addEventListener("click", () => this.deleteBlendSpace(button.dataset.skelBlendDelete ?? ""));
    });
    this.detailsHost.querySelector<HTMLInputElement>("[data-skel-blend-name]")?.addEventListener("change", (event) => {
      this.renameBlendSpace((event.target as HTMLInputElement).value);
    });
    this.detailsHost.querySelector<HTMLSelectElement>("[data-skel-blend-type]")?.addEventListener("change", (event) => {
      this.setBlendSpaceType((event.target as HTMLSelectElement).value as BlendSpaceType);
    });
    this.detailsHost.querySelectorAll<HTMLInputElement>("[data-skel-blend-axis]").forEach((input) => {
      input.addEventListener("change", () => {
        this.setBlendAxisField(
          input.dataset.skelBlendAxis as "x" | "y",
          input.dataset.skelBlendAxisField as "name" | "min" | "max",
          input.value,
        );
      });
    });
    this.detailsHost.querySelector<HTMLButtonElement>("[data-skel-blend-sample-add]")?.addEventListener("click", () => {
      this.addBlendSample();
    });
    this.detailsHost.querySelectorAll<HTMLSelectElement>("[data-skel-blend-sample-clip]").forEach((select) => {
      select.addEventListener("change", () => {
        this.setBlendSampleClip(Number(select.dataset.skelBlendSampleClip), select.value);
      });
    });
    this.detailsHost.querySelectorAll<HTMLInputElement>("[data-skel-blend-sample-coord]").forEach((input) => {
      input.addEventListener("change", () => {
        this.setBlendSampleCoord(
          Number(input.dataset.skelBlendSampleCoord),
          input.dataset.skelBlendCoordAxis as "x" | "y",
          Number(input.value),
        );
      });
    });
    this.detailsHost.querySelectorAll<HTMLButtonElement>("[data-skel-blend-sample-delete]").forEach((button) => {
      button.addEventListener("click", () => this.deleteBlendSample(Number(button.dataset.skelBlendSampleDelete)));
    });
    this.detailsHost.querySelector<HTMLButtonElement>("[data-skel-blend-preview]")?.addEventListener("click", () => {
      this.toggleBlendPreview();
    });
    this.detailsHost.querySelectorAll<HTMLInputElement>("[data-skel-blend-param]").forEach((input) => {
      input.addEventListener("input", () => {
        this.setBlendPreviewParam(input.dataset.skelBlendParam as "x" | "y", Number(input.value));
      });
    });
  }

  private bindMontageControls(): void {
    this.detailsHost.querySelector<HTMLButtonElement>("[data-skel-montage-add]")?.addEventListener("click", () => {
      this.addMontage();
    });
    this.detailsHost.querySelectorAll<HTMLButtonElement>("[data-skel-montage-select]").forEach((button) => {
      button.addEventListener("click", () => this.selectMontage(button.dataset.skelMontageSelect ?? null));
    });
    this.detailsHost.querySelectorAll<HTMLButtonElement>("[data-skel-montage-delete]").forEach((button) => {
      button.addEventListener("click", () => this.deleteMontage(button.dataset.skelMontageDelete ?? ""));
    });
    this.detailsHost.querySelector<HTMLInputElement>("[data-skel-montage-name]")?.addEventListener("change", (event) => {
      this.renameMontage((event.target as HTMLInputElement).value);
    });
    this.detailsHost.querySelector<HTMLSelectElement>("[data-skel-montage-clip]")?.addEventListener("change", (event) => {
      this.setMontageClip((event.target as HTMLSelectElement).value);
    });
    this.detailsHost.querySelector<HTMLSelectElement>("[data-skel-montage-slot]")?.addEventListener("change", (event) => {
      this.setMontageSlot((event.target as HTMLSelectElement).value as MontageSlot);
    });
    this.detailsHost.querySelector<HTMLInputElement>("[data-skel-montage-loop]")?.addEventListener("change", (event) => {
      this.setMontageLoop((event.target as HTMLInputElement).checked);
    });
    this.detailsHost.querySelectorAll<HTMLInputElement>("[data-skel-montage-blend]").forEach((input) => {
      input.addEventListener("change", () => {
        this.setMontageBlend(input.dataset.skelMontageBlend as "in" | "out", input.value);
      });
    });
  }

  private morphValue(target: MorphTargetControl): number {
    const first = target.bindings[0];
    return first?.mesh.morphTargetInfluences?.[first.index] ?? 0;
  }

  private morphBindingLabel(target: MorphTargetControl): string {
    const meshes = [...new Set(target.bindings.map((binding) => binding.meshName))];
    return meshes.length === 1 ? meshes[0]! : `${meshes.length} meshes`;
  }

  private setMorphTarget(key: string, value: number): void {
    const target = this.morphTargets.find((item) => item.key === key);
    if (!target) return;
    const next = clamp(value, 0, 1);
    for (const binding of target.bindings) {
      if (!binding.mesh.morphTargetInfluences) continue;
      binding.mesh.morphTargetInfluences[binding.index] = next;
    }
    const label = [...this.detailsHost.querySelectorAll<HTMLElement>("[data-skel-morph-value]")]
      .find((item) => item.dataset.skelMorphValue === key);
    if (label) label.textContent = next.toFixed(2);
  }

  private resetMorphTargets(): void {
    for (const target of this.morphTargets) this.setMorphTarget(target.key, 0);
    this.renderDetails();
  }

  private rebuildSocketOverlays(): void {
    this.transformControls?.detach();
    this.disposeSocketOverlays();
    for (const socket of this.skeleton.sockets) {
      const bone = this.bones.find((item) => item.name === socket.bone);
      if (!bone) continue;
      const root = new Group();
      root.name = `Socket:${socket.name}`;
      applySocketTransform(root, socket);
      const marker = new Mesh(
        new SphereGeometry(0.04, 14, 8),
        new MeshBasicMaterial({ color: socket.name === this.selectedSocketName ? 0xffb648 : 0x7ac7ff, depthTest: false }),
      );
      marker.renderOrder = 5;
      root.add(marker);
      bone.add(root);
      const overlay: SocketOverlay = { root, marker, socket, previewRoot: null, previewAssetId: null };
      this.socketOverlays.push(overlay);
      void this.attachSocketPreview(overlay);
    }
    this.attachSelectedSocketGizmo();
  }

  private disposeSocketOverlays(): void {
    for (const overlay of this.socketOverlays) {
      this.clearSocketPreview(overlay);
      overlay.root.removeFromParent();
      overlay.marker.geometry.dispose();
      if (Array.isArray(overlay.marker.material)) {
        for (const material of overlay.marker.material) material.dispose();
      } else {
        overlay.marker.material.dispose();
      }
    }
    this.socketOverlays.length = 0;
  }

  private addSocketToSelectedBone(): void {
    if (!this.selectedBone?.name) return;
    const base = `${this.selectedBone.name}_socket`;
    const taken = new Set(this.skeleton.sockets.map((socket) => socket.name));
    let name = base;
    for (let index = 2; taken.has(name); index += 1) name = `${base}_${index}`;
    const socket: AssetSkeletonSocketDef = {
      name,
      bone: this.selectedBone.name,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    this.skeleton = { ...this.skeleton, sockets: [...this.skeleton.sockets, socket] };
    this.selectedSocketName = name;
    this.rebuildSocketOverlays();
    this.markDirty();
    this.renderToolbar();
    this.renderDetails();
    this.setStatus(`Added socket ${name}.`);
  }

  private selectSocket(name: string | null): void {
    this.selectedSocketName = name;
    const socket = name ? this.skeleton.sockets.find((item) => item.name === name) : null;
    const bone = socket ? this.bones.find((item) => item.name === socket.bone) : null;
    if (bone) this.selectedBone = bone;
    this.updateSocketSelectionVisuals();
    this.attachSelectedSocketGizmo();
    this.renderDetails();
  }

  private deleteSocket(name: string): void {
    if (!name) return;
    this.skeleton = {
      ...this.skeleton,
      sockets: this.skeleton.sockets.filter((socket) => socket.name !== name),
    };
    if (this.selectedSocketName === name) this.selectedSocketName = null;
    this.rebuildSocketOverlays();
    this.markDirty();
    this.renderDetails();
    this.setStatus(`Deleted socket ${name}.`);
  }

  private setSocketPreviewAsset(socketName: string, assetId: string): void {
    if (!socketName) return;
    const sockets = this.skeleton.sockets.map((socket) => {
      if (socket.name !== socketName) return socket;
      if (!assetId) {
        const next = { ...socket };
        delete next.previewAssetId;
        return next;
      }
      return { ...socket, previewAssetId: assetId };
    });
    this.skeleton = { ...this.skeleton, sockets };
    const overlay = this.socketOverlays.find((item) => item.socket.name === socketName);
    const nextSocket = sockets.find((socket) => socket.name === socketName);
    if (overlay && nextSocket) {
      overlay.socket = nextSocket;
      void this.attachSocketPreview(overlay);
    }
    this.markDirty();
    this.renderDetails();
  }

  private attachSelectedSocketGizmo(): void {
    const overlay = this.socketOverlays.find((item) => item.socket.name === this.selectedSocketName);
    if (!overlay) {
      this.transformControls?.detach();
      return;
    }
    this.transformControls?.attach(overlay.root);
    this.transformControls?.setMode(this.socketGizmoMode);
    this.updateSocketSelectionVisuals();
  }

  private setSocketGizmoMode(mode: SocketGizmoMode): void {
    if (mode !== "translate" && mode !== "rotate" && mode !== "scale") return;
    this.socketGizmoMode = mode;
    this.transformControls?.setMode(mode);
    this.renderToolbar();
  }

  private commitSelectedSocketFromGizmo(options: { quiet?: boolean } = {}): void {
    const overlay = this.socketOverlays.find((item) => item.socket.name === this.selectedSocketName);
    if (!overlay) return;
    const sockets = this.skeleton.sockets.map((socket) =>
      socket.name === overlay.socket.name ? socketFromObject(overlay.root, socket) : socket,
    );
    this.skeleton = { ...this.skeleton, sockets };
    overlay.socket = sockets.find((socket) => socket.name === overlay.socket.name) ?? overlay.socket;
    if (!options.quiet) {
      this.markDirty();
      this.renderDetails();
    } else {
      this.markDirty();
    }
  }

  private updateSocketSelectionVisuals(): void {
    for (const overlay of this.socketOverlays) {
      const selected = overlay.socket.name === this.selectedSocketName;
      if (overlay.marker.material instanceof MeshBasicMaterial) {
        overlay.marker.material.color.setHex(selected ? 0xffb648 : 0x7ac7ff);
      }
    }
  }

  private async attachSocketPreview(overlay: SocketOverlay): Promise<void> {
    const assetId = overlay.socket.previewAssetId ?? "";
    this.clearSocketPreview(overlay);
    if (!assetId) return;
    const asset = this.previewModelAssets().find((item) => item.id === assetId);
    if (!asset) {
      this.setStatus(`Socket preview asset not found: ${assetId}`, "warning");
      return;
    }
    overlay.previewAssetId = asset.id;
    try {
      const gltf = await this.loader.loadAsync(projectFileUrl(asset.path));
      if (
        this.disposed ||
        overlay.previewAssetId !== asset.id ||
        overlay.socket.previewAssetId !== asset.id ||
        !this.socketOverlays.includes(overlay)
      ) {
        disposeObject3D(gltf.scene);
        return;
      }
      gltf.scene.name = `SocketPreview:${asset.name}`;
      overlay.previewRoot = gltf.scene;
      overlay.root.add(gltf.scene);
    } catch (error) {
      if (!this.disposed) {
        this.setStatus(`Socket preview failed: ${describeError(error)}`, "warning");
      }
      overlay.previewAssetId = null;
    }
  }

  private clearSocketPreview(overlay: SocketOverlay): void {
    if (overlay.previewRoot) {
      overlay.previewRoot.removeFromParent();
      disposeObject3D(overlay.previewRoot);
      overlay.previewRoot = null;
    }
    overlay.previewAssetId = null;
  }

  private previewModelAssets(): AssetPickerItem[] {
    return (this.options.assets ?? []).filter(
      (asset) => asset.assetType === "staticMesh" || asset.assetType === "skeletalMesh",
    );
  }

  private clipOptions(selected: string): string {
    return [`<option value="" ${selected ? "" : "selected"}>None</option>`]
      .concat(
        this.clips.map(
          (clip) =>
            `<option value="${escapeHtml(clip.name)}" ${
              clip.name === selected ? "selected" : ""
            }>${escapeHtml(clip.name)}</option>`,
        ),
      )
      .join("");
  }

  private blendSampleClipOptions(selected: string): string {
    const known = this.clips.some((clip) => clip.name === selected);
    const missing =
      selected && !known
        ? `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} (missing)</option>`
        : "";
    return (
      missing +
      this.clips
        .map(
          (clip) =>
            `<option value="${escapeHtml(clip.name)}" ${
              clip.name === selected ? "selected" : ""
            }>${escapeHtml(clip.name)}</option>`,
        )
        .join("")
    );
  }

  private socketPreviewOptions(selected: string): string {
    return [`<option value="" ${selected ? "" : "selected"}>None</option>`]
      .concat(
        this.previewModelAssets().map(
          (asset) =>
            `<option value="${escapeHtml(asset.id)}" ${
              asset.id === selected ? "selected" : ""
            }>${escapeHtml(asset.name)}</option>`,
        ),
      )
      .join("");
  }

  private upperRootOptions(selected: string): string {
    const known = !selected || this.nodeNames.includes(selected);
    const missing =
      selected && !known
        ? `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} (missing)</option>`
        : "";
    const none = `<option value="" ${selected ? "" : "selected"}>None (full-body)</option>`;
    return (
      none +
      missing +
      this.nodeNames
        .map(
          (name) =>
            `<option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(name)}</option>`,
        )
        .join("")
    );
  }

  private setUpperBodyBone(name: string | null): void {
    const next = name && name.length > 0 ? name : undefined;
    if (next === this.skeleton.upperBodyBone) return;
    const skeleton: AssetSkeletonDef = { ...this.skeleton };
    if (next) skeleton.upperBodyBone = next;
    else delete skeleton.upperBodyBone;
    this.skeleton = skeleton;
    this.markDirty();
    this.renderDetails();
    this.setStatus(next ? `Upper-body root set to ${next}.` : "Upper-body root cleared.");
  }

  private setAnimationRole(role: AnimationSetRole, clipName: string): void {
    if (!ANIMATION_SET_ROLES.includes(role)) return;
    const animationSet: Partial<Record<AnimationSetRole, string>> = { ...this.skeleton.animationSet };
    if (clipName) animationSet[role] = clipName;
    else delete animationSet[role];
    this.skeleton = { ...this.skeleton, animationSet };
    this.markDirty();
    this.renderDetails();
  }

  private getSelectedBlendSpace(): AssetSkeletonBlendSpaceDef | null {
    if (!this.selectedBlendSpaceName) return null;
    return this.skeleton.blendSpaces.find((blend) => blend.name === this.selectedBlendSpaceName) ?? null;
  }

  private replaceSelectedBlendSpace(next: AssetSkeletonBlendSpaceDef): void {
    const current = this.selectedBlendSpaceName;
    if (!current) return;
    this.skeleton = {
      ...this.skeleton,
      blendSpaces: this.skeleton.blendSpaces.map((blend) => (blend.name === current ? next : blend)),
    };
    this.selectedBlendSpaceName = next.name;
    this.markDirty();
  }

  private addBlendSpace(): void {
    const taken = new Set(this.skeleton.blendSpaces.map((blend) => blend.name));
    let name = "BlendSpace";
    for (let index = 2; taken.has(name); index += 1) name = `BlendSpace_${index}`;
    const blend: AssetSkeletonBlendSpaceDef = {
      name,
      type: "1d",
      axisX: { ...defaultBlendSpaceAxis("Speed"), max: 4 },
      samples: [],
    };
    this.skeleton = { ...this.skeleton, blendSpaces: [...this.skeleton.blendSpaces, blend] };
    this.selectedBlendSpaceName = name;
    this.markDirty();
    this.renderDetails();
    this.setStatus(`Added blend space ${name}.`);
  }

  private selectBlendSpace(name: string | null): void {
    if (this.blendPreviewActive) this.stopBlendPreview();
    this.selectedBlendSpaceName = name;
    this.renderDetails();
  }

  private deleteBlendSpace(name: string): void {
    if (!name) return;
    if (this.blendPreviewActive && this.selectedBlendSpaceName === name) this.stopBlendPreview();
    this.skeleton = {
      ...this.skeleton,
      blendSpaces: this.skeleton.blendSpaces.filter((blend) => blend.name !== name),
    };
    if (this.selectedBlendSpaceName === name) this.selectedBlendSpaceName = null;
    this.markDirty();
    this.renderDetails();
    this.setStatus(`Deleted blend space ${name}.`);
  }

  private renameBlendSpace(rawName: string): void {
    const blend = this.getSelectedBlendSpace();
    if (!blend) return;
    const name = rawName.trim();
    const collision = this.skeleton.blendSpaces.some(
      (other) => other !== blend && other.name === name,
    );
    if (!name || collision) {
      this.setStatus(
        !name ? "Blend space name cannot be empty." : `Blend space "${name}" already exists.`,
        "warning",
      );
      this.renderDetails();
      return;
    }
    this.replaceSelectedBlendSpace({ ...blend, name });
    this.renderDetails();
  }

  private setBlendSpaceType(type: BlendSpaceType): void {
    const blend = this.getSelectedBlendSpace();
    if (!blend || blend.type === type) return;
    if (type === "2d") {
      const axisY = blend.axisY ?? { name: "Direction", min: -1, max: 1 };
      const samples = blend.samples.map((sample) => ({ ...sample, y: sample.y ?? axisY.min }));
      this.replaceSelectedBlendSpace({ ...blend, type, axisY, samples });
    } else {
      const samples = blend.samples.map(({ clip, x }) => ({ clip, x }));
      this.replaceSelectedBlendSpace({ name: blend.name, type, axisX: blend.axisX, samples });
    }
    this.refreshBlendPreviewIfActive();
    this.renderDetails();
  }

  private setBlendAxisField(axis: "x" | "y", field: "name" | "min" | "max", value: string): void {
    const blend = this.getSelectedBlendSpace();
    if (!blend) return;
    const current = axis === "x" ? blend.axisX : blend.axisY;
    if (!current) return;
    let nextAxis: BlendSpaceAxisDef;
    if (field === "name") {
      nextAxis = { ...current, name: value.trim() || current.name };
    } else {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        this.renderDetails();
        return;
      }
      nextAxis = { ...current, [field]: numeric };
      if (nextAxis.max <= nextAxis.min) {
        nextAxis = field === "max" ? { ...nextAxis, max: nextAxis.min + 1 } : { ...nextAxis, min: nextAxis.max - 1 };
      }
    }
    const next =
      axis === "x"
        ? { ...blend, axisX: nextAxis, samples: clampSamplesToAxis(blend.samples, nextAxis, "x") }
        : { ...blend, axisY: nextAxis, samples: clampSamplesToAxis(blend.samples, nextAxis, "y") };
    this.replaceSelectedBlendSpace(next);
    this.renderDetails();
  }

  private addBlendSample(): void {
    const blend = this.getSelectedBlendSpace();
    if (!blend) return;
    const clip = this.clips[0]?.name ?? "";
    if (!clip) {
      this.setStatus("No clips available to place in the blend space.", "warning");
      return;
    }
    const sample: { clip: string; x: number; y?: number } = {
      clip,
      x: round(axisMidpoint(blend.axisX)),
    };
    if (blend.type === "2d" && blend.axisY) sample.y = round(axisMidpoint(blend.axisY));
    this.replaceSelectedBlendSpace({ ...blend, samples: [...blend.samples, sample] });
    this.refreshBlendPreviewIfActive();
    this.renderDetails();
  }

  private setBlendSampleClip(index: number, clip: string): void {
    const blend = this.getSelectedBlendSpace();
    if (!blend || !blend.samples[index]) return;
    const samples = blend.samples.map((sample, i) => (i === index ? { ...sample, clip } : sample));
    this.replaceSelectedBlendSpace({ ...blend, samples });
    this.refreshBlendPreviewIfActive();
    this.renderDetails();
  }

  private setBlendSampleCoord(index: number, axis: "x" | "y", value: number): void {
    const blend = this.getSelectedBlendSpace();
    if (!blend || !blend.samples[index] || !Number.isFinite(value)) {
      this.renderDetails();
      return;
    }
    const domain = axis === "x" ? blend.axisX : blend.axisY;
    if (!domain) return;
    const clamped = round(Math.min(Math.max(value, domain.min), domain.max));
    const samples = blend.samples.map((sample, i) => (i === index ? { ...sample, [axis]: clamped } : sample));
    this.replaceSelectedBlendSpace({ ...blend, samples });
    this.renderDetails();
  }

  private deleteBlendSample(index: number): void {
    const blend = this.getSelectedBlendSpace();
    if (!blend || !blend.samples[index]) return;
    const samples = blend.samples.filter((_, i) => i !== index);
    this.replaceSelectedBlendSpace({ ...blend, samples });
    this.refreshBlendPreviewIfActive();
    this.renderDetails();
  }

  private toggleBlendPreview(): void {
    if (this.blendPreviewActive) this.stopBlendPreview();
    else this.startBlendPreview();
    this.renderDetails();
  }

  private startBlendPreview(): void {
    const blend = this.getSelectedBlendSpace();
    if (!blend || !this.mixer) return;
    this.playing = false;
    this.action?.stop();
    this.mixer.stopAllAction();
    this.blendPreviewActive = true;
    this.blendPreviewPhase = 0;
    this.blendPreviewParams.x = blend.axisX.min;
    this.blendPreviewParams.y = blend.axisY ? blend.axisY.min : 0;
    this.clock.getDelta();
    this.rebuildBlendPreviewActions();
    this.setStatus(`Previewing blend space ${blend.name}.`);
  }

  private stopBlendPreview(): void {
    if (!this.blendPreviewActive) return;
    this.blendPreviewActive = false;
    this.clearBlendPreviewActions();
    this.mixer?.stopAllAction();
    for (const mesh of this.skinnedMeshes) mesh.skeleton.pose();
  }

  private refreshBlendPreviewIfActive(): void {
    if (this.blendPreviewActive) this.rebuildBlendPreviewActions();
  }

  private rebuildBlendPreviewActions(): void {
    this.clearBlendPreviewActions();
    const blend = this.getSelectedBlendSpace();
    if (!blend || !this.mixer) return;
    for (const clipName of new Set(blend.samples.map((sample) => sample.clip))) {
      const clip = this.clips.find((item) => item.name === clipName);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      action.reset();
      action.setLoop(LoopRepeat, Infinity);
      action.enabled = false;
      action.setEffectiveWeight(0);
      action.play();
      this.blendPreviewActions.set(clipName, action);
    }
  }

  private clearBlendPreviewActions(): void {
    for (const action of this.blendPreviewActions.values()) action.stop();
    this.blendPreviewActions.clear();
  }

  private updateBlendPreview(delta: number): void {
    const blend = this.getSelectedBlendSpace();
    if (!blend || !this.mixer || this.blendPreviewActions.size === 0) return;
    const weights = resolveBlendSpaceWeights(blend, this.blendPreviewParams);
    const weightByClip = new Map(weights.map((entry) => [entry.clip, entry.weight]));
    let refDuration = 0;
    for (const entry of weights) {
      const action = this.blendPreviewActions.get(entry.clip);
      if (action) refDuration += action.getClip().duration * entry.weight;
    }
    if (refDuration <= 1e-4) refDuration = 1;
    this.blendPreviewPhase = (this.blendPreviewPhase + (delta * this.playRate) / refDuration) % 1;
    for (const [clipName, action] of this.blendPreviewActions) {
      const weight = weightByClip.get(clipName) ?? 0;
      action.enabled = weight > 0;
      action.setEffectiveWeight(weight);
      action.time = this.blendPreviewPhase * action.getClip().duration;
    }
    this.mixer.update(0);
    const readout = this.detailsHost.querySelector<HTMLElement>("[data-skel-blend-weights]");
    if (readout) readout.textContent = this.describeBlendWeights(blend);
  }

  private setBlendPreviewParam(axis: "x" | "y", value: number): void {
    if (!Number.isFinite(value)) return;
    if (axis === "x") this.blendPreviewParams.x = value;
    else this.blendPreviewParams.y = value;
    const blend = this.getSelectedBlendSpace();
    const readout = this.detailsHost.querySelector<HTMLElement>("[data-skel-blend-weights]");
    if (blend && readout) readout.textContent = this.describeBlendWeights(blend);
  }

  private describeBlendWeights(blend: AssetSkeletonBlendSpaceDef): string {
    const weights = resolveBlendSpaceWeights(blend, this.blendPreviewParams).filter(
      (entry) => entry.weight > 0.001,
    );
    if (weights.length === 0) return "No clips contribute at this parameter.";
    return weights.map((entry) => `${entry.clip} ${Math.round(entry.weight * 100)}%`).join("  ·  ");
  }

  private getSelectedMontage(): AssetSkeletonMontageDef | null {
    if (!this.selectedMontageName) return null;
    return this.skeleton.montages.find((montage) => montage.name === this.selectedMontageName) ?? null;
  }

  private replaceSelectedMontage(next: AssetSkeletonMontageDef): void {
    const current = this.selectedMontageName;
    if (!current) return;
    this.skeleton = {
      ...this.skeleton,
      montages: this.skeleton.montages.map((montage) => (montage.name === current ? next : montage)),
    };
    this.selectedMontageName = next.name;
    this.markDirty();
  }

  private addMontage(): void {
    const clip = this.clips[0]?.name ?? "";
    if (!clip) {
      this.setStatus("No clips available to drive a montage.", "warning");
      return;
    }
    const taken = new Set(this.skeleton.montages.map((montage) => montage.name));
    let name = "montage";
    for (let index = 2; taken.has(name); index += 1) name = `montage_${index}`;
    const montage: AssetSkeletonMontageDef = {
      name,
      clip,
      slot: "upperBody",
      loop: false,
      blendInSeconds: 0.12,
      blendOutSeconds: 0.2,
    };
    this.skeleton = { ...this.skeleton, montages: [...this.skeleton.montages, montage] };
    this.selectedMontageName = name;
    this.markDirty();
    this.renderDetails();
    this.setStatus(`Added montage ${name}.`);
  }

  private selectMontage(name: string | null): void {
    this.selectedMontageName = name;
    this.renderDetails();
  }

  private deleteMontage(name: string): void {
    if (!name) return;
    this.skeleton = {
      ...this.skeleton,
      montages: this.skeleton.montages.filter((montage) => montage.name !== name),
    };
    if (this.selectedMontageName === name) this.selectedMontageName = null;
    this.markDirty();
    this.renderDetails();
    this.setStatus(`Deleted montage ${name}.`);
  }

  private renameMontage(rawName: string): void {
    const montage = this.getSelectedMontage();
    if (!montage) return;
    const name = rawName.trim();
    const collision = this.skeleton.montages.some((other) => other !== montage && other.name === name);
    if (!name || collision) {
      this.setStatus(
        !name ? "Montage name cannot be empty." : `Montage "${name}" already exists.`,
        "warning",
      );
      this.renderDetails();
      return;
    }
    this.replaceSelectedMontage({ ...montage, name });
    this.renderDetails();
  }

  private setMontageClip(clip: string): void {
    const montage = this.getSelectedMontage();
    if (!montage || !clip) return;
    this.replaceSelectedMontage({ ...montage, clip });
    this.renderDetails();
  }

  private setMontageSlot(slot: MontageSlot): void {
    const montage = this.getSelectedMontage();
    if (!montage || !MONTAGE_SLOTS.includes(slot)) return;
    this.replaceSelectedMontage({ ...montage, slot });
    this.renderDetails();
  }

  private setMontageLoop(loop: boolean): void {
    const montage = this.getSelectedMontage();
    if (!montage) return;
    this.replaceSelectedMontage({ ...montage, loop });
    this.renderDetails();
  }

  private setMontageBlend(field: "in" | "out", value: string): void {
    const montage = this.getSelectedMontage();
    if (!montage) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      this.renderDetails();
      return;
    }
    const clamped = Number(Math.min(Math.max(numeric, 0), 4).toFixed(3));
    const next =
      field === "in"
        ? { ...montage, blendInSeconds: clamped }
        : { ...montage, blendOutSeconds: clamped };
    this.replaceSelectedMontage(next);
    this.renderDetails();
  }

  private selectClip(name: string, options: { autoplay: boolean; crossfade: boolean }): void {
    if (this.blendPreviewActive) this.stopBlendPreview();
    const clip = this.clips.find((item) => item.name === name);
    if (!clip || !this.mixer) return;
    const previousClipName = this.selectedClipName;
    this.selectedClipName = clip.name;
    this.skeleton = {
      ...this.skeleton,
      preview: { ...this.skeleton.preview, selectedClip: clip.name },
    };
    const duration = options.crossfade && previousClipName && previousClipName !== clip.name
      ? this.crossfadeDuration
      : 0;
    if (this.animator) {
      this.animator.play(clip.name, duration);
    } else {
      this.mixer.stopAllAction();
      this.mixer.clipAction(clip).reset().play();
    }
    this.action = this.mixer.clipAction(clip);
    this.applyLoopMode();
    this.action.paused = !options.autoplay;
    this.playing = options.autoplay;
    this.mixer.update(0);
    this.renderToolbar();
    this.renderDetails();
    this.setStatus(
      duration > 0
        ? `Crossfading to ${clip.name} (${duration.toFixed(2)}s).`
        : `Previewing ${clip.name}.`,
    );
  }

  private togglePlayback(): void {
    if (this.blendPreviewActive) this.stopBlendPreview();
    if (!this.action && this.selectedClipName) {
      this.selectClip(this.selectedClipName, { autoplay: false, crossfade: false });
    }
    if (!this.action) return;
    this.playing = !this.playing;
    this.action.paused = !this.playing;
    this.clock.getDelta();
    this.renderDetails();
  }

  private scrubTo(time: number): void {
    if (!this.action || !this.mixer) return;
    this.playing = false;
    const clip = this.action.getClip();
    this.mixer.stopAllAction();
    this.action = this.mixer.clipAction(clip);
    this.action.reset();
    this.applyLoopMode();
    this.action.play();
    this.action.paused = true;
    this.action.time = clamp(time, 0, this.action.getClip().duration);
    this.mixer.update(0);
    this.updateTimelineFromAction();
  }

  private applyLoopMode(): void {
    if (!this.action) return;
    this.action.setLoop(this.loop ? LoopRepeat : LoopOnce, this.loop ? Infinity : 1);
    this.action.clampWhenFinished = !this.loop;
  }

  private showBindPose(): void {
    if (this.blendPreviewActive) this.stopBlendPreview();
    this.playing = false;
    this.action?.stop();
    this.action = null;
    this.mixer?.stopAllAction();
    for (const mesh of this.skinnedMeshes) mesh.skeleton.pose();
    this.setStatus("Bind pose restored.");
    this.renderDetails();
  }

  private updateTimelineFromAction(): void {
    const action = this.action;
    if (!action) return;
    const input = this.detailsHost.querySelector<HTMLInputElement>("[data-skel-time]");
    const label = this.detailsHost.querySelector<HTMLElement>("[data-skel-time-label]");
    if (input) input.value = String(action.time);
    if (label) label.textContent = `${action.time.toFixed(2)} / ${action.getClip().duration.toFixed(2)}s`;
  }

  private updateBoneMarker(): void {
    if (!this.selectedBone) {
      this.boneMarker.visible = false;
      return;
    }
    this.selectedBone.getWorldPosition(this.boneMarker.position);
    this.boneMarker.scale.setScalar(this.modelRadius * 0.08);
    this.boneMarker.visible = true;
  }

  private updateNormalHelpers(): void {
    if (!this.showNormals) return;
    for (const helper of this.normalHelpers) helper.update();
  }

  private updateNormalVisibility(): void {
    for (const helper of this.normalHelpers) helper.visible = this.showNormals;
  }

  private applyWireframe(): void {
    for (const material of this.materials) {
      if ("wireframe" in material) {
        (material as Material & { wireframe: boolean }).wireframe = this.wireframe;
        material.needsUpdate = true;
      }
    }
  }

  private setStatus(message: string, tone: "info" | "warning" | "error" = "info"): void {
    const status = this.overlay.querySelector<HTMLElement>("[data-sm-status]");
    if (status) {
      status.textContent = message;
      status.dataset.tone = tone;
    }
    this.options.onStatus?.(message, tone);
  }

  private markDirty(): void {
    this.overlay.querySelector<HTMLButtonElement>("[data-sm-save]")?.classList.add("is-dirty");
  }

  private async save(): Promise<void> {
    try {
      const result = await saveAssetSkeleton(this.options.modelPath, this.skeleton);
      this.overlay.querySelector<HTMLButtonElement>("[data-sm-save]")?.classList.remove("is-dirty");
      this.setStatus(result.changed ? `Saved ${result.path}` : "No skeleton metadata changes to save.");
    } catch (error) {
      this.setStatus(`Save failed: ${describeError(error)}`, "error");
    }
  }

  close(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.action?.stop();
    this.mixer?.stopAllAction();
    this.skeletonHelper?.dispose();
    this.transformControls?.detach();
    this.transformControls?.dispose();
    this.disposeNormalHelpers();
    this.disposeSocketOverlays();
    this.boneMarker.geometry.dispose();
    if (Array.isArray(this.boneMarker.material)) {
      for (const material of this.boneMarker.material) material.dispose();
    } else {
      this.boneMarker.material.dispose();
    }
    this.renderer.dispose();
    this.overlay.remove();
    if (SkeletalMeshEditor.active === this) SkeletalMeshEditor.active = null;
  }

  private requireEl<T extends HTMLElement = HTMLElement>(selector: string): T {
    const el = this.overlay.querySelector<T>(selector);
    if (!el) throw new Error(`SkeletalMeshEditor: missing ${selector}`);
    return el;
  }

  private disposeNormalHelpers(): void {
    for (const helper of this.normalHelpers) {
      helper.removeFromParent();
      helper.dispose();
    }
    this.normalHelpers.length = 0;
  }
}

function buildBoneTree(bones: readonly Bone[]): BoneNode[] {
  const boneSet = new Set(bones);
  const byBone = new Map<Bone, BoneNode>();
  for (const bone of bones) byBone.set(bone, { bone, children: [] });
  const roots: BoneNode[] = [];
  for (const bone of bones) {
    const node = byBone.get(bone);
    if (!node) continue;
    if (bone.parent instanceof Bone && boneSet.has(bone.parent)) {
      byBone.get(bone.parent)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function materialList(material: Mesh["material"]): Material[] {
  return Array.isArray(material) ? material : [material];
}

function disposeObject3D(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of materialList(object.material)) {
      material.dispose();
    }
  });
}

function emptyStats(): MeshStats {
  return {
    meshCount: 0,
    skinnedMeshCount: 0,
    sectionCount: 0,
    materialCount: 0,
    vertexCount: 0,
    triangleCount: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatVec3(value: Vector3): string {
  return [value.x, value.y, value.z].map((axis) => axis.toFixed(2)).join(", ");
}

function formatVec3Array(value: Vec3): string {
  return value.map((axis) => axis.toFixed(2)).join(", ");
}

function formatRoleLabel(role: AnimationSetRole): string {
  return role.length > 0 ? role[0]!.toUpperCase() + role.slice(1) : role;
}

function applySocketTransform(root: Object3D, socket: AssetSkeletonSocketDef): void {
  root.position.set(socket.position[0], socket.position[1], socket.position[2]);
  root.rotation.set(
    MathUtils.degToRad(socket.rotation[0]),
    MathUtils.degToRad(socket.rotation[1]),
    MathUtils.degToRad(socket.rotation[2]),
    "XYZ",
  );
  root.scale.set(socket.scale[0], socket.scale[1], socket.scale[2]);
}

function socketFromObject(root: Object3D, socket: AssetSkeletonSocketDef): AssetSkeletonSocketDef {
  return {
    ...socket,
    position: [
      round(root.position.x),
      round(root.position.y),
      round(root.position.z),
    ] as Vec3,
    rotation: [
      round(MathUtils.radToDeg(root.rotation.x)),
      round(MathUtils.radToDeg(root.rotation.y)),
      round(MathUtils.radToDeg(root.rotation.z)),
    ] as Vec3,
    scale: [
      Math.max(round(root.scale.x), 0.001),
      Math.max(round(root.scale.y), 0.001),
      Math.max(round(root.scale.z), 0.001),
    ] as Vec3,
  };
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function axisMidpoint(axis: BlendSpaceAxisDef): number {
  return (axis.min + axis.max) / 2;
}

function clampSamplesToAxis(
  samples: readonly BlendSpaceSampleDef[],
  axis: BlendSpaceAxisDef,
  which: "x" | "y",
): BlendSpaceSampleDef[] {
  return samples.map((sample) => {
    const value = which === "x" ? sample.x : sample.y;
    if (value === undefined) return { ...sample };
    const clamped = round(Math.min(Math.max(value, axis.min), axis.max));
    return which === "x" ? { ...sample, x: clamped } : { ...sample, y: clamped };
  });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
