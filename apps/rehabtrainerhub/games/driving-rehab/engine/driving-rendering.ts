export type DrivingRenderQualityLevel = 'low' | 'medium' | 'high';

export interface DrivingRenderQuality {
  level: DrivingRenderQualityLevel;
  pixelRatioCap: number;
  antialias: boolean;
  cameraFar: number;
  fogNear: number;
  fogFar: number;
  roadTextureSize: number;
  roadNoiseSamples: number;
  vehicleTextureSize: number;
  useReferenceVehicleModel: boolean;
  useOsmCity: boolean;
  osmRoadSegmentLimit: number;
  osmBuildingLimit: number;
  ambientTrafficCount: number;
}

export interface DrivingViewportMetrics {
  cssWidth: number;
  cssHeight: number;
  aspect: number;
  pixelRatio: number;
  bufferWidth: number;
  bufferHeight: number;
}

interface DrivingViewportControllerOptions {
  renderer: any;
  camera: any;
  root: HTMLElement;
  pixelRatioCap: number;
  onLayoutChange?: () => void;
}

interface Vector4Like {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface DrivingRendererPassState {
  renderTarget: any;
  viewport: Vector4Like;
  scissor: Vector4Like;
  scissorTest: boolean;
}

const qualityProfiles: Record<DrivingRenderQualityLevel, DrivingRenderQuality> = {
  low: {
    level: 'low',
    pixelRatioCap: 1,
    antialias: false,
    cameraFar: 420,
    fogNear: 120,
    fogFar: 360,
    roadTextureSize: 256,
    roadNoiseSamples: 650,
    vehicleTextureSize: 512,
    useReferenceVehicleModel: false,
    useOsmCity: false,
    osmRoadSegmentLimit: 0,
    osmBuildingLimit: 0,
    ambientTrafficCount: 10,
  },
  medium: {
    level: 'medium',
    pixelRatioCap: 1.5,
    antialias: true,
    cameraFar: 650,
    fogNear: 180,
    fogFar: 560,
    roadTextureSize: 512,
    roadNoiseSamples: 1200,
    vehicleTextureSize: 512,
    useReferenceVehicleModel: true,
    useOsmCity: false,
    osmRoadSegmentLimit: 150,
    osmBuildingLimit: 72,
    ambientTrafficCount: 14,
  },
  high: {
    level: 'high',
    pixelRatioCap: 1.5,
    antialias: true,
    cameraFar: 900,
    fogNear: 260,
    fogFar: 780,
    roadTextureSize: 512,
    roadNoiseSamples: 1800,
    vehicleTextureSize: 1024,
    useReferenceVehicleModel: true,
    useOsmCity: false,
    osmRoadSegmentLimit: 230,
    osmBuildingLimit: 120,
    ambientTrafficCount: 18,
  },
};

export function IsDrivingRenderQualityLevel(value: unknown): value is DrivingRenderQualityLevel {
  return value === 'low' || value === 'medium' || value === 'high';
}

export function CreateDrivingRenderQuality(value: unknown): DrivingRenderQuality {
  const level = IsDrivingRenderQualityLevel(value) ? value : 'high';
  return { ...qualityProfiles[level] };
}

export function CalculateDrivingViewport(
  width: number,
  height: number,
  devicePixelRatio: number,
  pixelRatioCap: number,
): DrivingViewportMetrics {
  const cssWidth = Math.max(1, Math.round(Number.isFinite(width) ? width : 1));
  const cssHeight = Math.max(1, Math.round(Number.isFinite(height) ? height : 1));
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const cap = Number.isFinite(pixelRatioCap) && pixelRatioCap > 0 ? pixelRatioCap : 1;
  const pixelRatio = Math.max(0.5, Math.min(dpr, cap));

  return {
    cssWidth,
    cssHeight,
    aspect: cssWidth / cssHeight,
    pixelRatio,
    // Match WebGLRenderer.setSize(), which floors backing-buffer dimensions.
    bufferWidth: Math.max(1, Math.floor(cssWidth * pixelRatio)),
    bufferHeight: Math.max(1, Math.floor(cssHeight * pixelRatio)),
  };
}

function SameViewport(left: DrivingViewportMetrics | null, right: DrivingViewportMetrics) {
  return Boolean(left)
    && left?.cssWidth === right.cssWidth
    && left.cssHeight === right.cssHeight
    && Math.abs(left.pixelRatio - right.pixelRatio) < 0.0001;
}

/**
 * Keeps CSS viewport coordinates, camera projection, and renderer backing pixels
 * as separate concepts. The main framebuffer is restored with setRenderTarget(null),
 * allowing Three.js to floor its viewport to the exact drawing-buffer size.
 */
export class DrivingViewportController {
  private metrics: DrivingViewportMetrics | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly handleResize = () => this.sync();

  constructor(private readonly options: DrivingViewportControllerOptions) {}

  start() {
    this.sync(true);
    window.addEventListener('resize', this.handleResize);
    window.visualViewport?.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.options.root);
    }
  }

  sync(force = false): DrivingViewportMetrics {
    const { root, renderer, camera, pixelRatioCap, onLayoutChange } = this.options;
    const rect = root.getBoundingClientRect();
    const width = root.clientWidth || rect.width;
    const height = root.clientHeight || rect.height;
    const next = CalculateDrivingViewport(
      width,
      height,
      window.devicePixelRatio || 1,
      pixelRatioCap,
    );

    if (!force && SameViewport(this.metrics, next)) return this.metrics as DrivingViewportMetrics;

    const aspectChanged = !this.metrics || Math.abs(camera.aspect - next.aspect) > 0.000001;
    const pixelRatioChanged = !this.metrics || Math.abs(this.metrics.pixelRatio - next.pixelRatio) > 0.0001;
    if (pixelRatioChanged) renderer.setPixelRatio(next.pixelRatio);
    renderer.setSize(next.cssWidth, next.cssHeight, false);
    if (aspectChanged) {
      camera.aspect = next.aspect;
      camera.updateProjectionMatrix();
    }

    this.metrics = next;
    root.dataset.drivingViewport = `${next.cssWidth}x${next.cssHeight}`;
    root.dataset.drivingAspect = next.aspect.toFixed(6);
    renderer.domElement.dataset.drivingPixelRatio = String(next.pixelRatio);
    onLayoutChange?.();
    return next;
  }

  prepareMainRender(): DrivingViewportMetrics {
    const currentPixelRatio = Math.max(
      0.5,
      Math.min(window.devicePixelRatio || 1, this.options.pixelRatioCap),
    );
    const metrics = !this.metrics
      || Math.abs(this.metrics.pixelRatio - currentPixelRatio) > 0.0001
      ? this.sync()
      : this.metrics;
    const { renderer } = this.options;
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    return metrics;
  }

  stop() {
    window.removeEventListener('resize', this.handleResize);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.metrics = null;
  }
}

export function CaptureDrivingRendererPassState(
  renderer: any,
  createVector4: () => Vector4Like,
): DrivingRendererPassState {
  const renderTarget = renderer.getRenderTarget?.() ?? null;
  if (renderTarget !== null) {
    throw new Error('Driving auxiliary passes must be entered from the main framebuffer.');
  }
  const viewport = createVector4();
  const scissor = createVector4();
  renderer.getViewport(viewport);
  renderer.getScissor(scissor);
  return {
    renderTarget,
    viewport,
    scissor,
    scissorTest: Boolean(renderer.getScissorTest?.()),
  };
}

export function RestoreDrivingRendererPassState(renderer: any, state: DrivingRendererPassState) {
  // Restore logical defaults first. Rebinding the main framebuffer last makes
  // Three.js floor them to the backing-buffer dimensions; calling setViewport
  // after this would round half pixels and can exceed an odd-sized buffer.
  renderer.setViewport(state.viewport);
  renderer.setScissor(state.scissor);
  renderer.setScissorTest(state.scissorTest);
  renderer.setRenderTarget(state.renderTarget);
}
