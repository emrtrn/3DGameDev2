import { Color, Scene, Vector3 } from "three";
import type { PerspectiveCamera, WebGLRenderer } from "three";

import {
  applyResponsiveCameraViewport,
  createSceneCamera,
} from "@engine/render-three/camera";
import {
  createSceneRenderer,
  readRenderStats,
} from "@engine/render-three/renderer";

const MAX_PIXEL_RATIO = 2;

export const SCENE_CAMERA_TARGET = new Vector3(0, 0.65, -0.2);

export interface SceneRuntimeCore {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
}

export function createSceneRuntimeCore(
  canvas: HTMLCanvasElement,
  options: { backgroundColor: string | number },
): SceneRuntimeCore {
  const renderer = createSceneRenderer(canvas, MAX_PIXEL_RATIO);
  const scene = new Scene();
  scene.background = new Color(options.backgroundColor);
  const camera = createSceneCamera();
  return { renderer, scene, camera };
}

export function readSceneRuntimeStats(
  renderer: WebGLRenderer,
): { drawCalls: number; triangles: number } {
  return readRenderStats(renderer);
}

export function resizeSceneRuntimeViewport(options: {
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  width: number;
  height: number;
  viewTouched: boolean;
}): boolean {
  const resetView = applyResponsiveCameraViewport(options.camera, {
    width: options.width,
    height: options.height,
    target: SCENE_CAMERA_TARGET,
    viewTouched: options.viewTouched,
  });
  options.renderer.setSize(options.width, options.height, false);
  return resetView;
}
