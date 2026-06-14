export function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return length;
  return Math.max(0, Math.min(length, Math.trunc(index)));
}

export function round(value: number): number {
  return Number(value.toFixed(2));
}

export function snapValue(value: number, step: number, enabled = true): number {
  if (!enabled || !Number.isFinite(step) || step <= 0) return round(value);
  return round(Math.round(value / step) * step);
}

export function snapStatus(enabled: boolean, step: number): string {
  return enabled ? String(step) : "off";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
