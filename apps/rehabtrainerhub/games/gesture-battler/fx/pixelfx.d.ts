declare module '*pixelfx/core/index.js' {
  export interface FxModule {
    meta: { duration: number; loop: boolean; size: readonly number[]; origin: readonly number[] };
  }
  export interface FxFrame { w: number; h: number; color: Uint32Array; light: Uint32Array }
  export interface FxInstance {
    update(seconds: number): void;
    draw(frame: FxFrame, layer: 'back' | 'front'): void;
    done(): boolean;
  }
  export function createFrame(width: number, height: number, x?: number, y?: number): FxFrame;
  export function clearFrame(frame: FxFrame): void;
  export function createFx(module: FxModule, options: Record<string, unknown>): FxInstance;
  export function composite(frame: FxFrame, pixels: Uint8ClampedArray, background: null): void;
}
declare module '*pixelfx/fx/melee/sword-slash.js' {
  export const meta: { duration: number; loop: boolean; size: readonly number[]; origin: readonly number[] };
}
declare module '*pixelfx/fx/arcane/mana-burst.js' {
  export const meta: { duration: number; loop: boolean; size: readonly number[]; origin: readonly number[] };
}
declare module '*pixelfx/fx/impacts/hit-spark.js' {
  export const meta: { duration: number; loop: boolean; size: readonly number[]; origin: readonly number[] };
}
declare module '*pixelfx/fx/spawn/poof.js' {
  export const meta: { duration: number; loop: boolean; size: readonly number[]; origin: readonly number[] };
}
