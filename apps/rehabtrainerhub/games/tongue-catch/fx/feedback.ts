import { ClearFrame, Composite, CreateFrame, CreateFx, type Effect } from './core/index.js';
import { effects } from './effects/index.js';
import type { Apple, TongueLabel, TongueSession } from '../logic/tongueCatch';

type Point = { x: number; y: number };
type Rect = { left: number; top: number; width: number; height: number };
type View = { width: number; height: number; rect: Rect };
type FeedbackKind = keyof typeof effects;
type FeedbackPlayer = { Play: (kind: FeedbackKind, point?: Point) => void };

export function ReadTongueProtectedRects(root: Document, results: boolean) {
  const selectors = results ? '.score-priority, .score-context, .score-analysis, .score-save-status, .experiment-results button'
    : '.tongue-hud, .tongue-face-warning, .tongue-calibration-overlay, .tongue-cue, button';
  const rects: Rect[] = Array.from(root.querySelectorAll(selectors), element => element.getBoundingClientRect());
  if (results) {
    for (const element of root.querySelectorAll('.score-header h1, .score-header p')) {
      const range = root.createRange();
      range.selectNodeContents(element);
      rects.push(...range.getClientRects());
    }
  }
  return rects;
}

// The overlay uses half the CSS resolution; Pixi's backing store can have a different pixel density.
export function StagePointToCanvas(point: Point, view: View, overlay: Rect) {
  return { x: (view.rect.left - overlay.left + point.x * view.rect.width / view.width) / 2,
    y: (view.rect.top - overlay.top + point.y * view.rect.height / view.height) / 2 };
}

export function EmitTongueFeedback(feedback: FeedbackPlayer | null, apples: readonly Apple[], previousHold: TongueLabel | null,
  session: TongueSession, events: { caught: readonly number[] }) {
  for (const id of events.caught) {
    const apple = apples.find(item => item.id === id);
    if (apple) feedback?.Play('collect', { x: apple.x, y: apple.y });
  }
  if (session.holdDirection && session.holdDirection !== previousHold) {
    feedback?.Play('movement', { x: session.mouthX + session.tongueDirection * 80, y: session.mouthY - 72 });
  }
}

export function CreateTongueFeedback(canvas: HTMLCanvasElement, readView: () => View | null, readProtected: () => Rect[]) {
  const context = canvas.getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const style = getComputedStyle(document.documentElement);
  const palette = ['--tongue-rope-edge', '--tongue-rope-dark', '--tongue-rope-light', '--tongue-cue-glow', '--surface']
    .map(token => style.getPropertyValue(token).trim());
  let active: { kind: FeedbackKind; effect: Effect; age: number; duration: number; speed: number }[] = [];
  const celebration = document.createElement('canvas');
  celebration.width = 200;
  celebration.height = 140;
  const celebrationContext = celebration.getContext('2d');
  const celebrationFrame = CreateFrame(200, 140);
  const celebrationPixels = new ImageData(200, 140);
  let frame = CreateFrame(1, 1);
  let pixels = new ImageData(1, 1);
  let raf = 0;
  let last = 0;
  let seed = 0;
  let disposed = false;
  let focused = document.hasFocus();
  let lastMovement = -Infinity;

  const clear = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    active = [];
    ClearFrame(frame);
    ClearFrame(celebrationFrame);
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };
  const tick = (now: number) => {
    raf = 0;
    if (disposed || motion.matches || document.hidden || !focused || !context) { clear(); return; }
    const bounds = canvas.getBoundingClientRect();
    if (canvas.width !== Math.ceil(bounds.width / 2) || canvas.height !== Math.ceil(bounds.height / 2)) {
      canvas.width = Math.max(1, Math.ceil(bounds.width / 2));
      canvas.height = Math.max(1, Math.ceil(bounds.height / 2));
      frame = CreateFrame(canvas.width, canvas.height);
      pixels = new ImageData(canvas.width, canvas.height);
    }
    const elapsed = Math.max(0, (now - last) / 1000);
    last = now;
    ClearFrame(frame);
    ClearFrame(celebrationFrame);
    for (const item of active) {
      item.age += elapsed;
      if (item.age >= item.duration) continue;
      item.effect.update(Math.min(elapsed, 0.05) * item.speed);
      const target = item.kind === 'complete' ? celebrationFrame : frame;
      item.effect.draw(target, 'back');
      item.effect.draw(target, 'front');
    }
    active = active.filter(item => item.age < item.duration && !item.effect.done());
    if (!active.length) { clear(); return; }
    Composite(frame, pixels.data, null);
    context.putImageData(pixels, 0, 0);
    if (active.some(item => item.kind === 'complete') && celebrationContext) {
      Composite(celebrationFrame, celebrationPixels.data, null);
      celebrationContext.putImageData(celebrationPixels, 0, 0);
      const width = Math.min(160, bounds.width * 0.36);
      context.imageSmoothingEnabled = false;
      context.drawImage(celebration, (bounds.width - width - 12) / 2, 4, width / 2, width * 0.35);
    }
    for (const rect of readProtected()) {
      context.clearRect((rect.left - bounds.left) / 2, (rect.top - bounds.top) / 2, rect.width / 2, rect.height / 2);
    }
    raf = requestAnimationFrame(tick);
  };
  const blur = () => { focused = false; clear(); };
  const focus = () => { focused = true; };
  const preference = () => { if (motion.matches) clear(); };
  window.addEventListener('blur', blur);
  window.addEventListener('focus', focus);
  window.addEventListener('pagehide', clear);
  document.addEventListener('visibilitychange', clear);
  motion.addEventListener('change', preference);

  return {
    Play(kind: FeedbackKind, point?: Point) {
      if (disposed || !context || motion.matches || document.hidden || !focused) return;
      const view = readView();
      if (!view || view.width <= 0 || view.height <= 0) return;
      const now = performance.now();
      if (kind === 'movement' && now - lastMovement < 500) return;
      if (kind === 'movement') lastMovement = now;
      const bounds = canvas.getBoundingClientRect();
      const position = kind === 'complete' ? { x: 100, y: 126 }
        : StagePointToCanvas(point ?? { x: view.width / 2, y: view.height / 2 }, view, bounds);
      const duration = kind === 'movement' ? 0.45 : kind === 'collect' ? 0.75 : 0.95;
      // Each module's visible centre sits above its origin; place that centre at the event.
      const offsetY = kind === 'collect' ? 30 : 0;
      const effect = CreateFx(effects[kind], { x: position.x, y: position.y + offsetY, palette, seed: ++seed, light: 0.2,
        ...(kind === 'movement' ? { height: 0, aim: -0.3 } : {}) });
      if (kind === 'complete') active = [];
      active.push({ kind, effect, age: 0, duration, speed: effects[kind].meta.duration / duration });
      if (active.length > 6) active.shift();
      if (!raf) { last = now; raf = requestAnimationFrame(tick); }
    },
    Clear: clear,
    Dispose() {
      disposed = true;
      clear();
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      window.removeEventListener('pagehide', clear);
      document.removeEventListener('visibilitychange', clear);
      motion.removeEventListener('change', preference);
      frame = CreateFrame(1, 1);
      pixels = new ImageData(1, 1);
      canvas.width = canvas.height = 1;
      celebration.width = celebration.height = 1;
    },
  };
}
