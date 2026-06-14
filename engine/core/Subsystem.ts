export interface EngineUpdateContext {
  deltaSeconds: number;
  elapsedSeconds: number;
  frame: number;
}

export interface Subsystem {
  readonly id: string;
  init?(): void | Promise<void>;
  start?(): void | Promise<void>;
  update?(context: EngineUpdateContext): void;
  dispose?(): void | Promise<void>;
}
