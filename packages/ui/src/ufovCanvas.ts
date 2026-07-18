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

const CANVAS_STAGE_CLASS = 'ufov-canvas-stage';
const CANVAS_CLASS = 'ufov-stage-canvas';
const CENTER_BOX_SIZE = 80;
const CENTER_BOX_BORDER = 5;
const VEHICLE_SCALE = 0.72;
const VEHICLE_WIDTH = 72;
const VEHICLE_HEIGHT = 48;
const DISTRACTOR_WIDTH = CENTER_BOX_SIZE;
const DISTRACTOR_HEIGHT = 96;

export function ensureUfovCanvasStage(displayElement: HTMLElement, ariaLabel: string) {
  const currentStage = displayElement.querySelector<HTMLDivElement>(`.${CANVAS_STAGE_CLASS}`);
  if (currentStage) {
    currentStage.setAttribute('aria-label', ariaLabel);
    return currentStage;
  }

  const stage = document.createElement('div');
  stage.className = `ufov-stage ${CANVAS_STAGE_CLASS}`;
  stage.setAttribute('aria-label', ariaLabel);

  const canvas = document.createElement('canvas');
  canvas.className = CANVAS_CLASS;
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);
  displayElement.replaceChildren(stage);

  return stage;
}

export function renderUfovCanvasStage(displayElement: HTMLElement, options: UfovCanvasStageOptions) {
  const stage = ensureUfovCanvasStage(displayElement, options.ariaLabel);
  drawUfovCanvasStage(stage, options);
  return stage;
}

export function drawUfovCanvasStage(stage: HTMLElement, options: UfovCanvasStageOptions) {
  stage.setAttribute('aria-label', options.ariaLabel);
  const canvas = getStageCanvas(stage);
  const size = resizeCanvasToStage(canvas, stage);
  if (!size) return;

  if (options.phase === 'mask') {
    drawNoiseMask(canvas, size.context, options.maskImageData);
    return;
  }

  const { context, cssWidth, cssHeight, dpr } = size;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = '#000';
  context.fillRect(0, 0, cssWidth, cssHeight);

  if (options.phase === 'fixation') {
    drawCenterBox(context, cssWidth / 2, cssHeight / 2);
    return;
  }

  drawCentralStimulus(context, cssWidth / 2, cssHeight / 2, options.centralTarget);
  if (options.hasPeripheral && options.peripheralSlot) {
    drawPeripheralStimuli(context, options, cssWidth, cssHeight);
  }
}

export function prepareUfovNoiseMask(stage: HTMLElement) {
  const canvas = getStageCanvas(stage);
  const size = resizeCanvasToStage(canvas, stage);
  if (!size) return null;
  return createNoiseImageData(size.context, canvas.width, canvas.height);
}

function getStageCanvas(stage: HTMLElement) {
  const currentCanvas = stage.querySelector<HTMLCanvasElement>(`.${CANVAS_CLASS}`);
  if (currentCanvas) return currentCanvas;

  const canvas = document.createElement('canvas');
  canvas.className = CANVAS_CLASS;
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);
  return canvas;
}

function resizeCanvasToStage(canvas: HTMLCanvasElement, stage: HTMLElement): CanvasSize | null {
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

function drawCenterBox(context: CanvasRenderingContext2D, centerX: number, centerY: number) {
  const offset = CENTER_BOX_SIZE / 2;
  const strokeOffset = CENTER_BOX_BORDER / 2;
  context.strokeStyle = '#fff';
  context.lineWidth = CENTER_BOX_BORDER;
  context.strokeRect(
    centerX - offset + strokeOffset,
    centerY - offset + strokeOffset,
    CENTER_BOX_SIZE - CENTER_BOX_BORDER,
    CENTER_BOX_SIZE - CENTER_BOX_BORDER,
  );
}

function drawCentralStimulus(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  target: UfovCanvasTarget,
) {
  drawCenterBox(context, centerX, centerY);
  drawVehicle(context, centerX, centerY, target, VEHICLE_SCALE);
}

function drawPeripheralStimuli(
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
      drawVehicle(context, pointX, pointY, 'car', VEHICLE_SCALE);
    } else {
      drawTriangleDistractor(context, pointX, pointY);
    }
  });
}

function drawVehicle(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  target: UfovCanvasTarget,
  scale: number,
) {
  context.save();
  context.translate(centerX, centerY);
  context.scale(scale, scale);
  context.translate(-VEHICLE_WIDTH / 2, -VEHICLE_HEIGHT / 2);

  context.fillStyle = '#fff';
  context.strokeStyle = '#fff';
  context.lineWidth = 3;

  if (target === 'truck') {
    drawTruckRoof(context);
  } else {
    drawCarRoof(context);
  }

  context.fillStyle = '#fff';
  context.fillRect(4, 23, 64, 15);
  drawWheel(context, 17, 39);
  drawWheel(context, 55, 39);
  context.restore();
}

function drawCarRoof(context: CanvasRenderingContext2D) {
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

function drawTruckRoof(context: CanvasRenderingContext2D) {
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

function drawWheel(context: CanvasRenderingContext2D, centerX: number, centerY: number) {
  context.beginPath();
  context.arc(centerX, centerY, 7, 0, Math.PI * 2);
  context.fillStyle = '#000';
  context.fill();
  context.strokeStyle = '#fff';
  context.lineWidth = 3;
  context.stroke();
}

function drawTriangleDistractor(context: CanvasRenderingContext2D, centerX: number, centerY: number) {
  const left = centerX - DISTRACTOR_WIDTH / 2;
  const top = centerY - DISTRACTOR_HEIGHT / 2;

  context.fillStyle = '#fff';
  context.beginPath();
  context.moveTo(centerX, top + DISTRACTOR_HEIGHT);
  context.lineTo(left, top);
  context.lineTo(left + DISTRACTOR_WIDTH, top);
  context.closePath();
  context.fill();

  context.fillStyle = '#000';
  context.beginPath();
  context.moveTo(centerX, top + DISTRACTOR_HEIGHT - 10);
  context.lineTo(left + 7, top + 6);
  context.lineTo(left + DISTRACTOR_WIDTH - 7, top + 6);
  context.closePath();
  context.fill();
}

function drawNoiseMask(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  imageData: ImageData | null | undefined,
) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  const mask = imageData && imageData.width === canvas.width && imageData.height === canvas.height
    ? imageData
    : createNoiseImageData(context, canvas.width, canvas.height);
  context.putImageData(mask, 0, 0);
}

function createNoiseImageData(context: CanvasRenderingContext2D, width: number, height: number) {
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
