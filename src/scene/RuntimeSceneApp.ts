import { Box3, DirectionalLight, Group, Object3D } from "three";
import type { AmbientLight, InstancedMesh, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { AssetLoader } from "./assetLoader";
import { loadRoomLayout } from "./roomLayout";
import { EngineApp } from "@engine/core/EngineApp";
import { AnimationSubsystem } from "@engine/render-three/animationSubsystem";
import { CrossfadeAnimator } from "@engine/render-three/characterAnimator";
import { ActionMap, type ActionBindings } from "@engine/input/actionMap";
import { InputSubsystem } from "@engine/input/inputSubsystem";
import { BehaviorSubsystem } from "@engine/behavior/behaviorSubsystem";
import { PhysicsSubsystem } from "@engine/physics/physicsSubsystem";
import { AudioSubsystem } from "@engine/audio/audioSubsystem";
import { KeyboardInputSource } from "@/input/keyboardInputSource";
import { createBehaviorRegistry } from "@/game/behaviors";
import {
  smoothingFactor,
  stepFollowCamera,
  type FollowCameraConfig,
  type FollowCameraPose,
  type Vec3,
} from "@/game/followCamera";
import {
  selectLocomotionClip,
  DEFAULT_LOCOMOTION_THRESHOLDS,
  type LocomotionInput,
} from "@/game/locomotionAnimation";
import { loadActiveProject, type ActiveProject } from "@/project/ProjectSystem";
import {
  applySceneBackgroundAndAmbient,
  buildSceneCharacterObject,
  buildSceneEntities,
  buildSceneInstancedModel,
  buildSceneLightObject,
  computeModelLocalBounds,
  computeSceneRoomBounds,
  createSceneCharacterMixer,
  createSceneRuntimeCore,
  DEFAULT_SCENE_BACKGROUND_COLOR,
  DEFAULT_SCENE_GRAVITY,
  ensureDefaultSceneLights,
  fitDirectionalShadowToBounds,
  isSceneSunLight,
  readSceneRuntimeStats,
  resolveSceneWorldSettings,
  resizeSceneRuntimeViewport,
  startSceneRuntime,
  tagSceneLightRecordIndex,
} from "./SceneRuntimeCore";
import type { LightObjectRecord } from "@engine/render-three/lights";
import { collectMaterialStats, convertUnlitModelMaterialsToLit } from "@engine/render-three/materials";
import { applyEulerDegrees, colliderBoxFromBounds } from "@engine/render-three/transforms";
import type { LayoutCharacter, LayoutLightActor, LayoutPlacement, RoomLayout } from "@engine/scene/layout";
import {
  characterEntityId,
  roomLayoutToSceneDocument,
  type ColliderTransformSource,
} from "@engine/scene/legacyRoomLayoutAdapter";
import type { TransformComponent } from "@engine/scene/components";

/**
 * Third-person follow camera: sits behind (+z) and above the player, looking
 * down -z so the world movement frame reads as camera-relative. `RATE` is the
 * exponential easing speed (per second) the camera uses to track the player.
 */
const FOLLOW_CAMERA_CONFIG: FollowCameraConfig = {
  offset: [0, 1.2, 2.6],
  lookHeight: 0.5,
};
const FOLLOW_CAMERA_RATE = 8;

/** Crossfade duration (seconds) between locomotion clips (G5). */
const ANIMATION_CROSSFADE_SECONDS = 0.18;

const DEFAULT_INPUT_BINDINGS: ActionBindings = {
  KeyW: "move-forward",
  ArrowUp: "move-forward",
  KeyS: "move-back",
  ArrowDown: "move-back",
  KeyA: "move-left",
  ArrowLeft: "move-left",
  KeyD: "move-right",
  ArrowRight: "move-right",
  Space: "jump",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
};

export interface RuntimeStatsApp {
  onFrame: ((deltaMs: number) => void) | null;
  getRenderStats(): { drawCalls: number; triangles: number };
}

export class RuntimeSceneApp implements RuntimeStatsApp {
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly engineApp = new EngineApp();
  private readonly animationSubsystem = new AnimationSubsystem();
  private readonly inputActions = new ActionMap(DEFAULT_INPUT_BINDINGS);
  private readonly inputSubsystem = new InputSubsystem(this.inputActions);
  private readonly physicsSubsystem = new PhysicsSubsystem({ backend: "rapier" });
  private readonly audioSubsystem = new AudioSubsystem({ backend: "web-audio" });
  private readonly keyboardInput = new KeyboardInputSource(this.inputActions);
  private readonly behaviorSubsystem: BehaviorSubsystem;
  private frameHandle = 0;
  private lastTime = 0;
  private activeProject: ActiveProject | null = null;
  private assetLoader: AssetLoader | null = null;
  private layout: RoomLayout | null = null;
  private models = new Map<string, GLTF>();
  private instanceGroups = new Map<string, Group>();
  private instanceMeshes = new Map<string, InstancedMesh[]>();
  private characterObjects: Object3D[] = [];
  private lightObjects: LightObjectRecord[] = [];
  private localBounds = new Map<string, Box3>();
  private sun: DirectionalLight | null = null;
  private ambientLight: AmbientLight | null = null;
  private cameraViewTouched = false;
  private playerObject: Object3D | null = null;
  private playerEntityId: string | null = null;
  private playerAnimator: CrossfadeAnimator | null = null;
  private playerLocomotion: LocomotionInput | null = null;
  private followPose: FollowCameraPose | null = null;
  private gravityY = DEFAULT_SCENE_GRAVITY[1];

  onFrame: ((deltaMs: number) => void) | null = null;

  private readonly syncEntityTransform = (entityId: string, transform: TransformComponent): void => {
    const index = parseCharacterEntityIndex(entityId);
    if (index === null) return;
    const object = this.characterObjects[index];
    if (!object) return;
    object.position.set(transform.position[0], transform.position[1], transform.position[2]);
    applyEulerDegrees(object, transform.rotation);
    object.scale.set(transform.scale[0], transform.scale[1], transform.scale[2]);
    this.physicsSubsystem.setEntityTransform(entityId, transform);
  };

  constructor(canvas: HTMLCanvasElement) {
    const runtimeCore = createSceneRuntimeCore(canvas, {
      backgroundColor: DEFAULT_SCENE_BACKGROUND_COLOR,
    });
    this.renderer = runtimeCore.renderer;
    this.scene = runtimeCore.scene;
    this.camera = runtimeCore.camera;

    this.engineApp.registerSubsystem(this.animationSubsystem);
    this.engineApp.registerSubsystem(this.inputSubsystem);
    this.engineApp.registerSubsystem(this.physicsSubsystem);
    this.behaviorSubsystem = new BehaviorSubsystem(
      createBehaviorRegistry({
        getGravityY: () => this.gravityY,
        reportLocomotion: (entityId, report) => {
          if (entityId === this.playerEntityId) this.playerLocomotion = report;
        },
        onGoalReached: (entityId) => {
          console.info("[runtime] goal reached", entityId);
        },
      }),
      this.inputActions,
      this.syncEntityTransform,
      this.physicsSubsystem,
      this.audioSubsystem,
    );
    this.engineApp.registerSubsystem(this.behaviorSubsystem);
    this.engineApp.registerSubsystem(this.audioSubsystem);
    this.keyboardInput.attach();

    void this.loadActiveProjectScene();
    this.handleResize();
    window.addEventListener("resize", this.handleResize);
  }

  start(): void {
    this.lastTime = performance.now();
    const loop = (now: number) => {
      this.frameHandle = requestAnimationFrame(loop);
      const deltaMs = Math.min(now - this.lastTime, 100);
      this.lastTime = now;
      this.engineApp.update(deltaMs / 1000);
      this.updateFollowCamera(deltaMs / 1000);
      this.updateCharacterAnimation();
      this.renderer.render(this.scene, this.camera);
      this.onFrame?.(deltaMs);
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.frameHandle);
    window.removeEventListener("resize", this.handleResize);
    this.keyboardInput.detach();
    void this.engineApp.dispose();
    this.renderer.dispose();
  }

  getRenderStats(): { drawCalls: number; triangles: number } {
    return readSceneRuntimeStats(this.renderer);
  }

  private async loadActiveProjectScene(): Promise<void> {
    this.activeProject = await loadActiveProject();
    this.assetLoader = new AssetLoader(this.activeProject.manifest);
    this.layout = await loadRoomLayout(this.activeProject.manifest.editor.defaultScene);
    this.gravityY = resolveSceneWorldSettings(this.layout).gravity[1];
    this.ensureDefaultLights();
    this.models = await this.assetLoader.loadGroups(this.layout.loadGroups);
    const convertedUnlitMaterials = convertUnlitModelMaterialsToLit(this.models);
    this.localBounds = computeModelLocalBounds(this.models);

    buildSceneEntities(this.layout, {
      addInstance: (assetId, placements) =>
        this.scene.add(this.createInstancedModel(assetId, placements)),
      addCharacter: (assetId, character) => this.addCharacter(this.models.get(assetId), character),
      addLight: (light) => this.addLight(light),
    });

    this.fitSunShadowToScene();
    this.applyBackgroundAndAmbient();

    const bytes = await this.assetLoader.totalBytesForGroups(this.layout.loadGroups);
    const materialStats = collectMaterialStats(this.models);
    console.info(
      "[runtime] scene loaded",
      JSON.stringify({
        project: this.activeProject.manifest.name,
        layout: this.layout.name,
        processedAssetBytes: bytes,
        materialStats,
        convertedUnlitMaterials,
      }),
    );

    await startSceneRuntime({
      sceneDocument: roomLayoutToSceneDocument(this.layout, {
        colliderBox: (assetId, source) => this.colliderBoxFor(assetId, source),
      }),
      physics: this.physicsSubsystem,
      behavior: this.behaviorSubsystem,
      engineApp: this.engineApp,
    });
  }

  /**
   * World-aligned collider footprint for a placed asset, from its loaded model
   * bounds, so derived colliders match the rendered mesh instead of a unit cube.
   * Returns undefined when bounds are unavailable (adapter falls back to a
   * scaled unit box).
   */
  private colliderBoxFor(assetId: string, source: ColliderTransformSource) {
    const bounds = this.localBounds.get(assetId);
    return bounds ? colliderBoxFromBounds(bounds, source) : undefined;
  }

  private createInstancedModel(assetId: string, placements: LayoutPlacement[]): Group {
    const gltf = this.models.get(assetId);
    if (!gltf) throw new Error(`Runtime asset missing: ${assetId}`);
    const { group, meshes } = buildSceneInstancedModel({
      assetId,
      gltf,
      placements,
      castShadow: this.staticObjectsCastShadow(),
      receiveShadow: this.staticObjectsReceiveShadow(),
    });
    this.instanceGroups.set(assetId, group);
    this.instanceMeshes.set(assetId, meshes);
    return group;
  }

  private addCharacter(gltf: GLTF | undefined, placement: LayoutCharacter): void {
    if (!gltf) return;
    const index = this.characterObjects.length;
    const character = buildSceneCharacterObject(gltf, placement, index);
    character.userData.characterIndex = index;
    this.scene.add(character);
    this.characterObjects.push(character);
    // The first input-driven character is the player the runtime camera follows;
    // taking over the view stops the responsive resize handler from resetting it.
    const isPlayer = !this.playerObject && placement.behavior?.script === "input-move";
    if (isPlayer) {
      this.playerObject = character;
      this.playerEntityId = characterEntityId(index);
      this.cameraViewTouched = true;
      // The player gets the full clip set, crossfaded by movement state (G5);
      // snap to the authored idle clip so it never flashes a bind pose.
      const animator = new CrossfadeAnimator(character, gltf.animations);
      animator.play(placement.animation ?? "idle", 0);
      this.animationSubsystem.add(animator.mixer);
      this.playerAnimator = animator;
      return;
    }
    // Non-player characters keep the single authored clip.
    const mixer = createSceneCharacterMixer(character, gltf, placement.animation);
    if (mixer) this.animationSubsystem.add(mixer);
  }

  /**
   * Drives the player's animation clip from the movement snapshot the behavior
   * reported this tick (G5). Pure selection lives in `src/game`; here we only
   * apply the chosen clip to the crossfade animator.
   */
  private updateCharacterAnimation(): void {
    const animator = this.playerAnimator;
    const report = this.playerLocomotion;
    if (!animator || !report) return;
    const clip = selectLocomotionClip(report, animator.clips, DEFAULT_LOCOMOTION_THRESHOLDS);
    if (clip) animator.play(clip, ANIMATION_CROSSFADE_SECONDS);
  }

  private updateFollowCamera(deltaSeconds: number): void {
    const player = this.playerObject;
    if (!player) return;
    const playerPos: Vec3 = [player.position.x, player.position.y, player.position.z];
    const t = smoothingFactor(FOLLOW_CAMERA_RATE, deltaSeconds);
    this.followPose = stepFollowCamera(this.followPose, playerPos, FOLLOW_CAMERA_CONFIG, t);
    const { position, target } = this.followPose;
    this.camera.position.set(position[0], position[1], position[2]);
    this.camera.lookAt(target[0], target[1], target[2]);
  }

  private addLight(actor: LayoutLightActor): void {
    const index = this.lightObjects.length;
    const record = buildSceneLightObject(actor, index);
    tagSceneLightRecordIndex(record, index);
    this.scene.add(record.root);
    if (record.target) this.scene.add(record.target);
    this.lightObjects.push(record);
    if (isSceneSunLight(actor, this.sun)) {
      this.sun = record.light as DirectionalLight;
    }
  }

  private ensureDefaultLights(): void {
    ensureDefaultSceneLights(this.layout);
  }

  private fitSunShadowToScene(): void {
    fitDirectionalShadowToBounds(this.sun, this.getRoomBounds());
  }

  private getRoomBounds(): Box3 | null {
    return computeSceneRoomBounds(this.layout, this.localBounds);
  }

  private applyBackgroundAndAmbient(): void {
    this.ambientLight = applySceneBackgroundAndAmbient({
      scene: this.scene,
      ambientLight: this.ambientLight,
      settings: resolveSceneWorldSettings(this.layout),
    });
  }

  private staticObjectsCastShadow(): boolean {
    return resolveSceneWorldSettings(this.layout).staticObjectsCastShadow;
  }

  private staticObjectsReceiveShadow(): boolean {
    return resolveSceneWorldSettings(this.layout).staticObjectsReceiveShadow;
  }

  private handleResize = (): void => {
    const resetView = resizeSceneRuntimeViewport({
      camera: this.camera,
      renderer: this.renderer,
      width: window.innerWidth,
      height: window.innerHeight,
      viewTouched: this.cameraViewTouched,
    });
    if (resetView) this.cameraViewTouched = false;
  };
}

function parseCharacterEntityIndex(entityId: string): number | null {
  if (!entityId.startsWith("character:")) return null;
  const index = Number(entityId.slice("character:".length));
  return Number.isInteger(index) ? index : null;
}
