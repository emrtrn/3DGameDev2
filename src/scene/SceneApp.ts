/**
 * SceneApp — the single render-layer orchestrator (L11 boundary).
 *
 * three.js is imported ONLY under src/scene/. Game rules live in pure-TS
 * modules (M1–M9, src/core/...) and talk to this layer via the event bus.
 * This class owns: renderer, scene graph, camera rig, lights, frame loop.
 *
 * Unreal bridge: roughly a hand-rolled GameViewportClient + World — there
 * is no engine loop; we drive everything from requestAnimationFrame.
 */
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  BoxGeometry,
  PlaneGeometry,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";

/** Perf budget: clamp DPR so 1080p+ phones don't render 3x fragments. */
const MAX_PIXEL_RATIO = 2;

export class SceneApp {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private testCube: Mesh;
  private frameHandle = 0;
  private lastTime = 0;

  /** Called every frame with the smoothed delta; used by the debug overlay. */
  onFrame: ((deltaMs: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // three r118+ uses WebGL2 automatically when available; we hard-require
    // it (render-target dirt mask in M2 depends on it). ~97% mobile support.
    if (!canvas.getContext("webgl2")) {
      throw new Error("WebGL2 is not supported on this device/browser.");
    }

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true, // cheap on low-poly scenes; revisit if qa-poki flags it
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));

    this.scene.background = new Color(0x2a2a3e);

    // Fixed camera, no free orbit (GDD 05): one of the future 4-angle rig
    // positions. Slightly high pitch so a room floor reads in portrait.
    this.camera = new PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(5, 6, 5);
    this.camera.lookAt(0, 0, 0);

    // Cheap-first lighting (no dynamic shadows until measured need):
    // one directional + ambient approximates a baked look on low-poly sets.
    const sun = new DirectionalLight(0xffffff, 2.0);
    sun.position.set(3, 8, 4);
    this.scene.add(sun);
    this.scene.add(new AmbientLight(0xb0b8ff, 0.6));

    // Placeholder content: ground plane + test cube (1 unit = 1 m,
    // matches future grid cell calibration in M4). 2 draw calls, ~14 tris.
    const ground = new Mesh(
      new PlaneGeometry(10, 10),
      new MeshStandardMaterial({ color: 0x8a7f6d }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    this.testCube = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ color: 0xe0945c }),
    );
    this.testCube.position.y = 0.5;
    this.scene.add(this.testCube);

    this.handleResize();
    window.addEventListener("resize", this.handleResize);
  }

  start(): void {
    this.lastTime = performance.now();
    const loop = (now: number) => {
      this.frameHandle = requestAnimationFrame(loop);
      const deltaMs = Math.min(now - this.lastTime, 100); // clamp tab-switch spikes
      this.lastTime = now;

      // Placeholder motion proving the loop is alive; removed with M-modules.
      this.testCube.rotation.y += deltaMs * 0.001;

      this.renderer.render(this.scene, this.camera);
      this.onFrame?.(deltaMs);
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.frameHandle);
    window.removeEventListener("resize", this.handleResize);
    this.renderer.dispose();
  }

  /** Renderer info for the debug overlay (draw calls, triangles). */
  getRenderStats(): { drawCalls: number; triangles: number } {
    const { calls, triangles } = this.renderer.info.render;
    return { drawCalls: calls, triangles };
  }

  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // false: CSS already sizes the canvas (position:fixed inset:0).
    this.renderer.setSize(width, height, false);
  };
}
