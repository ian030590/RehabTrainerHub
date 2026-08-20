export type PeripheralAttentionCanvasPhase = 'fixation' | 'stimulus' | 'mask';
export type PeripheralAttentionCanvasTarget = 'car' | 'truck';

export interface PeripheralAttentionCanvasSlot {
  axis: number;
  ring: number;
  x: number;
  y: number;
}

export interface PeripheralAttentionCanvasStageOptions {
  ariaLabel: string;
  phase: PeripheralAttentionCanvasPhase;
  centralTarget: PeripheralAttentionCanvasTarget;
  hasPeripheral: boolean;
  hasDistractors: boolean;
  peripheralSlot?: PeripheralAttentionCanvasSlot;
  slots: readonly PeripheralAttentionCanvasSlot[];
  maskImageData?: ImageData | null;
  geometry?: PeripheralAttentionScreenGeometry;
  contrastPercent?: number;
}

export interface PeripheralAttentionScreenGeometry {
  maxVisualAngleDeg: number;
  isOverLimit: boolean;
  suggestedDistanceCm?: number;
  radiusPx?: number;
  vehicleScale?: number;
}

// Backward compatibility types
export type UfovCanvasPhase = PeripheralAttentionCanvasPhase;
export type UfovCanvasTarget = PeripheralAttentionCanvasTarget;
export type UfovCanvasSlot = PeripheralAttentionCanvasSlot;
export type UfovCanvasStageOptions = PeripheralAttentionCanvasStageOptions;
export type UfovScreenGeometry = PeripheralAttentionScreenGeometry;

interface CanvasSize {
  context: CanvasRenderingContext2D;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
}

const canvasStageClass = 'ufov-canvas-stage';
const canvasClass = 'ufov-stage-canvas';
const baseVehicleWidth = 72;
const baseVehicleHeight = 56;

export function EnsurePeripheralAttentionCanvasStage(displayElement: HTMLElement, ariaLabel: string) {
  const currentStage = displayElement.querySelector<HTMLDivElement>(`.${canvasStageClass}`);
  if (currentStage) {
    currentStage.setAttribute('aria-label', ariaLabel);
    return currentStage;
  }

  const stage = document.createElement('div');
  stage.className = `ufov-stage ${canvasStageClass}`;
  stage.setAttribute('aria-label', ariaLabel);

  const canvas = document.createElement('canvas');
  canvas.className = canvasClass;
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);
  displayElement.replaceChildren(stage);

  return stage;
}

export function RenderPeripheralAttentionCanvasStage(
  displayElement: HTMLElement,
  options: PeripheralAttentionCanvasStageOptions,
) {
  const stage = EnsurePeripheralAttentionCanvasStage(displayElement, options.ariaLabel);
  DrawPeripheralAttentionCanvasStage(stage, options);
  return stage;
}

export function DrawPeripheralAttentionCanvasStage(
  stage: HTMLElement,
  options: PeripheralAttentionCanvasStageOptions,
) {
  stage.setAttribute('aria-label', options.ariaLabel);
  const canvas = GetStageCanvas(stage);
  const size = ResizeCanvasToStage(canvas, stage);
  if (!size) return;

  if (options.phase === 'mask') {
    DrawNoiseMask(canvas, size.context, options.maskImageData);
    return;
  }

  const { context, cssWidth, cssHeight, dpr } = size;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const contrastPercent = Clamp(Number(options.contrastPercent) || 100, 5, 100);
  const backgroundValue = Math.round(255 * (1 - contrastPercent / 100));
  const backgroundColor = `rgb(${backgroundValue}, ${backgroundValue}, ${backgroundValue})`;
  context.clearRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, cssWidth, cssHeight);
  const metrics = GetStageMetrics(cssWidth, cssHeight, options.geometry);

  if (options.phase === 'fixation') {
    DrawCenterBox(context, cssWidth / 2, cssHeight / 2, metrics.centerBoxSize, metrics.centerBoxBorder);
    return;
  }

  DrawCentralStimulus(context, cssWidth / 2, cssHeight / 2, options.centralTarget, metrics, backgroundColor);
  if (options.hasPeripheral && options.peripheralSlot) {
    DrawPeripheralStimuli(context, options, cssWidth, cssHeight, metrics, backgroundColor);
  }
}

export function PreparePeripheralAttentionNoiseMask(stage: HTMLElement) {
  const canvas = GetStageCanvas(stage);
  const size = ResizeCanvasToStage(canvas, stage);
  if (!size) return null;
  return CreateNoiseImageData(size.context, canvas.width, canvas.height);
}

// Backward compatibility function aliases
export function EnsureUfovCanvasStage(displayElement: HTMLElement, ariaLabel: string) {
  return EnsurePeripheralAttentionCanvasStage(displayElement, ariaLabel);
}

export function RenderUfovCanvasStage(
  displayElement: HTMLElement,
  options: PeripheralAttentionCanvasStageOptions,
) {
  return RenderPeripheralAttentionCanvasStage(displayElement, options);
}

export function DrawUfovCanvasStage(
  stage: HTMLElement,
  options: PeripheralAttentionCanvasStageOptions,
) {
  return DrawPeripheralAttentionCanvasStage(stage, options);
}

export function PrepareUfovNoiseMask(stage: HTMLElement) {
  return PreparePeripheralAttentionNoiseMask(stage);
}

function GetStageCanvas(stage: HTMLElement) {
  const currentCanvas = stage.querySelector<HTMLCanvasElement>(`.${canvasClass}`);
  if (currentCanvas) return currentCanvas;

  const canvas = document.createElement('canvas');
  canvas.className = canvasClass;
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);
  return canvas;
}

function ResizeCanvasToStage(canvas: HTMLCanvasElement, stage: HTMLElement): CanvasSize | null {
  const context = canvas.getContext('2d');
  if (!context) return null;

  const rect = stage.getBoundingClientRect();
  const fallbackWidth = typeof window === 'undefined' ? 800 : Math.max(1, window.innerWidth || 800);
  const fallbackHeight = typeof window === 'undefined' ? 533 : Math.max(1, window.innerHeight || 533);
  const cssWidth = Math.max(1, rect.width || fallbackWidth);
  const cssHeight = Math.max(1, rect.height || fallbackHeight);
  const dpr = 1;
  const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
  const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  return { context, cssWidth, cssHeight, dpr };
}

function GetStageMetrics(cssWidth: number, cssHeight: number, geometry?: PeripheralAttentionScreenGeometry) {
  const baseDimension = Math.min(cssWidth, cssHeight);
  const standardScale = baseDimension / 1080;
  const maxAvailableRadius = baseDimension * 0.44;
  const outerRadius = Number.isFinite(geometry?.radiusPx)
    ? Math.min(maxAvailableRadius, geometry!.radiusPx!)
    : maxAvailableRadius;
  const scale = Number.isFinite(geometry?.vehicleScale)
    ? geometry!.vehicleScale!
    : (110 * standardScale * 0.58) / baseVehicleWidth;
  return {
    centerBoxSize: Math.max(48, baseVehicleWidth * scale * 1.5),
    centerBoxBorder: Math.max(2, 3 * standardScale),
    vehicleScale: scale,
    radii: [outerRadius * 0.333, outerRadius * 0.666, outerRadius],
    distractorWidth: 92 * standardScale * (scale / 0.88),
    distractorHeight: 90 * standardScale * (scale / 0.88),
    distractorStroke: Math.max(2, 3.5 * standardScale),
  };
}

function DrawCenterBox(context: CanvasRenderingContext2D, centerX: number, centerY: number, size: number, border: number) {
  const offset = size / 2;
  const strokeOffset = border / 2;
  context.strokeStyle = '#fff';
  context.lineWidth = border;
  context.strokeRect(
    centerX - offset + strokeOffset,
    centerY - offset + strokeOffset,
    size - border,
    size - border,
  );
}

function DrawCentralStimulus(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  target: PeripheralAttentionCanvasTarget,
  metrics: ReturnType<typeof GetStageMetrics>,
  backgroundColor: string,
) {
  DrawCenterBox(context, centerX, centerY, metrics.centerBoxSize, metrics.centerBoxBorder);
  DrawVehicle(context, centerX, centerY, target, metrics.vehicleScale, backgroundColor);
}

function DrawPeripheralStimuli(
  context: CanvasRenderingContext2D,
  options: PeripheralAttentionCanvasStageOptions,
  width: number,
  height: number,
  metrics: ReturnType<typeof GetStageMetrics>,
  backgroundColor: string,
) {
  const targetSlot = options.peripheralSlot;
  if (!targetSlot) return;

  options.slots.forEach((slot) => {
    const isTarget = slot.axis === targetSlot.axis && slot.ring === targetSlot.ring;
    if (!isTarget && !options.hasDistractors) return;

    const angle = (-90 + slot.axis * 45) * Math.PI / 180;
    const radius = metrics.radii[slot.ring] ?? metrics.radii[metrics.radii.length - 1];
    const pointX = width / 2 + Math.cos(angle) * radius;
    const pointY = height / 2 + Math.sin(angle) * radius;
    if (isTarget) {
      DrawVehicle(context, pointX, pointY, 'car', metrics.vehicleScale, backgroundColor);
    } else {
      DrawTriangleDistractor(context, pointX, pointY, metrics.distractorWidth, metrics.distractorHeight, metrics.distractorStroke, backgroundColor);
    }
  });
}

function DrawVehicle(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  target: PeripheralAttentionCanvasTarget,
  scale: number,
  backgroundColor: string,
) {
  context.save();
  context.translate(centerX, centerY);
  context.scale(scale, scale);
  context.translate(-baseVehicleWidth / 2, -baseVehicleHeight / 2);
  if (target === 'truck') DrawTruck(context, backgroundColor);
  else DrawCar(context, backgroundColor);
  context.restore();
}

function DrawRoundedPolygon(context: CanvasRenderingContext2D, points: { x: number; y: number }[], radius: number) {
  context.beginPath();
  const last = points[points.length - 1];
  const first = points[0];
  context.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    context.arcTo(point.x, point.y, next.x, next.y, radius);
  });
  context.closePath();
  context.fill();
}

function DrawCar(context: CanvasRenderingContext2D, backgroundColor: string) {
  context.fillStyle = '#fff';
  context.beginPath();
  context.moveTo(21, 1.5); context.lineTo(51, 1.5); context.quadraticCurveTo(55.5, 1.5, 57.8, 6.5);
  context.lineTo(71.5, 38.5); context.quadraticCurveTo(73.5, 43.5, 68, 44.5); context.lineTo(66.5, 44.5);
  context.arc(54.5, 44.5, 12, 0, Math.PI, true); context.lineTo(42.5, 46); context.lineTo(29.5, 46); context.lineTo(29.5, 44.5);
  context.arc(17.5, 44.5, 12, 0, Math.PI, true); context.lineTo(5.5, 44.5); context.quadraticCurveTo(-1.5, 43.5, .5, 38.5);
  context.lineTo(14.2, 6.5); context.quadraticCurveTo(16.5, 1.5, 21, 1.5);
  context.closePath();
  context.fill();
  context.fillStyle = backgroundColor;
  DrawRoundedPolygon(context, [{ x: 21, y: 5.5 }, { x: 33.2, y: 5.5 }, { x: 33.2, y: 21.5 }, { x: 15, y: 21.5 }], 3.5);
  DrawRoundedPolygon(context, [{ x: 38.8, y: 5.5 }, { x: 51, y: 5.5 }, { x: 57, y: 21.5 }, { x: 38.8, y: 21.5 }], 3.5);
  DrawVehicleWheels(context);
}

function DrawTruck(context: CanvasRenderingContext2D, backgroundColor: string) {
  context.fillStyle = '#fff';
  context.beginPath();
  context.moveTo(38.8, 1.5); context.lineTo(51, 1.5); context.quadraticCurveTo(55.5, 1.5, 57.8, 6.5);
  context.lineTo(71.5, 38.5); context.quadraticCurveTo(73.5, 43.5, 68, 44.5); context.lineTo(66.5, 44.5);
  context.arc(54.5, 44.5, 12, 0, Math.PI, true); context.lineTo(42.5, 46); context.lineTo(29.5, 46); context.lineTo(29.5, 44.5);
  context.arc(17.5, 44.5, 12, 0, Math.PI, true); context.lineTo(5.5, 44.5); context.quadraticCurveTo(-1.5, 43.5, .5, 38.5);
  context.lineTo(3.5, 31.5); context.lineTo(37.5, 31.5); context.lineTo(37.5, 3.5); context.quadraticCurveTo(37.5, 1.5, 39.5, 1.5);
  context.closePath();
  context.fill();
  context.fillStyle = backgroundColor;
  DrawRoundedPolygon(context, [{ x: 38.8, y: 5.5 }, { x: 51, y: 5.5 }, { x: 57, y: 21.5 }, { x: 38.8, y: 21.5 }], 3.5);
  DrawVehicleWheels(context);
}

function DrawVehicleWheels(context: CanvasRenderingContext2D) {
  context.fillStyle = '#fff';
  [17.5, 54.5].forEach((x) => { context.beginPath(); context.arc(x, 44.5, 8.5, 0, Math.PI * 2); context.fill(); });
}

function DrawTriangleDistractor(context: CanvasRenderingContext2D, centerX: number, centerY: number, width: number, height: number, strokeWidth: number, backgroundColor: string) {
  const left = centerX - width / 2;
  const top = centerY - height / 2;
  context.beginPath();
  context.moveTo(left, top); context.lineTo(left + width, top); context.lineTo(centerX, top + height);
  context.closePath(); context.fillStyle = backgroundColor; context.fill(); context.strokeStyle = '#fff'; context.lineWidth = strokeWidth; context.stroke();
}

function DrawNoiseMask(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  imageData: ImageData | null | undefined,
) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  const mask = imageData && imageData.width === canvas.width && imageData.height === canvas.height
    ? imageData
    : CreateNoiseImageData(context, canvas.width, canvas.height);
  context.putImageData(mask, 0, 0);
}

function CreateNoiseImageData(context: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = context.createImageData(width, height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const value = Math.random() > 0.5 ? 255 : 0;
    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
    imageData.data[index + 3] = 255;
  }
  return imageData;
}

function Clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
