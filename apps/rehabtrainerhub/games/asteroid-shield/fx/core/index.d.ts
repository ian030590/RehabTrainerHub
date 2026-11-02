export interface PixelFrame {
  w: number;
  h: number;
  color: Uint32Array;
  light: Uint32Array;
}
export interface EffectModule {
  meta: { duration: number; loop: boolean; options: Record<string, unknown> };
  Create: (options: Record<string, unknown>) => unknown;
}
export interface PixelEffect {
  update: (seconds: number) => void;
  draw: (frame: PixelFrame, layer: 'back' | 'front') => void;
  done: () => boolean;
}
export function createFrame(width: number, height: number): PixelFrame;
export function clearFrame(frame: PixelFrame): void;
export function createFx(module: { meta: EffectModule['meta']; create: EffectModule['Create'] }, options: Record<string, unknown>): PixelEffect;
export function composite(frame: PixelFrame, output: Uint8ClampedArray, background: null): void;
