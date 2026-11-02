import { createFrame, clearFrame, createFx, composite, type PixelEffect } from './core/index.js';
import * as parry from './impacts/parry.js';
import * as debris from './impacts/blunt-hit.js';
import * as spark from './impacts/hit-spark.js';

export interface EffectRect { x: number; y: number; width: number; height: number }
export interface AsteroidEffectEvent {
  kind: 'block' | 'break' | 'damage';
  x: number;
  y: number;
  size: number;
}
interface ActiveEffect {
  fx: PixelEffect;
  x: number;
  y: number;
  scale: number;
  age: number;
  duration: number;
}

export class AsteroidEffects {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly scratch: HTMLCanvasElement;
  private readonly scratchContext: CanvasRenderingContext2D | null;
  private readonly frame = createFrame(200, 112);
  private readonly pixels: ImageData | undefined;
  private readonly view: Window;
  private readonly motion: MediaQueryList;
  private readonly palette: string[];
  private active: ActiveEffect[] = [];
  private seed = 0;
  private elapsed = 0;
  private suspended = false;
  private disposed = false;
  private finishRect: EffectRect | null = null;
  private readonly suspend = () => { this.suspended = true; this.clear(); };
  private readonly resume = () => { this.suspended = this.canvas.ownerDocument.hidden; };
  private readonly visibility = () => { this.clear(); this.resume(); };
  private readonly preference = () => { if (this.motion.matches) this.clear(); };
  private readonly scroll = () => this.clear();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.view = canvas.ownerDocument.defaultView!;
    this.motion = this.view.matchMedia('(prefers-reduced-motion: reduce)');
    this.scratch = canvas.ownerDocument.createElement('canvas');
    this.scratch.width = 200;
    this.scratch.height = 112;
    this.scratchContext = this.scratch.getContext('2d');
    this.pixels = this.scratchContext?.createImageData(200, 112);
    const style = this.view.getComputedStyle(canvas);
    this.palette = ['--primary-hover', '--primary', '--primary-soft', '--text-on-accent']
      .map(name => style.getPropertyValue(name).trim());
    this.resume();
    for (const event of ['blur', 'pagehide', 'game:pause']) this.view.addEventListener(event, this.suspend);
    this.view.addEventListener('focus', this.resume);
    canvas.ownerDocument.addEventListener('visibilitychange', this.visibility);
    canvas.ownerDocument.addEventListener('scroll', this.scroll, true);
    this.motion.addEventListener('change', this.preference);
  }

  get activeCount() { return this.active.length; }

  emit(event: AsteroidEffectEvent) {
    if (this.disposed || this.suspended || this.motion.matches || !this.context || !this.scratchContext || !this.pixels) return;
    const module = event.kind === 'block' ? parry : event.kind === 'break' ? debris : spark;
    const fx = createFx({ meta: module.meta, create: module.Create }, {
      x: 100, y: 80, height: 24, seed: ++this.seed, palette: this.palette,
      warm: this.palette[1], dust: this.palette[0], clod: this.palette[0], light: 0.18,
    });
    if (this.active.length === 8) this.active.shift();
    this.active.push({ fx, x: event.x, y: event.y, age: 0,
      scale: Math.min(0.9, Math.max(0.25, event.size / 85)) * (event.kind === 'damage' ? 0.65 : 1),
      duration: event.kind === 'block' ? 0.8 : module.meta.duration });
  }

  finish(rect: EffectRect) {
    this.clear();
    this.finishRect = rect;
    this.emit({ kind: 'block', x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, size: 32 });
  }

  update(seconds: number, protectedRects: EffectRect[] = []) {
    if (!this.active.length || this.disposed || !this.context || !this.scratchContext || !this.pixels) return;
    this.elapsed += seconds;
    // The Pixi ticker owns scheduling; only composite these small stamps at 30 fps.
    if (this.elapsed < 1 / 30) return;
    const dt = this.elapsed;
    this.elapsed = 0;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.imageSmoothingEnabled = false;
    for (const effect of this.active) {
      effect.age += dt;
      effect.fx.update(dt);
    }
    this.active = this.active.filter(effect => effect.age < effect.duration && !effect.fx.done());
    this.context.save();
    if (this.finishRect) {
      this.context.beginPath();
      this.context.rect(this.finishRect.x, this.finishRect.y, this.finishRect.width, this.finishRect.height);
      this.context.clip();
    }
    for (const effect of this.active) {
      clearFrame(this.frame);
      effect.fx.draw(this.frame, 'back');
      effect.fx.draw(this.frame, 'front');
      composite(this.frame, this.pixels.data, null);
      this.scratchContext.putImageData(this.pixels, 0, 0);
      this.context.globalAlpha = Math.min(0.75, (effect.duration - effect.age) / 0.15);
      this.context.drawImage(this.scratch, effect.x - 100 * effect.scale, effect.y - 56 * effect.scale,
        200 * effect.scale, 112 * effect.scale);
    }
    this.context.restore();
    for (const rect of protectedRects) this.context.clearRect(rect.x, rect.y, rect.width, rect.height);
    if (!this.active.length) this.clear();
  }

  resize(width: number, height: number) {
    if (this.disposed) return;
    this.clear();
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height));
  }

  clear() {
    this.active = [];
    this.elapsed = 0;
    this.finishRect = null;
    this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  dispose() {
    this.clear();
    this.disposed = true;
    for (const event of ['blur', 'pagehide', 'game:pause']) this.view.removeEventListener(event, this.suspend);
    this.view.removeEventListener('focus', this.resume);
    this.canvas.ownerDocument.removeEventListener('visibilitychange', this.visibility);
    this.canvas.ownerDocument.removeEventListener('scroll', this.scroll, true);
    this.motion.removeEventListener('change', this.preference);
    this.scratch.width = this.scratch.height = 0;
  }
}
