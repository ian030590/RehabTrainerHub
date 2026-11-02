import type { PixelCore, PixelEffect, PixelFrame, PixelInstance } from './pixelfx';

type Shot = { fx: PixelInstance; frame: PixelFrame; image: ImageData; scratch: HTMLCanvasElement;
  context: CanvasRenderingContext2D; x: number; y: number; scale: number; age: number; speed: number; duration: number };

export function CreateHoleEffects(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let library: { core: PixelCore; hit: PixelEffect; dust: PixelEffect; combo: PixelEffect } | null = null;
  let shots: Shot[] = [];
  let animation = 0, previous = 0, streak = 0, sequence = 0;
  let disposed = false, focused = document.hasFocus(), paused = false;
  const blocked = () => disposed || !context || motion.matches || document.hidden || !focused || paused;
  const clear = () => {
    cancelAnimationFrame(animation);
    animation = 0; previous = 0;
    shots = [];
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };
  // Public modules keep upstream code intact and resolve within the R2 package, including its sandbox.
  const load = (path: string) => import(/* @vite-ignore */ new URL(`pixelfx/${path}.js`, document.baseURI).href);
  void Promise.all([load('core/fx'), load('fx/impacts/hit-spark'), load('fx/impacts/blunt-hit'), load('fx/pickups/collect-burst')])
    .then(([core, hit, dust, combo]) => { if (!disposed) library = { core, hit, dust, combo }; })
    .catch(() => { library = null; });

  const tick = (now: number) => {
    animation = 0;
    if (blocked() || !library || !context) { clear(); return; }
    const dt = previous ? Math.max(0, (now - previous) / 1000) : 1 / 60;
    previous = now;
    context.clearRect(0, 0, canvas.width, canvas.height);
    shots = shots.filter(shot => {
      shot.age += dt;
      if (shot.age >= shot.duration) return false;
      shot.fx.update(dt * shot.speed);
      if (shot.fx.done()) return false;
      library!.core.clearFrame(shot.frame);
      shot.fx.draw(shot.frame, 'back'); shot.fx.draw(shot.frame, 'front');
      library!.core.composite(shot.frame, shot.image.data, null);
      shot.context.putImageData(shot.image, 0, 0);
      context.drawImage(shot.scratch, shot.x, shot.y, shot.frame.w * shot.scale, shot.frame.h * shot.scale);
      return true;
    });
    if (shots.length) animation = requestAnimationFrame(tick); else clear();
  };
  const play = (index: number, outcome: 'hit' | 'wrong') => {
    streak = outcome === 'hit' ? streak + 1 : 0;
    if (blocked() || !library) return;
    const hole = canvas.parentElement?.querySelector<HTMLElement>(`.wm-hole[data-index="${index}"]`);
    if (!hole) return;
    const board = canvas.getBoundingClientRect(), bounds = hole.getBoundingClientRect();
    if (board.width <= 0 || board.height <= 0 || bounds.width <= 0) return;
    const width = Math.ceil(board.width / 2), height = Math.ceil(board.height / 2);
    if (canvas.width !== width || canvas.height !== height) { clear(); canvas.width = width; canvas.height = height; }
    const combo = outcome === 'hit' && streak % 5 === 0;
    const module = outcome === 'wrong' ? library.dust : combo ? library.combo : library.hit;
    const scratch = document.createElement('canvas');
    [scratch.width, scratch.height] = module.meta.size;
    const scratchContext = scratch.getContext('2d');
    if (!scratchContext) return;
    const style = getComputedStyle(canvas);
    const color = (name: string) => style.getPropertyValue(name).trim();
    const gold = [color('--hit-edge'), color('--hit'), color('--surface')];
    const dust = [color('--hole'), color('--mole'), color('--text-muted'), color('--border')];
    const fx = library.core.createFx(module, { x: module.meta.origin[0], y: module.meta.origin[1],
      palette: outcome === 'wrong' ? dust : gold, seed: ++sequence, light: outcome === 'wrong' ? 0 : 0.08,
      warm: color('--text-muted'), dust: color('--text-muted'), clod: color('--mole') });
    // Start after the blunt-hit flash and wedges: a wrong tap gets only a small puff of earth.
    if (outcome === 'wrong') fx.update(0.24);
    const ratio = width / board.width;
    const scale = bounds.width * (outcome === 'wrong' ? 0.48 : combo ? 0.98 : 0.78) / scratch.width * ratio;
    const hotspot = combo ? 30 : 20;
    const x = (bounds.left - board.left + bounds.width * 0.5) * ratio - module.meta.origin[0] * scale;
    const y = (bounds.top - board.top + bounds.height * 0.42) * ratio - (module.meta.origin[1] - hotspot) * scale;
    shots.push({ fx, frame: library.core.createFrame(scratch.width, scratch.height), image: scratchContext.createImageData(scratch.width, scratch.height),
      scratch, context: scratchContext, x, y, scale, age: 0, speed: combo ? 1.8 : 1.5, duration: combo ? 0.8 : 0.5 });
    // Accepted taps are naturally spaced, but bound decorative work even under synthetic input.
    if (shots.length > 4) shots.shift();
    if (!animation) animation = requestAnimationFrame(tick);
  };
  const blur = () => { focused = false; clear(); };
  const focus = () => { focused = true; };
  const pause = () => { paused = true; clear(); };
  const resume = () => { paused = false; };
  const visibility = () => { if (document.hidden) clear(); };
  const preference = () => { if (motion.matches) clear(); };
  const listeners: [string, () => void][] = [['blur', blur], ['focus', focus], ['game:pause', pause], ['game:resume', resume],
    ['resize', clear], ['pagehide', pause], ['pageshow', resume]];
  listeners.forEach(([event, callback]) => window.addEventListener(event, callback));
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', preference);
  const observer = new ResizeObserver(clear);
  observer.observe(canvas);
  return {
    play, clear,
    resetStreak: () => { streak = 0; },
    dispose: () => {
      disposed = true; clear(); library = null;
      observer.disconnect();
      listeners.forEach(([event, callback]) => window.removeEventListener(event, callback));
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', preference);
    },
  };
}
