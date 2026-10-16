import { Texture } from 'pixi.js';
export const gaborTextureSpecs = [
  { size: 256, freq: 0.05, angle: 0 },
  { size: 256, freq: 0.08, angle: Math.PI / 4 },
  { size: 256, freq: 0.03, angle: Math.PI / 2 },
] as const;

const gaborTextureCache = new Map<string, Texture>();

export function GetGaborTexture(size: number, freq: number, angle: number): Texture {
  const key = `${size}:${freq}:${angle}`;
  const cached = gaborTextureCache.get(key);
  if (cached) return cached;

  const texture = Texture.from(CreateGaborCanvas(size, freq, angle));
  gaborTextureCache.set(key, texture);
  return texture;
}

export function CreateGaborCanvas(size: number, freq: number, angle: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;
  const cx = size / 2;
  const cy = size / 2;
  const sigma = size / 6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const gauss = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      const phase = dx * Math.cos(angle) + dy * Math.sin(angle);
      const sine = Math.sin(2 * Math.PI * freq * phase);

      const intensity = Math.round(128 + 127 * gauss * sine);
      const alpha = Math.round(255 * gauss);

      const i = (y * size + x) * 4;
      data[i] = intensity;
      data[i + 1] = intensity;
      data[i + 2] = intensity;
      data[i + 3] = alpha;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export function DisposeGaborTextures() {
  for (const texture of gaborTextureCache.values()) texture.destroy(true);
  gaborTextureCache.clear();
}
