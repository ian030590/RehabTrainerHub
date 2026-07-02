/**
 * Singleton PixiJS Application manager.
 *
 * Key benefits:
 * 1. warmUp() pre-initialises the WebGL context + compiles shaders on the
 *    HomePage so the first trial starts instantly.
 * 2. The same Application is REUSED across all jsPsych trials — no per-round
 *    WebGL teardown / setup.  Between rounds only the stage children are
 *    swapped, which takes < 20 ms.
 */
import { Application } from 'pixi.js';
import { pixiColors } from '../theme';

const DEFAULT_TRIAL_CONTAINER_STYLE = 'width:100%;height:100%;position:absolute;top:0;left:0;overflow:hidden;';

function getRenderSize(container: HTMLElement): { width: number; height: number } {
  const rect = container.getBoundingClientRect();
  const parentRect = container.parentElement?.getBoundingClientRect();
  const width = container.clientWidth || rect.width || parentRect?.width || window.innerWidth;
  const height = container.clientHeight || rect.height || parentRect?.height || window.innerHeight;

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

class PixiAppManager {
  private static instance: PixiAppManager;
  private app: Application | null = null;
  private initPromise: Promise<void> | null = null;
  private _ready = false;

  static getInstance(): PixiAppManager {
    if (!PixiAppManager.instance) {
      PixiAppManager.instance = new PixiAppManager();
    }
    return PixiAppManager.instance;
  }

  /* ── Public API ─────────────────────────────────────── */

  /**
   * Pre-initialise WebGL context.
   * Safe to call multiple times — only the first call does real work.
   */
  warmUp(): Promise<void> {
    if (this._ready) return Promise.resolve();
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  get ready(): boolean {
    return this._ready;
  }

  /** Returns the shared Application, warming up first if needed. */
  async ensureReady(): Promise<Application> {
    if (!this._ready) await this.warmUp();
    return this.app!;
  }

  /** Returns the shared Application if ready, otherwise null. */
  getApp(): Application | null {
    return this._ready ? this.app : null;
  }

  /** Attach the shared canvas to a DOM container and start tracking its size. */
  attachTo(container: HTMLElement): void {
    if (!this.app) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    container.appendChild(canvas);
    // Update resize target so PixiJS auto-tracks container size
    try {
      (this.app as any).resizeTo = container;
    } catch { /* fallback below */ }
    this.resizeToContainer(container);

    window.requestAnimationFrame(() => {
      if (canvas.parentElement === container) this.resizeToContainer(container);
    });
  }

  /** Destroy all children from the stage (frees GPU texture memory). */
  clearStage(): void {
    if (!this.app) return;
    while (this.app.stage.children.length > 0) {
      this.app.stage.children[0].destroy({ children: true });
    }
  }

  /** Safely detach canvas from the DOM without destroying the Application. */
  detachCanvas(): void {
    if (!this.app) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }

  /** Full cleanup — call when the training module is completely done. */
  destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
      this._ready = false;
      this.initPromise = null;
    }
  }

  /* ── Internal ───────────────────────────────────────── */

  private async _init(): Promise<void> {
    try {
      this.app = new Application();
      await this.app.init({
        backgroundColor: pixiColors.bg,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        width: 100,
        height: 100,
      });
      this._ready = true;
    } catch (error) {
      this.app = null;
      this._ready = false;
      this.initPromise = null;
      throw error;
    }
  }

  private resizeToContainer(container: HTMLElement): void {
    if (!this.app) return;
    const { width, height } = getRenderSize(container);
    this.app.renderer.resize(width, height);
  }
}

export const pixiAppManager = PixiAppManager.getInstance();

export function createPixiTrialContainer(
  displayElement: HTMLElement,
  styleText = DEFAULT_TRIAL_CONTAINER_STYLE,
): HTMLDivElement {
  displayElement.innerHTML = '';
  const container = document.createElement('div');
  container.style.cssText = styleText;
  displayElement.appendChild(container);
  return container;
}

export function attachPixiTrialCanvas(container: HTMLElement): void {
  pixiAppManager.clearStage();
  pixiAppManager.attachTo(container);
}

export function cleanupPixiTrial(displayElement: HTMLElement): void {
  pixiAppManager.clearStage();
  pixiAppManager.detachCanvas();
  displayElement.innerHTML = '';
}

export function runPixiTrial(displayElement: HTMLElement, runWithApp: (app: Application) => void): void {
  if (pixiAppManager.ready) {
    const app = pixiAppManager.getApp();
    if (app) {
      runWithApp(app);
      return;
    }
  }

  pixiAppManager.ensureReady().then(runWithApp).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('PixiJS init failed:', error);
    displayElement.innerHTML = '';
    const errorElement = document.createElement('div');
    errorElement.style.cssText = 'color:red;padding:20px;';
    errorElement.textContent = `PixiJS initialization failed: ${message}`;
    displayElement.appendChild(errorElement);
  });
}
