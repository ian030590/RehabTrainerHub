export interface Frame {
  w: number; h: number; ox: number; oy: number; color: Uint32Array; light: Uint32Array;
}
export interface EffectModule {
  meta: { duration: number; loop: boolean; options: Record<string, unknown> };
  create: unknown;
}
export interface Effect {
  update: (seconds: number) => void;
  draw: (frame: Frame, layer: 'back' | 'front') => void;
  done: () => boolean;
}
export function CreateFrame(width: number, height: number): Frame;
export function ClearFrame(frame: Frame): Frame;
export function Composite(frame: Frame, output: Uint8ClampedArray, background: null): Uint8ClampedArray;
export function CreateFx(module: EffectModule, options: Record<string, unknown>): Effect;
