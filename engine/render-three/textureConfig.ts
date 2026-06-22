import {
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";

export interface ForgeTextureRepeat {
  x: number;
  y: number;
}

export interface ForgeTextureConfig {
  srgb?: boolean;
  repeat?: ForgeTextureRepeat | null;
  anisotropy?: number;
  maxAnisotropy?: number | null | undefined;
}

const DEFAULT_REPEAT: ForgeTextureRepeat = { x: 1, y: 1 };
const DEFAULT_ANISOTROPY_CAP = 8;

export function configureForgeTexture(
  texture: Texture,
  config: ForgeTextureConfig = {},
): Texture {
  const repeat = config.repeat ?? DEFAULT_REPEAT;
  texture.colorSpace = config.srgb ? SRGBColorSpace : NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat.x, repeat.y);
  texture.anisotropy = resolveTextureAnisotropy(config);
  texture.needsUpdate = true;
  return texture;
}

function resolveTextureAnisotropy(config: ForgeTextureConfig): number {
  const max = Number(config.maxAnisotropy);
  const maxAnisotropy = Number.isFinite(max) && max > 0 ? max : 1;
  const requested = Number.isFinite(config.anisotropy)
    ? Number(config.anisotropy)
    : Math.min(DEFAULT_ANISOTROPY_CAP, maxAnisotropy);
  return Math.min(Math.max(1, requested), maxAnisotropy);
}
