/**
 * Entry point: wires the DOM (canvas + UI overlay) to the scene layer.
 * Keep this file thin — composition only, no game or render logic.
 */
import { SceneApp } from "@/scene/SceneApp";
import { attachDebugStats } from "@/scene/debugStats";

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing required element: #${id}`);
  return el as T;
}

const canvas = requireElement<HTMLCanvasElement>("game-canvas");
const app = new SceneApp(canvas);

// Perf readout (qa-poki standard) behind ?debug — invisible in production.
if (new URLSearchParams(location.search).has("debug")) {
  attachDebugStats(app, requireElement("debug-stats"));
}

app.start();
