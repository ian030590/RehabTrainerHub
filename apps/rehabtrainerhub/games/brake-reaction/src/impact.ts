import type { Severity } from './physics.js';
import { RandomFrom } from './round.js';
import { Alpha, Bloom, palette } from './scenePalette.js';

type Grade = ReturnType<typeof Severity>;
export type ImpactFrame = {
  grade: Grade;
  seconds: number;
  shake: number;
  push: number;
  zoom: number;
  flash: number;
  whiteFlash: number;
  debris: number;
  smoke: number;
  airbag: number;
};

export const impactProfiles = {
  light: { shake: 5, push: .5, zoom: .50, flash: 0, debris: 8, smoke: 0, feedbackDelay: 1, vibration: [35] },
  moderate: { shake: 14, push: 1.2, zoom: .46, flash: .30, debris: 26, smoke: 2.5, feedbackDelay: 1.5, vibration: [75, 30, 50] },
  severe: { shake: 30, push: 2.4, zoom: .42, flash: .60, debris: 60, smoke: 6, feedbackDelay: 2.1, vibration: [130, 45, 95, 40, 60] },
} as const;

function EaseOut(value: number) {
  return 1 - (1 - Math.min(1, Math.max(0, value))) ** 3;
}

export function ImpactAt(grade: Grade, seconds: number, reducedMotion: boolean): ImpactFrame {
  const profile = impactProfiles[grade];
  if (reducedMotion) return { grade, seconds: 0, shake: 0, push: profile.push, zoom: profile.zoom,
    flash: 0, whiteFlash: 0, debris: 0, smoke: profile.smoke ? .55 : 0, airbag: 0 };
  const zoomT = EaseOut((seconds - .15) / .70);
  const airbag = grade === 'severe' ? EaseOut(seconds / .09) * (1 - EaseOut((seconds - .52) / 1.18)) : 0;
  return {
    grade, seconds,
    shake: profile.shake * Math.exp(-seconds * 6.5) * Math.cos(seconds * 70),
    push: profile.push * EaseOut(seconds / .65),
    zoom: zoomT === 1 ? profile.zoom : 1 + (profile.zoom - 1) * zoomT,
    flash: profile.flash * Math.max(0, 1 - seconds / .60) ** 2,
    whiteFlash: grade === 'severe' ? .22 * Math.max(0, 1 - seconds / .11) : 0,
    debris: seconds < 1.35 ? profile.debris : 0,
    smoke: profile.smoke ? Math.max(0, 1 - seconds / profile.smoke) : 0,
    airbag,
  };
}

export function PaintImpact(ctx: CanvasRenderingContext2D, width: number, height: number, hood: number,
  impact: ImpactFrame, seed: number, side: number) {
  const random = RandomFrom(seed);
  const scale = Math.min(width, height);
  const x = width * (.5 + side * .065);
  const y = height * .53;
  const time = impact.seconds;
  const heavy = impact.grade === 'severe';
  for (let i = 0; i < impact.debris; i++) {
    const spread = scale * (.18 + random() * .86) * (random() < .5 ? -1 : 1);
    const velocity = scale * (.22 + random() * .77);
    const size = 1 + random() * (heavy ? 7 : 4);
    const px = x + spread * time;
    const py = y - velocity * time + scale * .85 * time ** 2;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(time * (2 + i % 7));
    ctx.globalAlpha = Math.max(0, 1 - time / 1.35);
    ctx.fillStyle = palette.debris[i % palette.debris.length];
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, size * .5);
    ctx.lineTo(-size * .8, size);
    ctx.fill();
    ctx.restore();
  }
  if (impact.smoke) {
    for (let i = 0; i < (heavy ? 9 : 5); i++) {
      const age = (time * (heavy ? .60 : .85) + i * .17) % 1;
      const offset = Math.sin(i * 7) * .055 + Math.sin(.51 + age * 5 + i) * age * .06;
      Bloom(ctx, width * (.5 + side * .11 + offset), hood - scale * (.021 + age * .20),
        scale * (.037 + age * .089), palette.smoke, impact.smoke * (.22 - age * .14), .81);
    }
  }
  if (impact.grade !== 'light') {
    ctx.save();
    ctx.strokeStyle = palette.screenCrack;
    ctx.lineWidth = heavy ? 1.4 : 1;
    ctx.globalAlpha = heavy ? .59 : .40;
    const rays = heavy ? 11 : 5;
    const nodes = [];
    for (let i = 0; i < rays; i++) {
      const theta = (i + .4) * 2 * Math.PI / rays + Math.sin(seed + i) * .12;
      const reach = scale * (heavy ? .50 : .22) * (.56 + .42 * Math.abs(Math.cos(i * 11)));
      const mx = x + Math.cos(theta) * reach * .36;
      const my = y + Math.sin(theta) * reach * .36;
      const ex = x + Math.cos(theta + (i % 2 ? .13 : -.12)) * reach;
      const ey = y + Math.sin(theta + (i % 2 ? .13 : -.12)) * reach;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(mx, my);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex + Math.cos(theta - .4) * reach * .13, ey + Math.sin(theta - .4) * reach * .13);
      ctx.stroke();
      nodes.push([mx, my] as const);
    }
    if (heavy) {
      for (const reach of [.48, 1]) {
        ctx.beginPath();
        nodes.forEach(([px, py], i) => {
          const nx = x + (px - x) * reach;
          const ny = y + (py - y) * reach;
          if (i === 0) ctx.moveTo(nx, ny);
          else ctx.lineTo(nx, ny);
        });
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  if (impact.airbag > 0) {
    const size = scale * (.24 + .28 * impact.airbag);
    const bagY = height + size * (.30 - .83 * impact.airbag);
    const material = ctx.createLinearGradient(0, bagY - size * .75, 0, height);
    material.addColorStop(0, palette.airbag);
    material.addColorStop(1, palette.airbagShadow);
    ctx.save();
    ctx.globalAlpha = impact.airbag;
    ctx.fillStyle = material;
    ctx.beginPath();
    ctx.ellipse(width * .5, bagY, size, size * .74, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
  if (impact.flash > 0 || impact.whiteFlash > 0) {
    ctx.fillStyle = Alpha(palette.flash, impact.flash);
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = Alpha(palette.white, impact.whiteFlash);
    ctx.fillRect(0, 0, width, height);
  }
}
