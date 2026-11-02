// The two-tone spark spray and the light pop are adapted from Sprite Fusion's open-source impact
// (https://www.spritefusion.com/pixel-art-vfx/impact), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, pixelP, Rng, Fit, pixelWHITE } from "../../core/index.js";
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
function Ray(p, x, y, a, pixelL, w, pixelC, from = 0) {
    const c = Math.cos(a), s = Math.sin(a);
    for (let d = from * pixelL; d <= pixelL; d += 0.5) {
        const u = d / pixelL, hw = w * Math.pow(1 - u, 1.6);
        const col = u < 0.3 ? pixelWHITE : u < 0.62 ? pixelC[5] : u < 0.88 ? pixelC[4] : pixelC[3];
        p.px(x + c * d, y + s * d, col);
        if (hw > 0.45)
            for (let o = 0.5; o <= hw; o += 0.5)
                for (const e of [-o, o])
                    p.px(x + c * d - s * e, y + s * d + c * e, u < 0.3 && o < 1 ? pixelC[5] : pixelC[4]);
    }
}
// the core: a crisp white diamond with a pale rim
function Diamond(p, x, y, r, pixelC) {
    for (let dy = -r - 1; dy <= r + 1; dy++)
        for (let dx = -r - 1; dx <= r + 1; dx++) {
            const m = Math.abs(dx) + Math.abs(dy);
            if (m <= r)
                p.px(x + dx, y + dy, pixelWHITE);
            else if (m === r + 1)
                p.px(x + dx, y + dy, pixelC[3]);
        }
}
export function Create(o) {
    const pixelC = Fit(o.palette, 7), pixelR = new Rng(o.seed), pixelX = 0, pixelY = -o.height, pixelA = o.aim, floor = () => 0;
    const ps = new Particles({ rng: pixelR, ground: floor, sparks: [pixelC[6], pixelC[5], pixelC[4], pixelC[2]] });
    const lights = new Lights();
    // the cross: a long thin ray along the blow, a stub behind, two unequal arms across, and a glint between
    const tilt = pixelR.range(-0.08, 0.08);
    const rays = [
        { a: pixelA + tilt, L: pixelR.range(33, 37), w: 2.2 },
        { a: pixelA + Math.PI + tilt, L: pixelR.range(8, 10), w: 2.2 },
        { a: pixelA - Math.PI / 2 + tilt, L: pixelR.range(15, 18), w: 2.6 },
        { a: pixelA + Math.PI / 2 + tilt, L: pixelR.range(10, 12), w: 2.3 },
        { a: pixelA - Math.PI / 4 + tilt, L: pixelR.range(5, 7), w: 1 },
    ];
    lights.add(pixelX, pixelY, 38, pixelC[4], 0.35, 0.18);
    lights.add(pixelX + Math.cos(pixelA) * 10, pixelY + Math.sin(pixelA) * 10, 22, pixelC[5], 0.45, 0.1);
    lights.add(pixelX, -2, 26, pixelC[3], 0.22, 0.22);
    // a cone of sparks sprayed on along the blow: they fall, bounce off the floor and die
    for (let i = 0; i < 9; i++) {
        const a = pixelA + pixelR.range(-0.6, 0.6) - 0.15, v = pixelR.range(170, 360);
        ps.spawn(pixelP.SPARK, pixelX + 1, pixelY, Math.cos(a) * v, Math.sin(a) * v - 40, pixelR.range(0.25, 0.45), pixelWHITE, 1, i > 6 ? pixelR.range(0.01, 0.03) : 0);
    }
    // hot pixel chips knocked off, tumbling down to tick off the floor
    for (let i = 0; i < 6; i++) {
        const a = pixelA + pixelR.range(-1.1, 0.5) - 0.3, v = pixelR.range(70, 170);
        ps.spawn(pixelP.GRIT, pixelX + 1, pixelY, Math.cos(a) * v, Math.sin(a) * v - pixelR.range(30, 80), pixelR.range(0.35, 0.45), pixelR.pick([pixelC[5], pixelC[4], pixelC[4], pixelC[3]]), 1);
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
                for (const r of rays)
                    Ray(p, pixelX, pixelY, r.a, r.L, r.w, pixelC);
                Diamond(p, pixelX, pixelY, 4, pixelC);
            }
            else if (t < 0.058) {
                // reaching further and thinning, the diamond still crisp
                for (const r of rays)
                    Ray(p, pixelX, pixelY, r.a, r.L * 1.2, r.w * 0.55, pixelC, 0.12);
                Diamond(p, pixelX, pixelY, 3, pixelC);
            }
            else if (t < 0.092) {
                // only the long ray lingers, its root burning away
                const r = rays[0];
                Ray(p, pixelX, pixelY, r.a, r.L * 1.3, 0.6, [pixelC[0], pixelC[1], pixelC[2], pixelC[3], pixelC[3], pixelC[4]], 0.4);
            }
            const pop = Math.exp(-t / 0.045);
            if (pop > 0.02) {
                p.glow(pixelX, pixelY, 22, pixelC[4], 0.3 * pop);
                p.glow(pixelX, pixelY, 7, pixelWHITE, 0.15 * pop);
                p.glowLine(pixelX, pixelY, pixelX + Math.cos(pixelA) * 26, pixelY + Math.sin(pixelA) * 26, 4, pixelC[5], 0.25 * pop);
            }
            lights.draw(p);
        },
    };
}
