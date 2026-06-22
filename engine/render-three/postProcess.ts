import {
  ACESFilmicToneMapping,
  NeutralToneMapping,
  NoToneMapping,
  Vector2,
  type Camera,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from "three";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { RGBShiftShader } from "three/examples/jsm/shaders/RGBShiftShader.js";
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader.js";

import type { ResolvedPostProcess } from "@engine/scene/postProcess";

export {
  POST_PROCESS_DEFAULTS,
  resolvePostProcess,
  type PostProcessToneMapping,
  type ResolvedPostProcess,
} from "@engine/scene/postProcess";

export const POST_PROCESS_RENDER_EXPOSURE_SCALE = 0.2;

export function postProcessToneMappingExposure(exposure: number): number {
  return Math.max(0, exposure * POST_PROCESS_RENDER_EXPOSURE_SCALE);
}

/** Applies the renderer-property part of the global Post Process singleton. */
export function applyPostProcessToneMapping(
  renderer: WebGLRenderer,
  resolved: ResolvedPostProcess | null,
): void {
  if (!resolved || resolved.hidden) return;
  if (resolved.toneMapping === "aces") {
    renderer.toneMapping = ACESFilmicToneMapping;
  } else if (resolved.toneMapping === "neutral") {
    renderer.toneMapping = NeutralToneMapping;
  } else {
    renderer.toneMapping = NoToneMapping;
  }
  renderer.toneMappingExposure = postProcessToneMappingExposure(resolved.exposure);
}

const COLOR_GRADING_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1 },
    contrast: { value: 1 },
    temperature: { value: 0 },
    tint: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    uniform float temperature;
    uniform float tint;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      // White balance: temperature warms (+) / cools (-); tint shifts magenta (+) / green (-).
      color.r += temperature * 0.1;
      color.b -= temperature * 0.1;
      color.g -= tint * 0.1;
      color.rgb = (color.rgb - 0.5) * contrast + 0.5;
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, saturation);
      gl_FragColor = color;
    }
  `,
};

/**
 * Bloom strength is authored in intuitive ~1-based units (1 = the standard sun
 * bloom look, matching threshold/radius) but the analytic Sky sun disc has
 * enormous linear-HDR radiance, so a tiny actual UnrealBloomPass strength already
 * reads strongly. This factor maps authored intensity to that strength (1 → 0.001).
 */
const BLOOM_INTENSITY_SCALE = 0.001;

/**
 * Authored chromatic-aberration amount (~1-based) maps to the RGBShift shader's
 * UV shift distance, which is tiny (its default 0.005 is already visible). This
 * factor keeps the authored slider intuitive (0.5 → the 0.005 default look).
 */
const CHROMATIC_ABERRATION_AMOUNT_SCALE = 0.01;

/**
 * DoF is authored against the 100u far-plane scale. `focusDistance` is passed
 * straight through as world units; `aperture`/`maxBlur` are authored ~1-based and
 * scaled to the BokehShader's much smaller blur units (factor·aperture clamped to
 * maxblur, where the depth `factor` can reach ~90 in this scene).
 */
const DOF_APERTURE_SCALE = 0.0002;
const DOF_MAXBLUR_SCALE = 0.01;

/** Returns true when the grading ShaderPass would change the image at all. */
function hasColorGrading(resolved: ResolvedPostProcess): boolean {
  return (
    resolved.saturation !== 1 ||
    resolved.contrast !== 1 ||
    resolved.temperature !== 0 ||
    resolved.tint !== 0
  );
}

export function createPostProcessEffectPasses(
  resolved: ResolvedPostProcess | null,
  context: { scene: Scene; camera: PerspectiveCamera; width: number; height: number },
): Pass[] {
  if (!resolved || resolved.hidden) return [];
  const { width, height } = context;
  const passes: Pass[] = [];
  // Order (Section E): DoF near beauty → Bloom → grading → chromatic aberration →
  // vignette → grain, with OutlinePass/OutputPass appended later by the pipeline.
  if (resolved.dof.enabled) {
    const bokehPass = new BokehPass(context.scene, context.camera, {
      focus: resolved.dof.focusDistance,
      aperture: resolved.dof.aperture * DOF_APERTURE_SCALE,
      maxblur: resolved.dof.maxBlur * DOF_MAXBLUR_SCALE,
    });
    // BokehPass starts with a 1x1 depth target; size it before it enters the chain.
    bokehPass.setSize(width, height);
    passes.push(bokehPass);
  }
  if (resolved.bloom.enabled) {
    passes.push(
      new UnrealBloomPass(
        new Vector2(width, height),
        resolved.bloom.intensity * BLOOM_INTENSITY_SCALE,
        resolved.bloom.radius,
        resolved.bloom.threshold,
      ),
    );
  }
  if (hasColorGrading(resolved)) {
    const gradingPass = new ShaderPass(COLOR_GRADING_SHADER);
    gradingPass.uniforms.saturation!.value = resolved.saturation;
    gradingPass.uniforms.contrast!.value = resolved.contrast;
    gradingPass.uniforms.temperature!.value = resolved.temperature;
    gradingPass.uniforms.tint!.value = resolved.tint;
    passes.push(gradingPass);
  }
  if (resolved.chromaticAberration.enabled) {
    const caPass = new ShaderPass(RGBShiftShader);
    caPass.uniforms.amount!.value =
      resolved.chromaticAberration.amount * CHROMATIC_ABERRATION_AMOUNT_SCALE;
    passes.push(caPass);
  }
  if (resolved.vignette.enabled) {
    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms.offset!.value = resolved.vignette.offset;
    vignettePass.uniforms.darkness!.value = resolved.vignette.intensity;
    passes.push(vignettePass);
  }
  if (resolved.grain.enabled) {
    // FilmShader is pure grain (no scanlines) in three r150+, so no toggle needed.
    passes.push(new FilmPass(resolved.grain.intensity, false));
  }
  return passes;
}

export function hasPostProcessEffectPasses(resolved: ResolvedPostProcess | null): boolean {
  return Boolean(
    resolved &&
      !resolved.hidden &&
      (resolved.bloom.enabled ||
        resolved.vignette.enabled ||
        resolved.dof.enabled ||
        resolved.chromaticAberration.enabled ||
        resolved.grain.enabled ||
        hasColorGrading(resolved)),
  );
}

/**
 * Shared composer backbone for editor/runtime post-process work. F2.0 only owns
 * RenderPass/OutputPass and lets callers inject editor-only passes before output.
 */
export class PostProcessPipeline {
  private readonly composer: EffectComposer;
  private readonly outputPass: OutputPass;
  private readonly injectedPasses: Pass[] = [];
  private effectPasses: Pass[] = [];

  constructor(options: {
    renderer: WebGLRenderer;
    scene: Scene;
    camera: Camera;
    width: number;
    height: number;
  }) {
    this.composer = new EffectComposer(options.renderer);
    this.composer.addPass(new RenderPass(options.scene, options.camera));
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
    this.composer.setSize(options.width, options.height);
  }

  addPassBeforeOutput(pass: Pass): void {
    const outputIndex = this.composer.passes.indexOf(this.outputPass);
    this.composer.insertPass(pass, outputIndex >= 0 ? outputIndex : this.composer.passes.length);
    this.injectedPasses.push(pass);
  }

  setEffectPasses(passes: Pass[]): void {
    for (const pass of this.effectPasses) {
      this.composer.removePass(pass);
      pass.dispose();
    }
    this.effectPasses = passes;
    const firstInjectedIndex = this.injectedPasses
      .map((pass) => this.composer.passes.indexOf(pass))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];
    const outputIndex = this.composer.passes.indexOf(this.outputPass);
    const insertIndex =
      firstInjectedIndex ?? (outputIndex >= 0 ? outputIndex : this.composer.passes.length);
    passes.forEach((pass, offset) => {
      this.composer.insertPass(pass, insertIndex + offset);
    });
  }

  render(deltaSeconds: number): void {
    this.composer.render(deltaSeconds);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  dispose(): void {
    for (const pass of this.effectPasses) pass.dispose();
    for (const pass of this.injectedPasses) pass.dispose();
    this.outputPass.dispose();
    this.composer.dispose();
  }
}
