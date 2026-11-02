// The star's key frames and the spark spray are adapted from Sprite Fusion's open-source impact
// (https://www.spritefusion.com/pixel-art-vfx/impact), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, fxP, Rng, Fit, clamp, smooth, ease, fxTAU, fxWHITE } from "../core/index.js";
import { Star, BrokenRing } from "./_lib.js";

export const meta = {
  name: "Parry",
  desc: "Two blades clash: their edges flash in an X, a white four-point star rings out, a ring breaks into arcs and a fan of gold sparks sprays up and rains down.",
  tags: ["impact", "parry", "block", "clash", "sword", "metal", "sparks", "one-shot"],
  size: [200, 112],
  origin: [100, 96],
  duration: 1,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2a1a08", "#6a4410", "#b07a1a", "#e8b030", "#ffe066", "#fff6c4", "#ffffff"], height: 30, seed: 11 },
};

export function Create(o) {
  const fxC = Fit(o.palette, 7), fxR = new Rng(o.seed), fxX = 0, fxY = -o.height, floor = () => 0;
  const ps = new Particles({ rng: fxR, ground: floor, sparks: [fxC[4], fxC[4], fxC[3], fxC[2]] });
  const lights = new Lights();
  // a hard four-point star: long arms on the axes, short ones between
  const sp = [];
  for (let i = 0; i < 8; i++) sp.push({ a: (i * Math.PI) / 4 + fxR.range(-0.04, 0.04), len: i % 2 ? fxR.range(6, 8) : i % 4 === 0 ? fxR.range(19, 22) : fxR.range(14, 17), w: i % 2 ? 1.2 : 2.2 });
  const segs = Array.from({ length: 6 }, (fx, i) => ({ a: (i / 6) * fxTAU + fxR.range(-0.1, 0.1), gap: fxR.range(0.55, 0.8), dr: fxR.range(0.1, 0.35) }));
  // the two edges that met: lines crossing in an X
  const edges = [-0.62 + fxR.range(-0.08, 0.08), Math.PI + 0.62 + fxR.range(-0.08, 0.08)];

  lights.add(fxX, fxY, 60, fxC[4], 0.65, 0.4);
  lights.add(fxX, fxY, 22, fxWHITE, 0.8, 0.08);
  // the fan: sparks thrown up and out to both sides, arcing over and raining down to bounce on the floor
  for (let i = 0; i < 24; i++) {
    const s = i % 2 ? 1 : -1, a = -Math.PI / 2 + s * fxR.range(0.3, 1.3), v = fxR.range(130, 290);
    ps.spawn(fxP.SPARK, fxX + s * fxR.range(1, 3), fxY, Math.cos(a) * v, Math.sin(a) * v, fxR.range(0.45, 0.85), fxWHITE, 1, i > 17 ? fxR.range(0.02, 0.07) : 0);
  }
  for (let i = 0; i < 8; i++) {
    const a = fxR.range(0, fxTAU), v = fxR.range(40, 110);
    ps.spawn(fxP.MOTE, fxX, fxY, Math.cos(a) * v, Math.sin(a) * v - 20, fxR.range(0.3, 0.55), fxR.pick([fxC[5], fxC[6]]), 0.6, fxR.range(0, 0.04));
  }
  for (let i = 0; i < 3; i++) {
    const a = fxR.range(0, fxTAU), d = fxR.range(12, 26);
    ps.spawn(fxP.STAR, fxX + Math.cos(a) * d, fxY + Math.sin(a) * d, 0, -3, fxR.range(0.22, 0.34), fxWHITE, fxR.range(1.6, 2.6), fxR.range(0.1, 0.3));
  }

  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      // the ring: rings out off the star and breaks into arcs that fly on and cool
      const u = (t - 0.03) / 0.36;
      if (u >= 0 && u < 1) {
        const r = 8 + 24 * ease.outCubic(u), brk = smooth(0.15, 0.6, u), i = u < 0.15 ? 6 : u < 0.35 ? 5 : u < 0.6 ? 4 : 3;
        BrokenRing(p, fxX, fxY, r, Math.max(1, 2.6 * Math.pow(1 - u, 1.2)), segs, brk, fxC[i], fxC[Math.max(2, i - 2)], u < 0.6 ? 1 : (1 - u) / 0.4, 1, 0);
        if (u < 0.5) p.glowRing(fxX, fxY, r, 5, fxC[4], 0.3 * (1 - u / 0.5));
      }
      ps.draw(p);
      // the edges flash where they met
      if (t < 0.058)
        for (const a of edges) {
          const ca = Math.cos(a), sa = Math.sin(a), fxL = t < 0.025 ? 26 : 32, k = t < 0.025 ? 1 : 0.6;
          for (let d = -fxL; d <= fxL; d += 0.5) {
            const q = Math.abs(d) / fxL;
            p.dot(fxX + ca * d, fxY + sa * d, q < 0.4 ? fxWHITE : q < 0.75 ? fxC[5] : fxC[4], q < 0.6 ? 1 : k * (1.3 - q));
          }
          p.glowLine(fxX - ca * fxL, fxY - sa * fxL, fxX + ca * fxL, fxY + sa * fxL, 4, fxC[5], 0.35 * k);
        }
      // the star: white, then bigger and gold as it thins, then just a glint
      if (t < 0.025) Star(p, fxX, fxY, sp, 1, 1, [fxC[4], fxWHITE, fxWHITE, fxWHITE], 1, 2.6);
      else if (t < 0.058) Star(p, fxX, fxY, sp, 1.25, 0.65, [fxC[2], fxC[5], fxC[6], fxWHITE], 1, 2.6);
      else if (t < 0.092) Star(p, fxX, fxY, sp, 1.4, 0.3, [fxC[2], fxC[4], fxC[5], fxC[6]], 1, 2);
      const pop = Math.exp(-t / 0.05);
      if (pop > 0.02) {
        p.glow(fxX, fxY, 30, fxC[4], 0.5 * pop);
        p.glow(fxX, fxY, 10, fxWHITE, 0.4 * pop);
      }
      lights.draw(p);
    },
  };
}
