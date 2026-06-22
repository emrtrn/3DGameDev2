import type { CameraComponent, SpringArmComponent } from "@engine/scene/components";
import { lerpVec3, type FollowCameraPose, type Vec3 } from "./followCamera";
import { forwardFromLookAngles, type LookAngles } from "./gameModes/cameraControl";

export interface SpringArmCameraPoseInput {
  readonly playerPosition: Vec3;
  readonly springArm: SpringArmComponent;
  readonly controlRotation: LookAngles;
}

export interface CameraProjectionConfig {
  readonly fov: number;
  readonly near: number;
  readonly far: number;
}

export const DEFAULT_CAMERA_PROJECTION: CameraProjectionConfig = {
  fov: 44,
  near: 0.1,
  far: 100,
};

/** Resolves the desired third-person camera pose from authored SpringArm data. */
export function desiredSpringArmCameraPose(input: SpringArmCameraPoseInput): FollowCameraPose {
  const { playerPosition, springArm, controlRotation } = input;
  const forward = forwardFromLookAngles(controlRotation);
  const right = rightFromForward(forward.x, forward.z);
  const pivot: Vec3 = [
    playerPosition[0] + springArm.targetOffset[0],
    playerPosition[1] + springArm.targetOffset[1],
    playerPosition[2] + springArm.targetOffset[2],
  ];
  const socket = springArm.socketOffset;
  return {
    position: [
      pivot[0] - forward.x * springArm.targetArmLength + right[0] * socket[0] + socket[2] * forward.x,
      pivot[1] - forward.y * springArm.targetArmLength + socket[1] + socket[2] * forward.y,
      pivot[2] - forward.z * springArm.targetArmLength + right[1] * socket[0] + socket[2] * forward.z,
    ],
    target: pivot,
  };
}

/** Advances a spring-arm camera pose, honoring the component's camera lag flag. */
export function stepSpringArmCameraPose(
  prev: FollowCameraPose | null,
  desired: FollowCameraPose,
  t: number,
): FollowCameraPose {
  if (!prev) return desired;
  return {
    position: lerpVec3(prev.position, desired.position, t),
    target: lerpVec3(prev.target, desired.target, t),
  };
}

/** Maps an authored Camera component to the live PerspectiveCamera projection. */
export function cameraProjectionFromComponent(
  camera: CameraComponent | undefined,
): CameraProjectionConfig {
  if (!camera || camera.isOrthographic) return DEFAULT_CAMERA_PROJECTION;
  return {
    fov: camera.fieldOfView,
    near: camera.nearClip,
    far: camera.farClip,
  };
}

function rightFromForward(forwardX: number, forwardZ: number): [number, number] {
  const length = Math.hypot(forwardX, forwardZ);
  if (length <= 1e-6) return [1, 0];
  const fx = forwardX / length;
  const fz = forwardZ / length;
  return [-fz, fx];
}
