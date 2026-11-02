// The clods and the dust they kick up are adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Bits, Lights, fxB, Rng, Fit, clamp, ease, fxTAU, fxWHITE, Mix, Hex } from "../core/index.js";
import { Stone, Rock, rockShape } from "./_lib.js";

export const meta = {
  name: "Blunt hit",
  desc: "A heavy, soft thud: a white-hot lumpy blob cools to cream in a warm pool of light, inked wedges jab out and snap back, a squashed ring of dust puffs swells and drifts, clods drop.",
  tags: ["impact", "hit", "blunt", "punch", "club", "thump", "dust", "comic", "one-shot"],
  size: [128, 88],
  origin: [64, 72],
  duration: 0.9,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1d1620", "#4a3a3c", "#7d6a66", "#b09c90", "#dccab4", "#f6ead2", "#ffffff"], warm: "#ffc98a", dust: "#b7a8a6", clod: "#6e5a5a", height: 22, seed: 9 },
};

// a lumpy outline: radius at angle a for a blob of radius r
const lump = (r, a, ph) => r * (1 + 0.15 * Math.sin(5 * a + ph) + 0.08 * Math.sin(9 * a + ph * 2.3));

export function Create(o) {
  const fxC = Fit(o.palette, 7), fxR = new Rng(o.seed), fxX = 0, fxY = -o.height, fxPH = fxR.range(0, fxTAU), floor = () => 0;
  const fxWARM = Hex(o.warm), fxDUST = Hex(o.dust), st = Stone(o.clod);
  const lights = new Lights(), bits = new Bits({ ground: floor });
  // a warm pool of light, a white-hot heart, and a glow on the floor below
  lights.add(fxX, fxY, 48, fxWARM, 0.6, 0.4);
  lights.add(fxX, fxY, 16, fxWHITE, 0.6, 0.07);
  lights.add(fxX, -2, 36, fxWARM, 0.25, 0.4);
  // inked wedges: each jabs out at its own length and pace, then snaps back
  const wedges = Array.from({ length: 9 }, (fx, i) => ({ a: (i / 9) * fxTAU + fxR.range(-0.2, 0.2), len: fxR.range(6, 15), w: fxR.range(3.2, 5), r0: fxR.range(13, 16), t0: fxR.range(0.015, 0.04), out: fxR.range(0.04, 0.06), back: fxR.range(0.09, 0.14) }));
  // the squash ring: soft puffs flung out from the blob's rim, wider than tall, each its own size, pace and life
  const puffs = Array.from({ length: 30 }, (fx, i) => {
    const a = (i / 30) * fxTAU + fxR.range(-0.12, 0.12), side = Math.abs(Math.cos(a)), v = fxR.range(40, 140) * (0.6 + 0.5 * side);
    return { x: fxX + Math.cos(a) * 9, y: fxY + Math.sin(a) * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, r: fxR.range(2.4, 6.2) * (0.75 + 0.35 * side), life: fxR.range(0.35, 0.85), max: 0, t0: fxR.range(0.03, 0.1), lift: fxR.range(4, 16) };
  });
  // and a few that billow up off the top and hang longer
  for (let i = 0; i < 5; i++)
    puffs.push({ x: fxX + fxR.range(-6, 6), y: fxY - fxR.range(3, 6), vx: fxR.range(-30, 30), vy: -fxR.range(20, 45), r: fxR.range(3.5, 5.5), life: fxR.range(0.6, 0.85), max: 0, t0: fxR.range(0.05, 0.1), lift: fxR.range(14, 24) });
  for (const q of puffs) q.max = q.life;
  // heavier clods knocked loose: they arc out, drop to the floor, bounce once and settle
  for (let i = 0; i < 5; i++) {
    const s = fxR.sign(), a = -Math.PI / 2 + s * fxR.range(0.5, 1.3), v = fxR.range(70, 140);
    bits.add({ kind: fxB.CHUNK, x: fxX + s * fxR.range(4, 8), y: fxY + fxR.range(-3, 3), vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1, drag: 0.6, bounce: 0.28, life: fxR.range(0.65, 0.85), a: fxR.range(0, fxTAU), va: s * fxR.range(8, 16), s: fxR.chance(0.4) ? 2 : 1, pts: rockShape(fxR), pvy: 0 });
  }
  const kicks = [];

  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const q of puffs) {
        if (t < q.t0) continue;
        q.life -= dt;
        q.vx -= q.vx * 4.5 * dt;
        q.vy -= q.vy * 4.5 * dt + (q.lift ?? 6) * dt; // they slow, and lift a little as they thin
        q.x += q.vx * dt;
        q.y += q.vy * dt;
      }
      for (const b of bits.list) b.pvy = b.vy;
      bits.update(dt);
      // a clod hitting the floor kicks a little dust
      for (const b of bits.list)
        if (b.pvy > 60 && b.vy <= 0) {
          for (let i = 0; i < 2; i++) kicks.push({ x: b.x, y: -1, vx: fxR.sign() * fxR.range(8, 22), vy: -fxR.range(3, 10), r: fxR.range(1.2, 2), life: 0.4, max: 0.4, t0: 0 });
          b.pvy = 0;
        }
      for (const q of kicks) {
        q.life -= dt;
        q.vx -= q.vx * 4 * dt;
        q.vy -= q.vy * 4 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
      }
      lights.update(dt);
    },
    draw(p) {
      // dust: each puff swells and thins, warm-lit at first, its top catching the light
      for (const q of [...puffs, ...kicks]) {
        const k = q.life / q.max;
        if (t < q.t0 || k <= 0) continue;
        const r = q.r * (0.7 + (1 - k) * 0.85), a = Math.pow(k, 1.25) * Math.min(1, (t - q.t0) / 0.03), c = Mix(fxDUST, fxWARM, clamp(1 - (t - 0.03) / 0.25) * 0.55);
        p.disc(q.x, q.y, r, c, (d) => 0.58 * a * (1 - d * d * 0.75));
        p.disc(q.x - r * 0.22, q.y - r * 0.32, r * 0.58, Mix(c, fxWHITE, 0.55), (d) => 0.48 * a * (1 - d * d));
      }
      for (const b of bits.list) Rock(p, b, st);
      // the blob: white-hot and lumpy for a frame, then cream and a little bigger, then gone into the dust
      if (t < 0.058) {
        const f = t < 0.025 ? 0 : 1, fxR0 = f ? 13.5 : 11.5;
        p.shade(fxX - fxR0 * 1.4, fxY - fxR0 * 1.4, fxX + fxR0 * 1.4, fxY + fxR0 * 1.4, (x, y) => {
          const dx = x - fxX, dy = (y - fxY) * (f ? 1.25 : 1.1), d = Math.hypot(dx, dy), ro = lump(fxR0, Math.atan2(dy, dx), fxPH + f * 0.6);
          if (d > ro) return;
          const q = d / ro;
          return f === 0 ? (q < 0.55 ? fxWHITE : q < 0.86 ? fxC[5] : fxC[4]) : q < 0.3 ? fxWHITE : q < 0.72 ? fxC[5] : q < 0.9 ? fxC[4] : fxC[3];
        });
      }
      // inked wedges jab out from the blob and snap back
      for (const w of wedges) {
        const u = t - w.t0;
        if (u < 0 || u > w.out + w.back) continue;
        const s = u < w.out ? ease.outCubic(u / w.out) : 1 - ease.inQuad((u - w.out) / w.back), fxL = w.len * s;
        if (fxL < 1.5) continue;
        const ca = Math.cos(w.a), sa = Math.sin(w.a), r0 = w.r0 + 2 * s, hw = (w.w * (0.6 + 0.4 * s)) / 2;
        const tip = [fxX + ca * r0, fxY + sa * r0], end = [fxX + ca * (r0 + fxL), fxY + sa * (r0 + fxL)], n = [-sa * hw, ca * hw];
        const wedge = (g) => [[tip[0] - ca * g, tip[1] - sa * g], [end[0] + n[0] * (1 + g * 0.45) + ca * g, end[1] + n[1] * (1 + g * 0.45) + sa * g], [end[0] - n[0] * (1 + g * 0.45) + ca * g, end[1] - n[1] * (1 + g * 0.45) + sa * g]];
        p.poly(wedge(1), fxC[1]);
        p.poly(wedge(0), u < w.out + 0.02 ? fxWHITE : fxC[5]);
      }
      const pop = Math.exp(-t / 0.06);
      if (pop > 0.02) p.glow(fxX, fxY, 28, fxWARM, 0.5 * pop);
      lights.draw(p);
    },
  };
}
