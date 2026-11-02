import { createFrame, clearFrame, createFx, composite } from '../public/runtime/pixelfx/core/index.js';
import * as slash from '../public/runtime/pixelfx/fx/melee/sword-slash.js';
import * as mana from '../public/runtime/pixelfx/fx/arcane/mana-burst.js';
import * as spark from '../public/runtime/pixelfx/fx/impacts/hit-spark.js';
import * as poof from '../public/runtime/pixelfx/fx/spawn/poof.js';

type FeedbackEvent = 1 | 2 | 3 | 4 | 5 | 'interrupted' | 'defeated';
interface FeedbackScene {
  enemy: { x: number; y: number; scale: { x: number } };
  player: { x: number; y: number; scale: { x: number } };
}

export function CreateBattleFeedback(canvas: HTMLCanvasElement, host: HTMLElement) {
  const context = canvas.getContext('2d');
  const scratch = document.createElement('canvas');
  const scratchContext = scratch.getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  let animation: number | null = null;
  let disposed = false;
  let blurred = false;
  let pageHidden = false;

  const Clear = () => {
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null;
    context?.clearRect(0, 0, canvas.width, canvas.height);
    scratchContext?.clearRect(0, 0, scratch.width, scratch.height);
  };
  const Blur = () => { blurred = true; Clear(); };
  const Focus = () => { blurred = false; };
  const Hide = () => { pageHidden = true; Clear(); };
  const Show = () => { pageHidden = false; };
  window.addEventListener('blur', Blur);
  window.addEventListener('focus', Focus);
  window.addEventListener('pagehide', Hide);
  window.addEventListener('pageshow', Show);
  window.addEventListener('resize', Clear);
  document.addEventListener('visibilitychange', Clear);
  motion.addEventListener('change', Clear);
  portrait.addEventListener('change', Clear);

  return {
    play(event: FeedbackEvent, scene: FeedbackScene | null) {
      if (disposed || blurred || pageHidden || document.hidden || motion.matches || portrait.matches || !context || !scratchContext || !scene) return;
      Clear();
      const interrupted = event === 'interrupted';
      const module = event === 'defeated' ? poof : interrupted || event === 4 ? spark : event === 2 || event === 3 ? slash : mana;
      const duration = event === 'defeated' ? 0.6 : interrupted ? 0.18 : module === spark ? 0.35 : 0.7;
      const styles = getComputedStyle(host);
      const ink = styles.getPropertyValue('--heading').trim();
      const white = styles.getPropertyValue('--surface').trim();
      const main = styles.getPropertyValue(event === 3 ? '--hp' : event === 5 ? '--hand-point' : '--primary').trim();
      const palette = [ink, main, main, white];
      const fx = createFx(module, { palette, sparks: palette, stars: palette, seed: 19, light: interrupted ? 0 : 0.15,
        angle: event === 3 ? -0.35 : 0 });
      const [width, height] = module.meta.size;
      const frame = createFrame(width, height, -module.meta.origin[0], -module.meta.origin[1]);
      const image = scratchContext.createImageData(width, height);
      scratch.width = width;
      scratch.height = height;
      const bounds = host.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(bounds.width));
      canvas.height = Math.max(1, Math.round(bounds.height));
      context.imageSmoothingEnabled = false;
      context.globalAlpha = interrupted ? 0.45 : 0.8;
      const actor = interrupted ? scene.player : scene.enemy;
      const scale = actor.scale.x * (interrupted ? 0.45 : 1);
      const started = performance.now();
      let previous = started;
      const Tick = (now: number) => {
        animation = null;
        if (disposed || blurred || pageHidden || document.hidden || motion.matches || portrait.matches || now - started >= duration * 1000) { Clear(); return; }
        fx.update(Math.max(0, now - previous) / 1000 * module.meta.duration / duration);
        previous = now;
        if (fx.done()) { Clear(); return; }
        clearFrame(frame);
        fx.draw(frame, 'back');
        fx.draw(frame, 'front');
        composite(frame, image.data, null);
        scratchContext.putImageData(image, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(scratch, actor.x - width * scale / 2, actor.y - height * scale / 2, width * scale, height * scale);
        animation = requestAnimationFrame(Tick);
      };
      animation = requestAnimationFrame(Tick);
    },
    clear: Clear,
    dispose() {
      disposed = true;
      Clear();
      window.removeEventListener('blur', Blur);
      window.removeEventListener('focus', Focus);
      window.removeEventListener('pagehide', Hide);
      window.removeEventListener('pageshow', Show);
      window.removeEventListener('resize', Clear);
      document.removeEventListener('visibilitychange', Clear);
      motion.removeEventListener('change', Clear);
      portrait.removeEventListener('change', Clear);
    },
  };
}
