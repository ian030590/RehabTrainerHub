/**
 * Scoped PixiJS Application manager.
 *
 * Player-facing training modules must not share a long-lived renderer or stage
 * with another training module. Each scope below owns one Pixi Application and
 * may reuse it only within that module's own jsPsych trials.
 */
import { Application } from 'pixi.js';
import { pixiColors } from '../theme';

const defaultTrialContainerStyle = 'width:100%;height:100%;position:absolute;top:0;left:0;overflow:hidden;';
const maxPixiDevicePixelRatio = 2;

export const pixiRuntimeScopes = {
  movingCard: 'training:moving-card',
  oculomotor: 'training:oculomotor-training',
  gaborPatching: 'training:gabor-patching',
  reading: 'training:reading-training',
  contrastAssessment: 'assessment:contrast-sensitivity',
} as const;

export type PixiRuntimeScope = typeof pixiRuntimeScopes[keyof typeof pixiRuntimeScopes];

const pixiTrainingRuntimeScopes: Record<string, PixiRuntimeScope> = {
  'moving-card': pixiRuntimeScopes.movingCard,
  'oculomotor-training': pixiRuntimeScopes.oculomotor,
  'gabor-patching': pixiRuntimeScopes.gaborPatching,
  'reading-training': pixiRuntimeScopes.reading,
};

function GetPixiResolution(): number {
  if (typeof window === 'undefined') return 1;
  return Math.max(1, Math.min(window.devicePixelRatio || 1, maxPixiDevicePixelRatio));
}

function GetRenderSize(container: HTMLElement): { width: number; height: number } {
  const rect = container.getBoundingClientRect();
  const parentRect = container.parentElement?.getBoundingClientRect();
  const width = container.clientWidth || rect.width || parentRect?.width || window.innerWidth;
  const height = container.clientHeight || rect.height || parentRect?.height || window.innerHeight;

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

export function GetPixiTrainingRuntimeScope(moduleId: string): PixiRuntimeScope | null {
  return pixiTrainingRuntimeScopes[moduleId] ?? null;
}

class PixiAppManager {
  private app: Application | null = null;
  private initPromise: Promise<void> | null = null;
  private _ready = false;
  private destroyRequested = false;

  /* Public API */

  /**
   * Pre-initialise WebGL context.
   * Safe to call multiple times; only the first call does real work.
   */
  warmUp(): Promise<void> {
    if (this._ready) return Promise.resolve();
    if (this.initPromise) return this.initPromise;
    this.destroyRequested = false;
    this.initPromise = this._init();
    return this.initPromise;
  }

  get ready(): boolean {
    return this._ready;
  }

  /** Returns this scope's Application, warming up first if needed. */
  async ensureReady(): Promise<Application> {
    if (!this._ready) await this.warmUp();
    if (!this._ready || !this.app) {
      throw new Error('PixiJS runtime was destroyed before it became ready.');
    }
    return this.app;
  }

  /** Returns this scope's Application if ready, otherwise null. */
  getApp(): Application | null {
    return this._ready ? this.app : null;
  }

  /** Attach this scope's canvas to a DOM container and start tracking its size. */
  attachTo(container: HTMLElement): void {
    if (!this.app) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    try {
      (this.app as any).resizeTo = container;
    } catch {
      /* fallback below */
    }
    this.resizeToContainer(container);

    window.requestAnimationFrame(() => {
      if (canvas.parentElement === container) this.resizeToContainer(container);
    });
  }

  /** Destroy all children from the stage. */
  clearStage(): void {
    if (!this.app) return;
    while (this.app.stage.children.length > 0) {
      this.app.stage.children[0].destroy({ children: true });
    }
  }

  /** Safely detach canvas from the DOM without destroying this scope's Application. */
  detachCanvas(): void {
    if (!this.app) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }

  /** Full cleanup; call when this scope's module is completely done. */
  destroy(): void {
    this.destroyRequested = true;
    if (this.app && this._ready) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
      this._ready = false;
      this.initPromise = null;
      this.destroyRequested = false;
    }
  }

  /* Internal */

  private async _init(): Promise<void> {
    try {
      this.app = new Application();
      await this.app.init({
        backgroundColor: pixiColors.bg,
        antialias: true,
        preference: ['webgl', 'canvas'],
        powerPreference: 'high-performance',
        resolution: GetPixiResolution(),
        autoDensity: true,
        width: 100,
        height: 100,
      });
      if (this.destroyRequested) {
        this.app.destroy(true, { children: true, texture: true });
        this.app = null;
        this._ready = false;
        this.initPromise = null;
        this.destroyRequested = false;
        return;
      }
      this._ready = true;
    } catch (error) {
      this.app = null;
      this._ready = false;
      this.initPromise = null;
      this.destroyRequested = false;
      throw error;
    }
  }

  private resizeToContainer(container: HTMLElement): void {
    if (!this.app) return;
    const { width, height } = GetRenderSize(container);
    this.app.renderer.resize(width, height, GetPixiResolution());
  }
}

const pixiAppManagers = new Map<PixiRuntimeScope, PixiAppManager>();

function GetPixiAppManager(scope: PixiRuntimeScope): PixiAppManager {
  const existing = pixiAppManagers.get(scope);
  if (existing) return existing;
  const manager = new PixiAppManager();
  pixiAppManagers.set(scope, manager);
  return manager;
}

export function WarmUpPixiRuntime(scope: PixiRuntimeScope): Promise<void> {
  return GetPixiAppManager(scope).warmUp();
}

export function WarmUpPixiTrainingRuntime(moduleId: string): Promise<void> {
  const scope = GetPixiTrainingRuntimeScope(moduleId);
  return scope ? WarmUpPixiRuntime(scope) : Promise.resolve();
}

export function DestroyPixiRuntime(scope: PixiRuntimeScope): void {
  const manager = pixiAppManagers.get(scope);
  if (!manager) return;
  manager.destroy();
  pixiAppManagers.delete(scope);
}

export function DestroyPixiTrainingRuntime(moduleId: string): void {
  const scope = GetPixiTrainingRuntimeScope(moduleId);
  if (scope) DestroyPixiRuntime(scope);
}

export function CreatePixiTrialContainer(
  displayElement: HTMLElement,
  styleText = defaultTrialContainerStyle,
  className?: string,
): HTMLDivElement {
  displayElement.replaceChildren();
  const container = document.createElement('div');
  container.style.cssText = styleText;
  if (className) container.className = className;
  displayElement.appendChild(container);
  return container;
}

export function AttachPixiTrialCanvas(scope: PixiRuntimeScope, container: HTMLElement): void {
  const manager = GetPixiAppManager(scope);
  manager.clearStage();
  manager.attachTo(container);
}

export function CleanupPixiTrial(scope: PixiRuntimeScope, displayElement: HTMLElement): void {
  const manager = GetPixiAppManager(scope);
  manager.clearStage();
  manager.detachCanvas();
  displayElement.replaceChildren();
}

export function RunPixiTrial(
  scope: PixiRuntimeScope,
  displayElement: HTMLElement,
  runWithApp: (app: Application) => void,
): void {
  const manager = GetPixiAppManager(scope);

  if (manager.ready) {
    const app = manager.getApp();
    if (app) {
      runWithApp(app);
      return;
    }
  }

  manager.ensureReady().then(runWithApp).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('PixiJS init failed:', error);
    displayElement.replaceChildren();
    const errorElement = document.createElement('div');
    errorElement.style.cssText = 'color:red;padding:20px;';
    errorElement.textContent = `PixiJS initialization failed: ${message}`;
    displayElement.appendChild(errorElement);
  });
}
