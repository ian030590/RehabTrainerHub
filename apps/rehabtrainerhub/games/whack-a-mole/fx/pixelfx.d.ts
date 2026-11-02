export interface PixelFrame {
  w: number;
  h: number;
  color: Uint32Array;
  light: Uint32Array;
}

export interface PixelEffect {
  meta: { size: [number, number]; origin: [number, number]; duration: number; loop: boolean };
}

export interface PixelInstance {
  update(dt: number): void;
  draw(frame: PixelFrame, layer: 'back' | 'front'): void;
  done(): boolean;
}

export interface PixelCore {
  createFrame(width: number, height: number): PixelFrame;
  clearFrame(frame: PixelFrame): void;
  composite(frame: PixelFrame, output: Uint8ClampedArray, background: null): void;
  createFx(effect: PixelEffect, options: { x: number; y: number; palette: string[]; seed: number; light: number;
    warm?: string; dust?: string; clod?: string }): PixelInstance;
}
