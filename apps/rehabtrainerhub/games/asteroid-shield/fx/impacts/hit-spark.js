// The two-tone spark spray and the light pop are adapted from Sprite Fusion's open-source impact
// (https://www.spritefusion.com/pixel-art-vfx/impact), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, fxP, Rng, Fit, fxWHITE } from "../core/index.js";

export const meta = {
  name: "Hit spark",
  desc: "The everyday hit: a sharp, lopsided cross flare with one long ray along the blow round a white diamond core, then a cone of sparks and hot chips that fall and bounce.",
  tags: ["impact", "hit", "spark", "combat", "directional", "one-shot"],
  size: [136, 80],
  origin: [44, 64],
  duration: 0.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffe26b", "#fff3a6", "#ffffff"], height: 20, aim: 0.1, seed: 4 },
};

// one ray of the cross: fat at the root, a hair at the tip, white cooling outward; from..to draws a stretch of it
function Ray(p, x, y, a, fxL, w, fxC, from = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let d = from * fxL; d <= fxL; d += 0.5) {
    const u = d / fxL, hw = w * Math.pow(1 - u, 1.6);
    const col = u < 0.3 ? fxWHITE : u < 0.62 ? fxC[5] : u < 0.88 ? fxC[4] : fxC[3];
    p.px(x + c * d, y + s * d, col);
    if (hw > 0.45) for (let o = 0.5; o <= hw; o += 0.5) for (const e of [-o, o]) p.px(x + c * d - s * e, y + s * d + c * e, u < 0.3 && o < 1 ? fxC[5] : fxC[4]);
  }
}

// the core: a crisp white diamond with a pale rim
function Diamond(p, x, y, r, fxC) {
  for (let dy = -r - 1; dy <= r + 1; dy++)
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const m = Math.abs(dx) + Math.abs(dy);
      if (m <= r) p.px(x + dx, y + dy, fxWHITE);
      else if (m === r + 1) p.px(x + dx, y + dy, fxC[3]);
    }
}

export function Create(o) {
  const fxC = Fit(o.palette, 7), fxR = new Rng(o.seed), fxX = 0, fxY = -o.height, fxA = o.aim, floor = () => 0;
  const ps = new Particles({ rng: fxR, ground: floor, sparks: [fxC[6], fxC[5], fxC[4], fxC[2]] });
  const lights = new Lights();
  // the cross: a long thin ray along the blow, a stub behind, two unequal arms across, and a glint between
  const tilt = fxR.range(-0.08, 0.08);
  const rays = [
    { a: fxA + tilt, L: fxR.range(33, 37), w: 2.2 },
    { a: fxA + Math.PI + tilt, L: fxR.range(8, 10), w: 2.2 },
    { a: fxA - Math.PI / 2 + tilt, L: fxR.range(15, 18), w: 2.6 },
    { a: fxA + Math.PI / 2 + tilt, L: fxR.range(10, 12), w: 2.3 },
    { a: fxA - Math.PI / 4 + tilt, L: fxR.range(5, 7), w: 1 },
  ];

  lights.add(fxX, fxY, 38, fxC[4], 0.35, 0.18);
  lights.add(fxX + Math.cos(fxA) * 10, fxY + Math.sin(fxA) * 10, 22, fxC[5], 0.45, 0.1);
  lights.add(fxX, -2, 26, fxC[3], 0.22, 0.22);
  // a cone of sparks sprayed on along the blow: they fall, bounce off the floor and die
  for (let i = 0; i < 9; i++) {
    const a = fxA + fxR.range(-0.6, 0.6) - 0.15, v = fxR.range(170, 360);
    ps.spawn(fxP.SPARK, fxX + 1, fxY, Math.cos(a) * v, Math.sin(a) * v - 40, fxR.range(0.25, 0.45), fxWHITE, 1, i > 6 ? fxR.range(0.01, 0.03) : 0);
  }
  // hot pixel chips knocked off, tumbling down to tick off the floor
  for (let i = 0; i < 6; i++) {
    const a = fxA + fxR.range(-1.1, 0.5) - 0.3, v = fxR.range(70, 170);
    ps.spawn(fxP.GRIT, fxX + 1, fxY, Math.cos(a) * v, Math.sin(a) * v - fxR.range(30, 80), fxR.range(0.35, 0.45), fxR.pick([fxC[5], fxC[4], fxC[4], fxC[3]]), 1);
  }

  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      ps.draw(p);
      if (t < 0.025) {
        // the flash: the whole cross round the diamond
        for (const r of rays) Ray(p, fxX, fxY, r.a, r.L, r.w, fxC);
        Diamond(p, fxX, fxY, 4, fxC);
      } else if (t < 0.058) {
        // reaching further and thinning, the diamond still crisp
        for (const r of rays) Ray(p, fxX, fxY, r.a, r.L * 1.2, r.w * 0.55, fxC, 0.12);
        Diamond(p, fxX, fxY, 3, fxC);
      } else if (t < 0.092) {
        // only the long ray lingers, its root burning away
        const r = rays[0];
        Ray(p, fxX, fxY, r.a, r.L * 1.3, 0.6, [fxC[0], fxC[1], fxC[2], fxC[3], fxC[3], fxC[4]], 0.4);
      }
      const pop = Math.exp(-t / 0.045);
      if (pop > 0.02) {
        p.glow(fxX, fxY, 22, fxC[4], 0.3 * pop);
        p.glow(fxX, fxY, 7, fxWHITE, 0.15 * pop);
        p.glowLine(fxX, fxY, fxX + Math.cos(fxA) * 26, fxY + Math.sin(fxA) * 26, 4, fxC[5], 0.25 * pop);
      }
      lights.draw(p);
    },
  };
}
