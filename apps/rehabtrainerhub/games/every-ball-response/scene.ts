import { Container, Graphics, Text, type Application } from 'pixi.js';
import type { BallId } from './logic/everyBallResponse';
import type { EveryBallVisual } from './logic/everyBallRun';
import type { Point } from './logic/responseDetection';
import { BallPlacement } from './scenePlacement';

export type ScenePalette = ReturnType<typeof ReadScenePalette>;

// Pixi and the camera overlay draw with the colors defined in game.css.
export function ReadScenePalette(element: Element) {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(`--every-ball-${name}`).trim();
  return {
    ink: token('ink'), label: token('label'), basketball: token('basketball'), basketballEdge: token('basketball-edge'),
    soccer: token('soccer'), tennis: token('tennis'), tennisEdge: token('tennis-edge'), tennisSeam: token('tennis-seam'),
    beach: [token('beach-1'), token('beach-2'), token('beach-3'), token('beach-4')], beachEdge: token('beach-edge'),
    correct: token('correct'), wrong: token('wrong'), hand: token('hand'), body: token('body'),
  };
}

// The stage canvas is transparent; the field color sits under it so the camera window can stay open.
export function DrawEveryBallScene(app: Application, visual: EveryBallVisual, palette: ScenePalette, ballNames: Record<BallId, string>) {
  const { width, height } = app.screen;
  for (const child of app.stage.removeChildren()) child.destroy({ children: true });
  if (visual.phase === 'fixation' && visual.fixationStyle === 'cross') {
    const size = Math.max(28, Math.min(width, height) * 0.04);
    const cross = new Graphics();
    cross.moveTo(width / 2 - size, height / 2).lineTo(width / 2 + size, height / 2);
    cross.moveTo(width / 2, height / 2 - size).lineTo(width / 2, height / 2 + size);
    cross.stroke({ color: palette.ink, width: Math.max(4, size * 0.14), cap: 'round' });
    app.stage.addChild(cross);
  }
  if (visual.phase === 'stimulus' && visual.ball) {
    const { x, y, radius } = BallPlacement(width, height, visual.xRatio ?? 0.5, visual.yRatio ?? 0.5);
    const container = new Container();
    container.position.set(x, y);
    container.addChild(DrawBall(visual.ball, radius, palette));
    const label = new Text({ text: ballNames[visual.ball], style: {
      fill: palette.label, fontFamily: 'Arial, sans-serif', fontSize: Math.max(18, radius * 0.22), fontWeight: '700',
    } });
    label.anchor.set(0.5);
    label.y = radius + Math.max(22, radius * 0.34);
    container.addChild(label);
    app.stage.addChild(container);
  }
  if (visual.phase === 'feedback') {
    const mark = new Graphics();
    const size = Math.min(width, height) * 0.14;
    const x = width / 2;
    const y = height / 2;
    if (visual.feedbackCorrect) {
      mark.moveTo(x - size * 0.75, y).lineTo(x - size * 0.22, y + size * 0.5).lineTo(x + size * 0.75, y - size * 0.62);
      mark.stroke({ color: palette.correct, width: Math.max(10, size * 0.14), cap: 'round', join: 'round' });
    } else {
      mark.moveTo(x - size * 0.56, y - size * 0.56).lineTo(x + size * 0.56, y + size * 0.56);
      mark.moveTo(x + size * 0.56, y - size * 0.56).lineTo(x - size * 0.56, y + size * 0.56);
      mark.stroke({ color: palette.wrong, width: Math.max(10, size * 0.14), cap: 'round' });
    }
    app.stage.addChild(mark);
  }
}

function Pentagon(graphics: Graphics, x: number, y: number, radius: number) {
  graphics.poly(Array.from({ length: 5 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
    return { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius };
  }));
}

function DrawBall(ball: BallId, radius: number, palette: ScenePalette) {
  const graphics = new Graphics();
  if (ball === 'basketball') {
    graphics.circle(0, 0, radius).fill({ color: palette.basketball }).stroke({ color: palette.basketballEdge, width: Math.max(4, radius * 0.06) });
    graphics.moveTo(-radius, 0).quadraticCurveTo(0, -radius * 0.18, radius, 0);
    graphics.moveTo(-radius, 0).quadraticCurveTo(0, radius * 0.18, radius, 0);
    graphics.moveTo(0, -radius).lineTo(0, radius);
    graphics.moveTo(-radius * 0.72, -radius * 0.72).quadraticCurveTo(-radius * 0.25, 0, -radius * 0.72, radius * 0.72);
    graphics.moveTo(radius * 0.72, -radius * 0.72).quadraticCurveTo(radius * 0.25, 0, radius * 0.72, radius * 0.72);
    graphics.stroke({ color: palette.ink, width: Math.max(3, radius * 0.035), cap: 'round' });
  } else if (ball === 'soccer') {
    graphics.circle(0, 0, radius).fill({ color: palette.soccer }).stroke({ color: palette.ink, width: Math.max(4, radius * 0.05) });
    Pentagon(graphics, 0, 0, radius * 0.32);
    graphics.fill({ color: palette.ink });
    for (let index = 0; index < 5; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
      Pentagon(graphics, Math.cos(angle) * radius * 0.62, Math.sin(angle) * radius * 0.62, radius * 0.16);
      graphics.fill({ color: palette.ink });
    }
    for (let index = 0; index < 5; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
      graphics.moveTo(Math.cos(angle) * radius * 0.32, Math.sin(angle) * radius * 0.32).lineTo(Math.cos(angle) * radius * 0.62, Math.sin(angle) * radius * 0.62);
    }
    graphics.stroke({ color: palette.ink, width: Math.max(2, radius * 0.025), cap: 'round' });
  } else if (ball === 'tennis') {
    graphics.circle(0, 0, radius).fill({ color: palette.tennis }).stroke({ color: palette.tennisEdge, width: Math.max(4, radius * 0.05) });
    graphics.moveTo(-radius * 0.68, -radius * 0.82).bezierCurveTo(-radius * 0.1, -radius * 0.28, -radius * 0.1, radius * 0.28, -radius * 0.68, radius * 0.82);
    graphics.moveTo(radius * 0.68, -radius * 0.82).bezierCurveTo(radius * 0.1, -radius * 0.28, radius * 0.1, radius * 0.28, radius * 0.68, radius * 0.82);
    graphics.stroke({ color: palette.tennisSeam, width: Math.max(5, radius * 0.07), cap: 'round' });
  } else {
    palette.beach.forEach((color, index) => {
      const start = -Math.PI / 2 + index * Math.PI / 2;
      graphics.moveTo(0, 0).arc(0, 0, radius, start, start + Math.PI / 2).lineTo(0, 0).fill({ color });
    });
    graphics.circle(0, 0, radius).stroke({ color: palette.beachEdge, width: Math.max(4, radius * 0.05) });
    graphics.circle(0, 0, radius * 0.18).fill({ color: palette.beach[3] }).stroke({ color: palette.beachEdge, width: Math.max(2, radius * 0.025) });
  }
  return graphics;
}

// Hand points and the hip and knee circles over the container's camera image, which is mirrored the same way.
export function DrawLandmarks(canvas: HTMLCanvasElement | null, frame: { videoWidth: number; videoHeight: number; hands: Point[][]; pose: Point[] } | null, palette: ScenePalette) {
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return;
  if (!frame) { context.clearRect(0, 0, canvas.width, canvas.height); return; }
  const { videoWidth: width, videoHeight: height } = frame;
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  context.clearRect(0, 0, width, height);
  context.fillStyle = palette.hand;
  for (const hand of frame.hands) {
    for (const point of hand) {
      context.beginPath();
      context.arc(point.x * width, point.y * height, Math.max(3, width * 0.006), 0, Math.PI * 2);
      context.fill();
    }
  }
  context.lineWidth = Math.max(3, width * 0.004);
  context.strokeStyle = palette.body;
  for (const point of frame.pose) {
    context.beginPath();
    context.arc(point.x * width, point.y * height, Math.max(4, width * 0.008), 0, Math.PI * 2);
    context.stroke();
  }
}
