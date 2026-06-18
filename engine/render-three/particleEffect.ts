/**
 * Minimal CPU-simulated particle effect for the runtime VFX path. Renders a
 * pre-authored effect asset (`.effect.json`, parsed by {@link parseEffectDefinition})
 * as a `THREE.Points` cloud with soft round, color-tinted particles. Emission is
 * driven by `rate`/`lifetime`; each particle ages out, growing `startSize`→`endSize`
 * and fading. A non-looping effect emits for one `lifetime` window then finishes.
 *
 * Deliberately simple (no textures, no GPU sim, no sub-emitters) — a first VFX
 * version that makes authored effects visible on Play. The pure parser is
 * headless-testable; the renderer class is Three.js glue like the other
 * render-three modules.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  Points,
  ShaderMaterial,
} from "three";

export type EffectMaterialMode = "additive" | "alpha";

/** Typed `.effect.json` definition (schema 1). */
export interface EffectDefinition {
  effectId: string;
  name?: string;
  loop: boolean;
  /** Particles spawned per second. */
  rate: number;
  /** Particle lifetime in seconds. */
  lifetime: number;
  startSize: number;
  endSize: number;
  velocity: [number, number, number];
  /** Random spread applied to spawn velocity/position. */
  spread: number;
  materialMode: EffectMaterialMode;
  /** Particle tint (hex). */
  color: string;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Parses + validates a `.effect.json` effect definition. Returns null when the
 * value is not a schema-1 object with a non-empty `effectId`; missing optional
 * fields fall back to sensible defaults.
 */
export function parseEffectDefinition(value: unknown): EffectDefinition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.schema !== 1) return null;
  if (typeof data.effectId !== "string" || data.effectId.length === 0) return null;

  const velocity: [number, number, number] =
    Array.isArray(data.velocity) &&
    data.velocity.length === 3 &&
    data.velocity.every((axis) => typeof axis === "number" && Number.isFinite(axis))
      ? [data.velocity[0] as number, data.velocity[1] as number, data.velocity[2] as number]
      : [0, 0, 0];

  const definition: EffectDefinition = {
    effectId: data.effectId,
    loop: data.loop === true,
    rate: Math.max(0, finiteNumber(data.rate, 10)),
    lifetime: Math.max(0.01, finiteNumber(data.lifetime, 1)),
    startSize: Math.max(0, finiteNumber(data.startSize, 0.2)),
    endSize: Math.max(0, finiteNumber(data.endSize, 0.2)),
    velocity,
    spread: Math.max(0, finiteNumber(data.spread, 0)),
    materialMode: data.materialMode === "additive" ? "additive" : "alpha",
    color:
      typeof data.color === "string" && /^#[0-9a-fA-F]{6}$/.test(data.color)
        ? data.color
        : "#ffffff",
  };
  if (typeof data.name === "string") definition.name = data.name;
  return definition;
}

const POINT_PIXEL_SCALE = 320;

const VERTEX_SHADER = `
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (uScale / max(0.001, -mv.z));
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT_SHADER = `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, dist);
  gl_FragColor = vec4(uColor, vAlpha * soft);
}
`;

/** A live, CPU-simulated instance of an effect definition, ready to add to a scene. */
export class ParticleEffect {
  readonly object3D: Points;
  private readonly definition: EffectDefinition;
  private readonly capacity: number;
  private readonly positions: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly velocities: Float32Array;
  /** Per-particle age in seconds; negative marks an inactive slot. */
  private readonly ages: Float32Array;
  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;
  private readonly origin: [number, number, number] = [0, 0, 0];
  private elapsed = 0;
  private spawnAccumulator = 0;

  constructor(definition: EffectDefinition) {
    this.definition = definition;
    // Max particles alive at once ≈ rate * lifetime; pad for spawn jitter.
    this.capacity = Math.max(8, Math.ceil(definition.rate * definition.lifetime) + 4);
    this.positions = new Float32Array(this.capacity * 3);
    this.sizes = new Float32Array(this.capacity);
    this.alphas = new Float32Array(this.capacity);
    this.velocities = new Float32Array(this.capacity * 3);
    this.ages = new Float32Array(this.capacity).fill(-1);

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("aSize", new BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute("aAlpha", new BufferAttribute(this.alphas, 1));
    this.material = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(definition.color) },
        uScale: { value: POINT_PIXEL_SCALE },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: definition.materialMode === "additive" ? AdditiveBlending : NormalBlending,
    });
    this.object3D = new Points(this.geometry, this.material);
    // Particles move past the emitter origin; skip frustum culling so the cloud
    // is not clipped by its (stationary) bounding sphere.
    this.object3D.frustumCulled = false;
  }

  /** Sets the emitter origin (world space) new particles spawn from. */
  setOrigin(x: number, y: number, z: number): void {
    this.origin[0] = x;
    this.origin[1] = y;
    this.origin[2] = z;
  }

  /** Advances the simulation by `dt` seconds and uploads the updated buffers. */
  update(dt: number): void {
    if (dt <= 0) return;
    const { lifetime, rate, startSize, endSize, loop } = this.definition;
    this.elapsed += dt;

    for (let i = 0; i < this.capacity; i += 1) {
      if (this.ages[i]! < 0) continue;
      const age = this.ages[i]! + dt;
      if (age >= lifetime) {
        this.ages[i] = -1;
        this.sizes[i] = 0;
        this.alphas[i] = 0;
        continue;
      }
      this.ages[i] = age;
      const t = age / lifetime;
      const base = i * 3;
      this.positions[base] = this.positions[base]! + this.velocities[base]! * dt;
      this.positions[base + 1] = this.positions[base + 1]! + this.velocities[base + 1]! * dt;
      this.positions[base + 2] = this.positions[base + 2]! + this.velocities[base + 2]! * dt;
      this.sizes[i] = startSize + (endSize - startSize) * t;
      this.alphas[i] = 1 - t;
    }

    // A looping effect emits forever; a one-shot emits for one lifetime window.
    if (loop || this.elapsed <= lifetime) {
      this.spawnAccumulator += rate * dt;
      while (this.spawnAccumulator >= 1) {
        this.spawnAccumulator -= 1;
        this.spawnParticle();
      }
    }

    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.aSize!.needsUpdate = true;
    this.geometry.attributes.aAlpha!.needsUpdate = true;
  }

  /** A non-looping effect is finished once it stopped emitting and all particles died. */
  isFinished(): boolean {
    if (this.definition.loop) return false;
    if (this.elapsed <= this.definition.lifetime) return false;
    for (let i = 0; i < this.capacity; i += 1) {
      if (this.ages[i]! >= 0) return false;
    }
    return true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  private spawnParticle(): void {
    let slot = -1;
    for (let i = 0; i < this.capacity; i += 1) {
      if (this.ages[i]! < 0) {
        slot = i;
        break;
      }
    }
    if (slot < 0) return;
    const { spread, velocity, startSize } = this.definition;
    const jitter = (): number => (Math.random() * 2 - 1) * spread;
    this.ages[slot] = 0;
    this.positions[slot * 3] = this.origin[0] + jitter() * 0.2;
    this.positions[slot * 3 + 1] = this.origin[1];
    this.positions[slot * 3 + 2] = this.origin[2] + jitter() * 0.2;
    this.velocities[slot * 3] = velocity[0] + jitter();
    this.velocities[slot * 3 + 1] = velocity[1] + (Math.random() * 2 - 1) * spread * 0.3;
    this.velocities[slot * 3 + 2] = velocity[2] + jitter();
    this.sizes[slot] = startSize;
    this.alphas[slot] = 1;
  }
}
