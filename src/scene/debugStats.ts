/**
 * Tiny fps / draw-call readout for the HTML overlay (#debug-stats).
 * Enabled only with `?debug` in the URL so it never ships visible.
 * lil-gui (devDependency) is dynamically imported on demand later, when
 * scene parameters need live tweaking — keeps it out of the base bundle.
 */
import type { SceneApp } from "./SceneApp";

const UPDATE_INTERVAL_MS = 500;

export function attachDebugStats(app: SceneApp, element: HTMLElement): void {
  let accumMs = 0;
  let frames = 0;

  app.onFrame = (deltaMs) => {
    accumMs += deltaMs;
    frames += 1;
    if (accumMs < UPDATE_INTERVAL_MS) return;

    const fps = (frames * 1000) / accumMs;
    const { drawCalls, triangles } = app.getRenderStats();
    element.textContent =
      `${fps.toFixed(0)} fps\n` +
      `${drawCalls} draw calls\n` +
      `${triangles} tris`;
    accumMs = 0;
    frames = 0;
  };
}
