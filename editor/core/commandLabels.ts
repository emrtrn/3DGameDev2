export type EditorFlagCommand = "hidden" | "locked" | "scaleLocked" | "simulatePhysics";
export type EditorDefaultTrueFlagCommand = "castShadow" | "collision";

const FLAG_LABELS: Record<EditorFlagCommand, { on: string; off: string }> = {
  hidden: { on: "Hide object", off: "Show object" },
  locked: { on: "Lock object", off: "Unlock object" },
  scaleLocked: { on: "Lock scale ratio", off: "Unlock scale ratio" },
  simulatePhysics: { on: "Enable simulate physics", off: "Disable simulate physics" },
};

const DEFAULT_TRUE_FLAG_LABELS: Record<
  EditorDefaultTrueFlagCommand,
  { on: string; off: string }
> = {
  castShadow: { on: "Enable cast shadow", off: "Disable cast shadow" },
  collision: { on: "Enable collision", off: "Disable collision" },
};

export function flagCommandLabel(flag: EditorFlagCommand, value: boolean): string {
  return FLAG_LABELS[flag][value ? "on" : "off"];
}

export function defaultTrueFlagCommandLabel(
  flag: EditorDefaultTrueFlagCommand,
  value: boolean,
): string {
  return DEFAULT_TRUE_FLAG_LABELS[flag][value ? "on" : "off"];
}
