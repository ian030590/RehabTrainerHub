// Left-hand-drive cockpit drawn over the pixel view. The camera sits at the
// driver's eye, so the wheel is centred and the car's centreline (console,
// interior mirror, bonnet) is to the right.

export interface CockpitPoint {
  x: number;
  y: number;
}

export interface CockpitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CockpitLayout {
  width: number;
  height: number;
  roofBottom: number;
  dashTop: number;
  wheel: { x: number; y: number; radius: number };
  gauge: { x: number; y: number; radius: number };
  console: CockpitRect;
  bonnet: CockpitPoint[];
  dashboard: CockpitPoint[];
  leftPillar: CockpitPoint[];
  rightPillar: CockpitPoint[];
  mirrors: Record<'center' | 'left' | 'right', CockpitRect>;
}

export interface CockpitState {
  steeringAngleDeg: number;
  speedKph: number;
  maxKph: number;
  wheelImage: CanvasImageSource | null;
}

const gaugeSweepDeg = 115;
const steeringDegPerRadian = 150;
const steeringLimitDeg = 120;

const colors = {
  headliner: '#2a2f36',
  pillar: '#1d2127',
  pillarEdge: '#3a414b',
  dash: '#22262c',
  dashTop: '#353b44',
  dashShadow: '#15181c',
  bonnet: '#2b63c8',
  bonnetShine: '#4f86e0',
  console: '#191c21',
  screen: '#0f3446',
  screenText: '#7fd8f0',
  gaugeFace: '#0b0f14',
  gaugeRing: '#56606c',
  gaugeTick: '#d8e2ea',
  needle: '#ff5a4a',
  digits: '#e9f6ff',
  mirrorFrame: '#111418',
  mirrorHousing: '#2b63c8',
  mirrorGlass: '#203040',
  wheel: '#121417',
};

function Round(value: number) {
  return Math.round(value);
}

// topInset reserves a band at the top (canvas pixels) for page overlays such
// as the phone status panel; the headliner grows and the interior mirror
// hangs below it.
export function CalculateCockpitLayout(width: number, height: number, topInset = 0): CockpitLayout {
  const roofBottom = Math.max(Round(height * 0.07), Math.ceil(topInset));
  const dashTop = Round(height * 0.76);
  const wheelRadius = Round(Math.min(width * 0.24, height * 0.3));
  const wheel = { x: Round(width * 0.5), y: Round(height * 0.98), radius: wheelRadius };
  const gauge = { x: wheel.x, y: Round(wheel.y - wheelRadius * 0.62), radius: Math.max(8, Round(wheelRadius * 0.3)) };
  const centerWidth = Math.max(24, Round(width * 0.2));
  const centerHeight = Math.max(12, Round(centerWidth * 0.3));
  const sideWidth = Math.max(24, Round(width * 0.13));
  const sideHeight = Math.max(16, Round(sideWidth * 0.72));
  const sideTop = Round(height * 0.52);
  const centerline = width * 0.62;
  return {
    width,
    height,
    roofBottom,
    dashTop,
    wheel,
    gauge,
    console: { x: Round(width * 0.66), y: dashTop + Round(height * 0.04), w: Round(width * 0.16), h: Round((height - dashTop) * 0.62) },
    bonnet: [
      { x: centerline - width * 0.36, y: dashTop + 2 },
      { x: centerline - width * 0.26, y: dashTop - height * 0.05 },
      { x: centerline + width * 0.26, y: dashTop - height * 0.05 },
      { x: centerline + width * 0.36, y: dashTop + 2 },
    ],
    dashboard: [
      { x: 0, y: dashTop + height * 0.05 },
      { x: width * 0.24, y: dashTop },
      { x: width * 0.78, y: dashTop },
      { x: width, y: dashTop + height * 0.035 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    leftPillar: [
      { x: 0, y: 0 },
      { x: width * 0.09, y: 0 },
      { x: width * 0.17, y: dashTop },
      { x: width * 0.11, y: dashTop },
      { x: 0, y: height * 0.06 },
    ],
    rightPillar: [
      { x: width, y: 0 },
      { x: width * 0.95, y: 0 },
      { x: width * 0.905, y: dashTop },
      { x: width * 0.94, y: dashTop },
      { x: width, y: height * 0.08 },
    ],
    mirrors: {
      center: { x: Round(centerline - centerWidth / 2), y: roofBottom + 2, w: centerWidth, h: centerHeight },
      left: { x: 2, y: sideTop, w: sideWidth, h: sideHeight },
      right: { x: width - sideWidth - 2, y: sideTop, w: sideWidth, h: sideHeight },
    },
  };
}

// Desktop navigation map, in CSS pixels: top right, under the stop button,
// between the interior mirror and the right door mirror.
export function CalculateDesktopMiniMapRect(width: number, height: number): CockpitRect {
  const { center, right } = CalculateCockpitLayout(width, height).mirrors;
  const edge = 18;
  const gap = 12;
  const top = 68;
  const w = Math.floor(Math.min(236, width - edge - (center.x + center.w + gap)));
  const h = Math.floor(Math.min(278, right.y - gap - top));
  return { x: width - edge - w, y: top, w, h };
}

// Degrees clockwise from straight up; the dial sweeps 230 degrees.
export function CalculateSpeedometerNeedleAngle(speedKph: number, maxKph: number): number {
  const ratio = Math.max(0, Math.min(1, maxKph > 0 ? speedKph / maxKph : 0));
  return -gaugeSweepDeg + ratio * gaugeSweepDeg * 2;
}

export function CalculateSteeringWheelAngle(frontWheelAngle: number): number {
  const angle = frontWheelAngle * steeringDegPerRadian;
  return Math.max(-steeringLimitDeg, Math.min(steeringLimitDeg, angle)) + 0;
}

function FillPolygon(ctx: CanvasRenderingContext2D, points: CockpitPoint[], color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach((point, index) => (index === 0 ? ctx.moveTo(Round(point.x), Round(point.y)) : ctx.lineTo(Round(point.x), Round(point.y))));
  ctx.closePath();
  ctx.fill();
}

// 3x5 pixel glyphs for the speed readout.
const glyphs: Record<string, string> = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  k: '100101110101101', m: '000111111101101', '/': '001001010100100', h: '100100111101101',
};

export function DrawPixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, scale: number, color: string) {
  ctx.fillStyle = color;
  let cursor = Round(x);
  for (const character of text) {
    const glyph = glyphs[character];
    if (glyph) {
      for (let index = 0; index < 15; index += 1) {
        if (glyph[index] === '1') ctx.fillRect(cursor + (index % 3) * scale, Round(y) + Math.floor(index / 3) * scale, scale, scale);
      }
    }
    cursor += 4 * scale;
  }
}

export function MeasurePixelText(text: string, scale: number) {
  return Math.max(0, text.length * 4 - 1) * scale;
}

function DrawMirror(ctx: CanvasRenderingContext2D, rect: CockpitRect, image: CanvasImageSource | null, kind: 'center' | 'left' | 'right') {
  if (kind !== 'center') {
    // Body-coloured housing reaching back towards the door.
    const housingX = kind === 'left' ? rect.x + rect.w - 3 : rect.x - 3;
    ctx.fillStyle = colors.mirrorHousing;
    ctx.fillRect(housingX, rect.y + Round(rect.h * 0.35), 6, Round(rect.h * 0.4));
  } else {
    ctx.fillStyle = colors.mirrorFrame;
    ctx.fillRect(Round(rect.x + rect.w / 2) - 1, 0, 3, rect.y + 1);
  }
  ctx.fillStyle = kind === 'center' ? colors.mirrorFrame : colors.mirrorHousing;
  ctx.fillRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
  ctx.fillStyle = colors.mirrorFrame;
  ctx.fillRect(rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2);
  if (image) ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
  else {
    ctx.fillStyle = colors.mirrorGlass;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(rect.x, rect.y, rect.w, 1);
}

function DrawGauge(ctx: CanvasRenderingContext2D, layout: CockpitLayout, state: CockpitState) {
  const { gauge } = layout;
  ctx.fillStyle = colors.dashShadow;
  ctx.beginPath();
  ctx.arc(gauge.x, gauge.y, gauge.radius + 4, Math.PI, 0);
  ctx.lineTo(gauge.x + gauge.radius + 4, gauge.y + gauge.radius);
  ctx.lineTo(gauge.x - gauge.radius - 4, gauge.y + gauge.radius);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.gaugeRing;
  ctx.beginPath();
  ctx.arc(gauge.x, gauge.y, gauge.radius + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.gaugeFace;
  ctx.beginPath();
  ctx.arc(gauge.x, gauge.y, gauge.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.gaugeTick;
  for (let speed = 0; speed <= state.maxKph; speed += 10) {
    const angle = (CalculateSpeedometerNeedleAngle(speed, state.maxKph) * Math.PI) / 180;
    const length = speed % 20 === 0 ? 3 : 2;
    for (let step = 0; step < length; step += 1) {
      const radius = gauge.radius - 1 - step;
      ctx.fillRect(Round(gauge.x + Math.sin(angle) * radius), Round(gauge.y - Math.cos(angle) * radius), 1, 1);
    }
  }
  const needle = (CalculateSpeedometerNeedleAngle(state.speedKph, state.maxKph) * Math.PI) / 180;
  ctx.strokeStyle = colors.needle;
  ctx.lineWidth = Math.max(1, Round(gauge.radius / 12));
  ctx.beginPath();
  ctx.moveTo(gauge.x, gauge.y);
  ctx.lineTo(gauge.x + Math.sin(needle) * (gauge.radius - 2), gauge.y - Math.cos(needle) * (gauge.radius - 2));
  ctx.stroke();
  const scale = gauge.radius >= 22 ? 2 : 1;
  const digits = String(Math.max(0, Math.round(state.speedKph)));
  DrawPixelText(ctx, digits, gauge.x - MeasurePixelText(digits, scale) / 2, gauge.y + Round(gauge.radius * 0.28), scale, colors.digits);
  DrawPixelText(ctx, 'km/h', gauge.x - MeasurePixelText('km/h', 1) / 2, gauge.y + Round(gauge.radius * 0.28) + 6 * scale, 1, colors.gaugeTick);
}

// The wheel leans back towards the driver, so its rim looks squashed
// vertically; the spokes turn inside that outline around the hub.
function DrawWheel(ctx: CanvasRenderingContext2D, layout: CockpitLayout, state: CockpitState) {
  const { wheel } = layout;
  const size = wheel.radius * 0.62;
  ctx.save();
  ctx.translate(wheel.x, wheel.y - wheel.radius * 0.15);
  ctx.scale(1, 0.76);
  ctx.rotate((state.steeringAngleDeg * Math.PI) / 180);
  if (state.wheelImage) {
    ctx.drawImage(state.wheelImage, -size, -size, size * 2, size * 2);
  } else {
    ctx.strokeStyle = colors.wheel;
    ctx.lineWidth = Math.max(3, Round(size * 0.16));
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = colors.wheel;
    ctx.fillRect(-size * 0.86, -2, size * 1.72, 5);
  }
  ctx.restore();
}

export function DrawLeftHandDriveCockpit(
  ctx: CanvasRenderingContext2D,
  layout: CockpitLayout,
  state: CockpitState,
  mirrors: Record<'center' | 'left' | 'right', CanvasImageSource | null>,
) {
  FillPolygon(ctx, layout.bonnet, colors.bonnet);
  const bonnetTop = layout.bonnet[1];
  ctx.fillStyle = colors.bonnetShine;
  ctx.fillRect(Round(bonnetTop.x + 4), Round(bonnetTop.y), Round(layout.bonnet[2].x - bonnetTop.x - 8), 1);
  FillPolygon(ctx, layout.dashboard, colors.dash);
  ctx.fillStyle = colors.dashTop;
  ctx.fillRect(Round(layout.width * 0.24), layout.dashTop, Round(layout.width * 0.54), 2);
  ctx.fillStyle = colors.console;
  ctx.fillRect(layout.console.x, layout.console.y, layout.console.w, layout.console.h);
  ctx.fillStyle = colors.screen;
  const screen = { x: layout.console.x + 3, y: layout.console.y + 3, w: layout.console.w - 6, h: Math.max(4, Round(layout.console.h * 0.45)) };
  ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
  ctx.fillStyle = colors.screenText;
  ctx.fillRect(screen.x + 2, screen.y + 2, Round(screen.w * 0.5), 1);
  ctx.fillRect(screen.x + 2, screen.y + 4, Round(screen.w * 0.3), 1);
  ctx.fillStyle = colors.headliner;
  ctx.fillRect(0, 0, layout.width, layout.roofBottom);
  FillPolygon(ctx, layout.leftPillar, colors.pillar);
  FillPolygon(ctx, layout.rightPillar, colors.pillar);
  ctx.strokeStyle = colors.pillarEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Round(layout.leftPillar[1].x), 0);
  ctx.lineTo(Round(layout.leftPillar[2].x), layout.dashTop);
  ctx.moveTo(Round(layout.rightPillar[1].x), 0);
  ctx.lineTo(Round(layout.rightPillar[2].x), layout.dashTop);
  ctx.stroke();
  DrawMirror(ctx, layout.mirrors.left, mirrors.left, 'left');
  DrawMirror(ctx, layout.mirrors.right, mirrors.right, 'right');
  DrawMirror(ctx, layout.mirrors.center, mirrors.center, 'center');
  DrawGauge(ctx, layout, state);
  DrawWheel(ctx, layout, state);
}
