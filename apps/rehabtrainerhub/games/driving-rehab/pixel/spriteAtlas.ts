// Sprite atlas access for the pixel renderer. The atlas is a plain image, so
// it loads under the runner's img-src policy without fetch.

export interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
  ppm: number;
  aspect?: number;
}

export interface SpriteSheet {
  width: number;
  height: number;
  frames: Record<string, SpriteFrame>;
}

export interface SpriteSource {
  image: CanvasImageSource;
  x: number;
  y: number;
  w: number;
  h: number;
  frame: SpriteFrame;
}

export function LoadSpriteAtlasImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load driving sprites.'));
    image.src = url;
  });
}

const fogLevels = 6;

// Fog is baked into small cached canvases per frame and fog level, so drawing
// stays a plain drawImage call and never reads pixels back.
export class SpriteAtlas {
  private readonly tinted = new Map<string, HTMLCanvasElement>();

  constructor(
    private readonly image: CanvasImageSource,
    private readonly sheet: SpriteSheet,
    private readonly fogColor: string,
  ) {}

  frame(name: string): SpriteFrame | undefined {
    return this.sheet.frames[name];
  }

  // fog runs from 0 (clear) to 1 (fully fog-coloured).
  source(name: string, fog = 0): SpriteSource | null {
    const frame = this.sheet.frames[name];
    if (!frame) return null;
    const fogLevel = Math.max(0, Math.min(fogLevels, Math.round(fog * fogLevels)));
    if (fogLevel === 0) {
      return { image: this.image, x: frame.x, y: frame.y, w: frame.w, h: frame.h, frame };
    }
    const key = `${name}|${fogLevel}`;
    let canvas = this.tinted.get(key);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = frame.w;
      canvas.height = frame.h;
      const context = canvas.getContext('2d');
      if (context) {
        context.imageSmoothingEnabled = false;
        context.drawImage(this.image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
        context.globalCompositeOperation = 'source-atop';
        context.globalAlpha = fogLevel / fogLevels;
        context.fillStyle = this.fogColor;
        context.fillRect(0, 0, frame.w, frame.h);
      }
      this.tinted.set(key, canvas);
    }
    return { image: canvas, x: 0, y: 0, w: frame.w, h: frame.h, frame };
  }

  dispose() {
    this.tinted.clear();
  }
}
