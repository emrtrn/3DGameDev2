/**
 * Runtime ragdoll driver: the "kinematic animation → dynamic ragdoll" switch.
 *
 * On activation it samples the character's current bone world transforms, builds
 * a ragdoll spec (pure, `ragdollSpec.ts`), lowers it to an engine group desc, and
 * spawns it into the live physics world. Each tick it samples the simulated body
 * transforms and poses the character's bones from them, so the skinned/rigid mesh
 * follows the falling ragdoll. The pure spec/anchor math is tested elsewhere; this
 * file is the unavoidable Three scene-graph + physics-bridge glue (covered by
 * manual Play, not engine-tests).
 *
 * Assumes the character has a (uniform) world scale — body offsets/sizes are
 * scaled by the bone's world scale so the simulation matches the rendered,
 * possibly down-scaled, character. Bones without a physics body keep their frozen
 * pose and ride their nearest bodied ancestor.
 */
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { Object3D } from "three";
import { buildRagdollSpec, toRagdollGroupDesc, type ResolveBoneWorld } from "@/game/ragdollSpec";
import {
  boneWorldFromBodyPose,
  type QuatXYZW,
  type RagdollGroupDesc,
  type RagdollPose,
} from "@engine/physics/ragdoll";
import type { Vec3 } from "@engine/scene/layout";
import type {
  AssetSkeletonPhysicsBodyDef,
  AssetSkeletonPhysicsConstraintDef,
} from "@/scene/assetSkeletonLoader";

/** The physics-bridge slice the driver needs (a subset of `GameModeContext`). */
export interface RagdollPhysicsBridge {
  spawnRagdoll(desc: RagdollGroupDesc, options?: { detachEntityId?: string }): number | null;
  sampleRagdoll(id: number): RagdollPose[];
  despawnRagdoll(id: number): void;
}

/** A bone posed from a simulated body each tick. */
interface DrivenBone {
  readonly bodyName: string;
  readonly node: Object3D;
  /** Body's bone-local orientation offset (`boneQuat = bodyQuat · inverse(this)`). */
  readonly offsetQuaternion: QuatXYZW;
  /** Body origin in the bone's frame, scaled to world units. */
  readonly scaledOffset: Vec3;
  /** Bone's captured world scale, reused when rebuilding its world matrix. */
  readonly worldScale: Vector3;
  /** Scene-graph depth, for shallow-first processing (parents before children). */
  readonly depth: number;
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Spawns a ragdoll for `root`'s authored bodies/constraints and returns a driver,
 * or null when nothing could be built (no resolvable bodies, or the physics
 * backend is inactive). `detachEntityId` keeps the possessed pawn's capsule from
 * shoving its own ragdoll.
 */
export function createRagdollDriver(
  root: Object3D,
  bodies: readonly AssetSkeletonPhysicsBodyDef[],
  constraints: readonly AssetSkeletonPhysicsConstraintDef[],
  bridge: RagdollPhysicsBridge,
  detachEntityId?: string,
): RagdollDriver | null {
  if (bodies.length === 0) return null;
  root.updateWorldMatrix(true, true);

  const boneWorld = new Map<string, { position: Vec3; quaternion: [number, number, number, number] }>();
  const driven: DrivenBone[] = [];
  const scaledBodies: AssetSkeletonPhysicsBodyDef[] = [];

  for (const body of bodies) {
    const node = root.getObjectByName(body.bone);
    if (!node) continue;
    const worldPos = new Vector3();
    const worldQuat = new Quaternion();
    const worldScale = new Vector3();
    node.matrixWorld.decompose(worldPos, worldQuat, worldScale);
    const scale = worldScale.x; // uniform-scale assumption
    boneWorld.set(body.bone, {
      position: [worldPos.x, worldPos.y, worldPos.z],
      quaternion: [worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w],
    });
    const scaledOffset: Vec3 = [
      body.position[0] * scale,
      body.position[1] * scale,
      body.position[2] * scale,
    ];
    scaledBodies.push({
      ...body,
      position: [...scaledOffset],
      size: [body.size[0] * scale, body.size[1] * scale, body.size[2] * scale],
    });
    const offsetQuat = new Quaternion().setFromEuler(
      new Euler(
        body.rotation[0] * DEG_TO_RAD,
        body.rotation[1] * DEG_TO_RAD,
        body.rotation[2] * DEG_TO_RAD,
        "XYZ",
      ),
    );
    driven.push({
      bodyName: body.name,
      node,
      offsetQuaternion: [offsetQuat.x, offsetQuat.y, offsetQuat.z, offsetQuat.w],
      scaledOffset,
      worldScale,
      depth: nodeDepth(node),
    });
  }

  if (driven.length === 0) return null;

  const resolveBoneWorld: ResolveBoneWorld = (boneName) => boneWorld.get(boneName) ?? null;
  const spec = buildRagdollSpec(scaledBodies, constraints, resolveBoneWorld);
  const id = bridge.spawnRagdoll(
    toRagdollGroupDesc(spec),
    detachEntityId !== undefined ? { detachEntityId } : undefined,
  );
  if (id === null) return null;

  // Shallow-first so a parent bone's local is set before a child reads its world.
  driven.sort((a, b) => a.depth - b.depth);
  return new RagdollDriver(bridge, id, driven);
}

export class RagdollDriver {
  private readonly mainBodyName: string;
  private lastMainPosition: Vec3 | null = null;
  // Scratch reused each tick to avoid per-bone allocation.
  private readonly boneQuat = new Quaternion();
  private readonly bonePos = new Vector3();
  private readonly worldMatrix = new Matrix4();
  private readonly localMatrix = new Matrix4();
  private readonly parentInverse = new Matrix4();

  constructor(
    private readonly bridge: RagdollPhysicsBridge,
    private readonly id: number,
    private readonly bones: readonly DrivenBone[],
  ) {
    // The shallowest body roots the ragdoll; track it for the camera to follow.
    this.mainBodyName = bones[0]?.bodyName ?? "";
  }

  /** Poses every bodied bone from the latest physics step. Call each tick. */
  update(): void {
    const poses = this.bridge.sampleRagdoll(this.id);
    if (poses.length === 0) return;
    const byName = new Map(poses.map((pose) => [pose.name, pose] as const));
    const main = byName.get(this.mainBodyName);
    this.lastMainPosition = main ? [...main.position] : this.lastMainPosition;
    for (const bone of this.bones) {
      const pose = byName.get(bone.bodyName);
      if (!pose) continue;
      // Recover the bone's world transform from the body pose (pure inverse of the
      // spec's `bodyWorld = boneWorld ∘ localOffset`).
      const boneWorld = boneWorldFromBodyPose(
        pose.position,
        pose.quaternion,
        bone.scaledOffset,
        bone.offsetQuaternion,
      );
      this.bonePos.set(boneWorld.position[0], boneWorld.position[1], boneWorld.position[2]);
      this.boneQuat.set(
        boneWorld.quaternion[0],
        boneWorld.quaternion[1],
        boneWorld.quaternion[2],
        boneWorld.quaternion[3],
      );
      this.worldMatrix.compose(this.bonePos, this.boneQuat, bone.worldScale);
      const parent = bone.node.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        this.localMatrix.multiplyMatrices(
          this.parentInverse.copy(parent.matrixWorld).invert(),
          this.worldMatrix,
        );
      } else {
        this.localMatrix.copy(this.worldMatrix);
      }
      this.localMatrix.decompose(bone.node.position, bone.node.quaternion, bone.node.scale);
      bone.node.updateMatrix();
    }
  }

  /** World position of the root-most ragdoll body, for the follow camera. */
  getFollowPosition(): Vec3 | null {
    return this.lastMainPosition;
  }

  /**
   * The bone nodes this driver poses. Captured at activation (before the first
   * physics step displaces them) to snapshot the rest pose, and again at recovery
   * to drive the get-up blend back to it. Only bodied bones — the same set the
   * ragdoll physically drove.
   */
  getDrivenNodes(): Object3D[] {
    return this.bones.map((bone) => bone.node);
  }

  dispose(): void {
    this.bridge.despawnRagdoll(this.id);
  }
}

function nodeDepth(node: Object3D): number {
  let depth = 0;
  let current: Object3D | null = node.parent;
  while (current) {
    depth += 1;
    current = current.parent;
  }
  return depth;
}
