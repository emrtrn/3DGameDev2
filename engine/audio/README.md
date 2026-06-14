# Engine Audio

Runtime audio layer.

- `audioSubsystem.ts`: Web Audio-backed one-shot playback with a no-op
  headless path. Behaviors call the `AudioBus` contract; tests can inspect
  recorded play requests without a browser audio device.
