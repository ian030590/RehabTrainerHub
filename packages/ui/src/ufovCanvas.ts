export type UfovCanvasPhase = 'fixation' | 'stimulus' | 'mask';
export type UfovCanvasTarget = 'car' | 'truck';

export interface UfovCanvasSlot {
  axis: number;
  ring: number;
  x: number;
  y: number;
}

export interface UfovCanvasStageOptions {
  ariaLabel: string;
  phase: UfovCanvasPhase;
  centralTarget: UfovCanvasTarget;
  hasPeripheral: boolean;
  hasDistractors: boolean;
  peripheralSlot?: UfovCanvasSlot;
  slots: readonly UfovCanvasSlot[];
  maskImageData?: ImageData | null;
}

interface CanvasSize {
  context: CanvasRenderingContext2D;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
}

const canvasStageClass = 'ufov-canvas-stage';
const canvasClass = 'ufov-stage-canvas';
const centerBoxSize = 80;
const centerBoxBorder = 5;
const vehicleScale = 0.72;
const vehicleWidth = 72;
const vehicleHeight = 48;
const distractorWidth = centerBoxSize;
const distractorHeight = 96;

export function EnsureUfovCanvasStage(displayElement: HTMLElement, ariaLabel: string) {
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

export function RenderUfovCanvasStage(displayElement: HTMLElement, options: UfovCanvasStageOptions) {
  const stage = EnsureUfovCanvasStage(displayElement, options.ariaLabel);
  DrawUfovCanvasStage(stage, options);
  return stage;
}

export function DrawUfovCanvasStage(stage: HTMLElement, options: UfovCanvasStageOptions) {
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
  context.clearRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = '#000';
  context.fillRect(0, 0, cssWidth, cssHeight);

  if (options.phase === 'fixation') {
    DrawCenterBox(context, cssWidth / 2, cssHeight / 2);
    return;
  }

  DrawCentralStimulus(context, cssWidth / 2, cssHeight / 2, options.centralTarget);
  if (options.hasPeripheral && options.peripheralSlot) {
    DrawPeripheralStimuli(context, options, cssWidth, cssHeight);
  }
}

export function PrepareUfovNoiseMask(stage: HTMLElement) {
  const canvas = GetStageCanvas(stage);
  const size = ResizeCanvasToStage(canvas, stage);
  if (!size) return null;
  return CreateNoiseImageData(size.context, canvas.width, canvas.height);
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

function DrawCenterBox(context: CanvasRenderingContext2D, centerX: number, centerY: number) {
  const offset = centerBoxSize / 2;
  const strokeOffset = centerBoxBorder / 2;
  context.strokeStyle = '#fff';
  context.lineWidth = centerBoxBorder;
  context.strokeRect(
    centerX - offset + strokeOffset,
    centerY - offset + strokeOffset,
    centerBoxSize - centerBoxBorder,
    centerBoxSize - centerBoxBorder,
  );
}

function DrawCentralStimulus(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  target: UfovCanvasTarget,
) {
  DrawCenterBox(context, centerX, centerY);
  DrawVehicle(context, centerX, centerY, target, vehicleScale);
}

function DrawPeripheralStimuli(
  context: CanvasRenderingContext2D,
  options: UfovCanvasStageOptions,
  width: number,
  height: number,
) {
  const targetSlot = options.peripheralSlot;
  if (!targetSlot) return;

  options.slots.forEach((slot) => {
    const isTarget = slot.axis === targetSlot.axis && slot.ring === targetSlot.ring;
    if (!isTarget && !options.hasDistractors) return;

    const pointX = width * slot.x / 100;
    const pointY = height * slot.y / 100;
    if (isTarget) {
      DrawVehicle(context, pointX, pointY, 'car', vehicleScale);
    } else {
      DrawTriangleDistractor(context, pointX, pointY);
    }
  });
}

function DrawVehicle(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  target: UfovCanvasTarget,
  scale: number,
) {
  context.save();
  context.translate(centerX, centerY);
  context.scale(scale, scale);
  context.translate(-vehicleWidth / 2, -vehicleHeight / 2);

  context.fillStyle = '#fff';
  context.strokeStyle = '#fff';
  context.lineWidth = 3;

  if (target === 'truck') {
    DrawTruckRoof(context);
  } else {
    DrawCarRoof(context);
  }

  context.fillStyle = '#fff';
  context.fillRect(4, 23, 64, 15);
  DrawWheel(context, 17, 39);
  DrawWheel(context, 55, 39);
  context.restore();
}

function DrawCarRoof(context: CanvasRenderingContext2D) {
  context.fillStyle = '#fff';
  context.beginPath();
  context.moveTo(22.2, 7);
  context.lineTo(49.8, 7);
  context.lineTo(59, 29);
  context.lineTo(13, 29);
  context.closePath();
  context.fill();

  context.fillStyle = '#000';
  context.fillRect(24, 15, 10, 9);
  context.fillRect(38, 15, 10, 9);
}

function DrawTruckRoof(context: CanvasRenderingContext2D) {
  context.fillStyle = '#fff';
  context.beginPath();
  context.moveTo(36, 7);
  context.lineTo(50.26, 7);
  context.lineTo(59, 29);
  context.lineTo(36, 29);
  context.closePath();
  context.fill();

  context.fillStyle = '#000';
  context.fillRect(42, 15, 10, 9);
}

function DrawWheel(context: CanvasRenderingContext2D, centerX: number, centerY: number) {
  context.beginPath();
  context.arc(centerX, centerY, 7, 0, Math.PI * 2);
  context.fillStyle = '#000';
  context.fill();
  context.strokeStyle = '#fff';
  context.lineWidth = 3;
  context.stroke();
}

function DrawTriangleDistractor(context: CanvasRenderingContext2D, centerX: number, centerY: number) {
  const left = centerX - distractorWidth / 2;
  const top = centerY - distractorHeight / 2;

  context.fillStyle = '#fff';
  context.beginPath();
  context.moveTo(centerX, top + distractorHeight);
  context.lineTo(left, top);
  context.lineTo(left + distractorWidth, top);
  context.closePath();
  context.fill();

  context.fillStyle = '#000';
  context.beginPath();
  context.moveTo(centerX, top + distractorHeight - 10);
  context.lineTo(left + 7, top + 6);
  context.lineTo(left + distractorWidth - 7, top + 6);
  context.closePath();
  context.fill();
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
