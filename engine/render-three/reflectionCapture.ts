import {
  Color,
  CubeCamera,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoToneMapping,
  PMREMGenerator,
  ShaderChunk,
  SphereGeometry,
  Vector3,
  WebGLCubeRenderTarget,
  type Material,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";

import type { Vec3 } from "@engine/scene/layout";
import type { ResolvedSphereReflectionCapture } from "@engine/scene/reflectionCapture";

export {
  resolveSphereReflectionCapture,
  selectNearestReflectionCapture,
  SPHERE_REFLECTION_CAPTURE_DEFAULTS,
  uniqueSphereReflectionCaptureId,
  uniqueSphereReflectionCaptureName,
  type ReflectionCaptureProbe,
  type ResolvedSphereReflectionCapture,
} from "@engine/scene/reflectionCapture";

/**
 * Sphere Reflection Capture render binding. Faz 1 renders only the editor-side
 * **influence helper**: a wireframe sphere marking the probe's radius, drawn at
 * the actor's position. There is no cubemap bake yet (that is a later phase) — the
 * helper is purely an authoring aid that is selectable and movable in the
 * viewport. The radius is applied as a uniform three.js scale on a unit-sphere
 * mesh, so a radius edit is a cheap `scale` change with no geometry rebuild; the
 * actor's layout transform never stores a scale.
 */

/** Editor wireframe-sphere helper backing a Sphere Reflection Capture actor. */
export type SphereReflectionCaptureObject = Mesh<SphereGeometry, MeshBasicMaterial>;

/** Resolved settings + world transform the binding needs to build/sync a probe helper. */
export interface SphereReflectionCaptureRenderItem extends ResolvedSphereReflectionCapture {
  position: Vec3;
  /** XYZ-order Euler rotation in degrees (cosmetic for a sphere; kept for the gizmo). */
  rotation: Vec3;
}

/** Tint of the influence-sphere wireframe helper when its bake is current. */
const CAPTURE_HELPER_COLOR = "#46c8ff";
/** Warning tint when the cached bake is stale (probe/near/far changed since capture). */
const CAPTURE_HELPER_STALE_COLOR = "#ffb020";

/** Builds the wireframe influence-sphere helper; transform via {@link applySphereReflectionCaptureTransform}. */
export function createSphereReflectionCaptureObject(
  item: SphereReflectionCaptureRenderItem,
): SphereReflectionCaptureObject {
  // Unit sphere scaled by the radius so radius edits never rebuild geometry.
  const geometry = new SphereGeometry(1, 24, 16);
  const material = new MeshBasicMaterial({
    color: new Color(CAPTURE_HELPER_COLOR),
    wireframe: true,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = item.name;
  applySphereReflectionCaptureTransform(mesh, item);
  return mesh;
}

/** Pushes the transform + visibility + radius (as scale) onto an existing helper. */
export function applySphereReflectionCaptureTransform(
  mesh: SphereReflectionCaptureObject,
  item: SphereReflectionCaptureRenderItem,
): void {
  mesh.position.set(item.position[0], item.position[1], item.position[2]);
  mesh.rotation.set(
    (item.rotation[0] * Math.PI) / 180,
    (item.rotation[1] * Math.PI) / 180,
    (item.rotation[2] * Math.PI) / 180,
    "XYZ",
  );
  mesh.scale.setScalar(Math.max(item.radius, 0.001));
  mesh.visible = !item.hidden;
}

/**
 * Tints the influence-sphere helper to flag a stale bake: amber when the cached
 * cubemap no longer matches the probe (moved / near-far edited since capture),
 * the normal blue when current. Debug indicator only — it does not touch the
 * reflection itself; the user presses Recapture to refresh.
 */
export function setSphereReflectionCaptureStale(
  mesh: SphereReflectionCaptureObject,
  stale: boolean,
): void {
  mesh.material.color.set(stale ? CAPTURE_HELPER_STALE_COLOR : CAPTURE_HELPER_COLOR);
}

/** Frees the helper's geometry + material. */
export function disposeSphereReflectionCaptureObject(mesh: SphereReflectionCaptureObject): void {
  mesh.geometry.dispose();
  mesh.material.dispose();
}

/**
 * A baked probe: the prefiltered (PMREM) environment captured from the probe's
 * position, plus the resolved scalars copied at bake time so the nearest-probe
 * envMap pass (Faz 3) has a self-contained descriptor. The owner must dispose the
 * `target` (via {@link disposeSphereReflectionCaptureBake}) before replacing it.
 */
export interface SphereReflectionCaptureBake {
  /** Prefiltered PMREM environment render target (`.texture` drives envMaps). */
  target: WebGLRenderTarget;
  /** World position the cubemap was captured from. */
  position: Vec3;
  /** Influence radius copied from the actor at bake time. */
  radius: number;
  /** Reflection strength multiplier copied at bake time. */
  intensity: number;
  /** Overlap tie-breaker copied at bake time. */
  priority: number;
  /** Cubemap face resolution this was baked at (lets the owner detect rebake-on-resolution). */
  resolution: number;
  /** Whether covered surfaces get local sphere parallax correction (Faz 4). */
  parallax: boolean;
  /** CubeCamera near clip used at bake time (feeds the stale-bake check). */
  near: number;
  /** CubeCamera far clip used at bake time (feeds the stale-bake check). */
  far: number;
}

/**
 * Bakes a Sphere Reflection Capture: renders the scene into a cubemap from the
 * probe's position with a {@link CubeCamera}, then prefilters it into a PMREM
 * environment target (à la Unreal's static Sphere Reflection Capture). The capture
 * is a snapshot — callers bake on load / add / Recapture, never per frame. The
 * caller is responsible for hiding editor-only aids (helpers, gizmo) before baking
 * so they do not pollute the reflection. Tone mapping is forced off during the
 * bake so the environment is stored in neutral/linear space. The raw cube target
 * is freed here; only the returned PMREM target survives and the caller owns it.
 */
export function bakeSphereReflectionCapture(
  renderer: WebGLRenderer,
  scene: Scene,
  item: SphereReflectionCaptureRenderItem,
): SphereReflectionCaptureBake {
  const cubeTarget = new WebGLCubeRenderTarget(item.resolution, { type: HalfFloatType });
  const cubeCamera = new CubeCamera(item.near, item.far, cubeTarget);
  cubeCamera.position.set(item.position[0], item.position[1], item.position[2]);
  // The cube camera is not parented; update its world matrix so the six face
  // cameras render from the probe position.
  cubeCamera.updateMatrixWorld(true);

  const previousToneMapping = renderer.toneMapping;
  renderer.toneMapping = NoToneMapping;
  cubeCamera.update(renderer, scene);
  renderer.toneMapping = previousToneMapping;

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromCubemap(cubeTarget.texture);
  pmrem.dispose();
  cubeTarget.dispose();

  return {
    target,
    position: [item.position[0], item.position[1], item.position[2]],
    radius: item.radius,
    intensity: item.intensity,
    priority: item.priority,
    resolution: item.resolution,
    parallax: item.parallax,
    near: item.near,
    far: item.far,
  };
}

/** Frees a baked probe's PMREM render target. */
export function disposeSphereReflectionCaptureBake(bake: SphereReflectionCaptureBake): void {
  bake.target.dispose();
}

/**
 * True when a cached bake no longer reflects the probe it was taken from: the probe
 * moved, or its `near`/`far` changed, since the capture. (Radius/intensity/priority
 * are live-patched onto the cache and resolution forces a re-bake, so none of those
 * make a bake stale.) Drives the editor's stale-bake indicator; it does not detect
 * scene-content changes (objects moving), which still need an explicit Recapture.
 */
export function isReflectionCaptureBakeStale(
  bake: SphereReflectionCaptureBake,
  item: SphereReflectionCaptureRenderItem,
): boolean {
  return (
    bake.position[0] !== item.position[0] ||
    bake.position[1] !== item.position[1] ||
    bake.position[2] !== item.position[2] ||
    bake.near !== item.near ||
    bake.far !== item.far
  );
}

/** A `MeshStandardMaterial` (or subclass) — the only materials that take a probe envMap. */
function isProbeEnvMaterial(material: Material): material is MeshStandardMaterial {
  return material instanceof MeshStandardMaterial;
}

/** The shader param object three.js hands `onBeforeCompile` (uniforms + GLSL sources). */
type ShaderPatch = Parameters<MeshStandardMaterial["onBeforeCompile"]>[0];

/**
 * `customProgramCacheKey` prefix for capture-patched materials. All clones with the
 * same feature flags share one compiled program (the per-probe position/radius and
 * the global-env sampler ride in as uniforms), so the key only encodes which GLSL
 * branches are present — enough to keep patched programs from colliding with the
 * stock standard/physical program or with a differently-patched one.
 */
const CAPTURE_CACHE_KEY_BASE = "forge-reflection-capture";

// onBeforeCompile receives the shader sources with `#include <...>` directives
// still UNEXPANDED, so we anchor on the raw includes — not on text that only
// exists after three.js resolves them. The vertex include yields `worldPosition`;
// the fragment include is the IBL chunk we patch (its reflect/sample lines), so we
// expand that chunk inline rather than leaving the directive.

/** Vertex-shader include after which `worldPosition` is in scope (USE_ENVMAP is set). */
const CAPTURE_WORLDPOS_INCLUDE = "#include <worldpos_vertex>";
/** Fragment-shader include for the IBL chunk that owns the reflection lookup. */
const CAPTURE_FRAGMENT_INCLUDE = "#include <envmap_physical_pars_fragment>";
/** Line inside the IBL chunk where `reflectVec` becomes the world-space reflection dir. */
const CAPTURE_REFLECT_LINE = "reflectVec = inverseTransformDirection( reflectVec, viewMatrix );";
/** Line inside the IBL chunk that samples the probe envMap into `envMapColor`. */
const CAPTURE_ENVCOLOR_LINE =
  "vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );";

/** Forwards the fragment world position the patch needs (parallax + blend score). */
const CAPTURE_VERTEX_ASSIGN = `${CAPTURE_WORLDPOS_INCLUDE}\n\tvCaptureWorldPos = worldPosition.xyz;`;

/** Snapshot of the un-parallaxed world reflection dir, for sampling the global env. */
const CAPTURE_GLOBAL_REFLECT_SAVE = `\n\t\t\tvec3 captureReflectGlobal = reflectVec;`;

/**
 * Sphere-bounded parallax correction injected after `reflectVec` becomes the
 * world-space reflection direction: intersect the reflection ray with the probe's
 * influence sphere and re-aim the cubemap lookup at that hit. Without this the
 * cubemap is sampled as if infinitely far (flat-looking on planar surfaces); with
 * it the reflection tracks the fragment's position inside the probe sphere.
 */
const CAPTURE_PARALLAX_BLOCK = `
			{
				vec3 captureToFrag = vCaptureWorldPos - captureProbePosition;
				float captureB = dot( reflectVec, captureToFrag );
				float captureC = dot( captureToFrag, captureToFrag ) - captureProbeRadius * captureProbeRadius;
				float captureDisc = captureB * captureB - captureC;
				if ( captureDisc > 0.0 ) {
					float captureDist = - captureB + sqrt( captureDisc );
					if ( captureDist > 0.0 ) {
						reflectVec = normalize( vCaptureWorldPos + reflectVec * captureDist - captureProbePosition );
					}
				}
			}`;

/** Falloff start: the probe is at full strength inside this fraction of its radius. */
const CAPTURE_BLEND_START = 0.7;

/**
 * Overlap blend injected after the probe envMap is sampled: fades the probe sample
 * toward the global Reflection Environment near the probe's radius edge, so a
 * covered surface does not hard-cut to the global IBL at the boundary. The weight
 * ramps from 1 (full probe) inside `CAPTURE_BLEND_START` of the radius down to 0
 * (full global) at the radius. The global env is sampled with the un-parallaxed
 * reflection dir since it is infinitely far.
 */
const CAPTURE_BLEND_BLOCK = `
			{
				float captureScore = length( vCaptureWorldPos - captureProbePosition ) / captureProbeRadius;
				float captureWeight = 1.0 - smoothstep( ${CAPTURE_BLEND_START.toFixed(2)}, 1.0, captureScore );
				vec4 captureGlobalColor = textureCubeUV( captureGlobalEnv, envMapRotation * captureReflectGlobal, roughness );
				envMapColor = mix( captureGlobalColor, envMapColor, captureWeight );
			}`;

/**
 * Installs the reflection-capture fragment patch on a probe-envMap material via
 * `onBeforeCompile`, combining two optional features that share the same world
 * position + probe uniforms:
 *
 * - **parallax**: re-aims the IBL reflection lookup at the probe sphere (Faz 4).
 * - **boundary blend**: when `globalEnv` is given, fades the probe sample toward
 *   the global Reflection Environment near the probe radius edge (Faz 5), softening
 *   the hard probe→global cut.
 *
 * Inlines the IBL chunk from `ShaderChunk` so the patch survives three.js' (still
 * unexpanded at this point) `#include` directives, and forwards `worldPosition` from
 * the vertex stage. `customProgramCacheKey` encodes the active features so patched
 * programs do not collide. A no-op when neither feature is requested; degrades to a
 * plain envMap if the three.js shader anchors ever move.
 */
function installCaptureShaderPatch(
  material: MeshStandardMaterial,
  position: Vec3,
  radius: number,
  parallax: boolean,
  globalEnv: Texture | null,
): void {
  const blend = globalEnv !== null;
  if (!parallax && !blend) return;
  const probePosition = new Vector3(position[0], position[1], position[2]);
  const probeRadius = Math.max(radius, 0.001);
  material.onBeforeCompile = (shader: ShaderPatch) => {
    const iblChunk = ShaderChunk.envmap_physical_pars_fragment;
    if (
      !shader.vertexShader.includes(CAPTURE_WORLDPOS_INCLUDE) ||
      !shader.fragmentShader.includes(CAPTURE_FRAGMENT_INCLUDE) ||
      !iblChunk.includes(CAPTURE_REFLECT_LINE) ||
      (blend && !iblChunk.includes(CAPTURE_ENVCOLOR_LINE))
    ) {
      return;
    }
    shader.uniforms.captureProbePosition = { value: probePosition };
    shader.uniforms.captureProbeRadius = { value: probeRadius };
    if (blend) shader.uniforms.captureGlobalEnv = { value: globalEnv };
    shader.vertexShader = `varying vec3 vCaptureWorldPos;\n${shader.vertexShader.replace(
      CAPTURE_WORLDPOS_INCLUDE,
      CAPTURE_VERTEX_ASSIGN,
    )}`;
    // Expand the IBL chunk inline, splicing the requested blocks in, then replace the
    // directive so three.js does not re-expand the stock chunk over the patched one.
    let patchedChunk = iblChunk.replace(
      CAPTURE_REFLECT_LINE,
      `${CAPTURE_REFLECT_LINE}${blend ? CAPTURE_GLOBAL_REFLECT_SAVE : ""}${parallax ? CAPTURE_PARALLAX_BLOCK : ""}`,
    );
    if (blend) {
      patchedChunk = patchedChunk.replace(
        CAPTURE_ENVCOLOR_LINE,
        `${CAPTURE_ENVCOLOR_LINE}${CAPTURE_BLEND_BLOCK}`,
      );
    }
    const decls =
      "uniform vec3 captureProbePosition;\nuniform float captureProbeRadius;\nvarying vec3 vCaptureWorldPos;\n" +
      (blend ? "uniform sampler2D captureGlobalEnv;\n" : "");
    shader.fragmentShader = `${decls}${shader.fragmentShader.replace(
      CAPTURE_FRAGMENT_INCLUDE,
      patchedChunk,
    )}`;
  };
  material.customProgramCacheKey = () =>
    `${CAPTURE_CACHE_KEY_BASE}-p${parallax ? 1 : 0}b${blend ? 1 : 0}`;
  material.needsUpdate = true;
}

/**
 * Returns a material carrying the probe's local envMap: clones the standard `base`
 * material and assigns the PMREM texture + `envMapIntensity` (tracking the clone in
 * `clonedMaterials` for later disposal). When the probe has `parallax` on, or a
 * `globalEnv` (the global Reflection Environment) is supplied for boundary blend,
 * the clone also gets the capture shader patch. Non-standard materials (e.g.
 * `MeshBasicMaterial`) are returned unchanged. Shared by the editor + runtime
 * clone-fallback paths so a probe-covered surface samples the local capture.
 */
export function assignProbeEnvMapMaterial(
  base: Material,
  bake: SphereReflectionCaptureBake,
  clonedMaterials: Material[],
  globalEnv: Texture | null = null,
): Material {
  if (!isProbeEnvMaterial(base)) return base;
  const cloned = base.clone();
  cloned.envMap = bake.target.texture;
  cloned.envMapIntensity = bake.intensity;
  installCaptureShaderPatch(cloned, bake.position, bake.radius, bake.parallax, globalEnv);
  cloned.needsUpdate = true;
  clonedMaterials.push(cloned);
  return cloned;
}

/**
 * Assigns (or clears) a probe envMap on an individual object's standard-material
 * surfaces in place. The object's original materials are remembered on first touch
 * (`userData.captureBaseMaterial`); with a `bake` they are cloned + given the probe
 * envMap, without one they are restored so the global `scene.environment` applies.
 * Prior per-object clones are disposed before re-cloning. Shared by editor +
 * runtime so characters/actors reflect identically in both.
 */
export function applyProbeEnvMapToObject(
  object: Object3D,
  bake: SphereReflectionCaptureBake | null,
  globalEnv: Texture | null = null,
): void {
  const previous = object.userData.captureMaterials as Material[] | undefined;
  if (previous) for (const material of previous) material.dispose();
  const cloned: Material[] = [];
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.captureBaseMaterial === undefined) {
      mesh.userData.captureBaseMaterial = mesh.material;
    }
    const base = mesh.userData.captureBaseMaterial as Material | Material[];
    if (!bake) {
      mesh.material = base;
      return;
    }
    mesh.material = Array.isArray(base)
      ? base.map((material) => assignProbeEnvMapMaterial(material, bake, cloned, globalEnv))
      : assignProbeEnvMapMaterial(base, bake, cloned, globalEnv);
  });
  object.userData.captureMaterials = cloned;
}
