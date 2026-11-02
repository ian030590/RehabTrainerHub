// The flutter (a swing that slows at its ends, a tilt that follows it, a paper flip that shows the back) adapts
// Sprite Fusion's open-source falling leaves (https://www.spritefusion.com/pixel-art-vfx/falling-leaves),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, pixelP, Rng, Fit, Sparkle, clamp, seg, ease, pixelTAU, pixelWHITE, Hex, scale, Mix } from "../../core/index.js";
export const meta = {
    name: "Confetti",
    desc: "Two party poppers bang one after the other: paper bits and curly streamers burst out, stall, then tumble and flutter down, flipping, and settle on the floor.",
    tags: ["ui", "celebration", "confetti", "party", "reward", "one-shot"],
    size: [200, 140],
    origin: [100, 126],
    duration: 3.4,
    loop: false,
    fps: 30,
    bg: "ground",
    options: { palette: ["#ff4a5a", "#ff9a2a", "#ffe03c", "#5ad84a", "#3cc8ff", "#7a6cff", "#f53cd1"], seed: 11 },
};
const pixelPOPPERS = [
    { x: -74, y: -1, a: -Math.PI / 2 + 0.62, t: 0.1 },
    { x: 74, y: -1, a: -Math.PI / 2 - 0.62, t: 0.26 },
];
// a party popper: a striped cone pointing along a, kicked back k px when it fires
function Popper(p, x, y, a, k, pixelC, alpha) {
    const ca = Math.cos(a), sa = Math.sin(a), bx = x - ca * k, by = y - sa * k;
    p.shade(bx - 12, by - 12, bx + 12, by + 12, (px, py, o) => {
        const dx = px - bx, dy = py - by, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
        // u along the cone (0 at its tip on the floor, 11 at its mouth), v across
        if (u < 0 || u > 11)
            return;
        const hw = 0.8 + u * 0.32;
        if (Math.abs(v) > hw + 0.6)
            return;
        o.a = alpha;
        if (Math.abs(v) > hw - 0.4 || u > 10.2 || u < 0.8)
            return pixelC[0];
        const stripe = Math.floor((u + v * 0.6) / 2.2) % 2 === 0;
        return stripe ? (v < 0 ? pixelC[2] : scale(pixelC[2], 0.75)) : v < 0 ? pixelWHITE : pixelC[3];
    });
}
export function Create(o) {
    const pixelC = Fit(o.palette, 7), pixelR = new Rng(o.seed);
    const ps = new Particles({ rng: pixelR, ground: () => 0, sparks: [pixelC[6], pixelC[5], pixelC[4], pixelC[3]] }), lights = new Lights();
    const bits = [], ribbons = [], fired = [false, false], end = meta.duration - 0.05;
    const kick = (t, pp) => (t < pp.t ? 0 : 3 * Math.exp(-(t - pp.t) * 14));
    function Fire(pp) {
        const mx = pp.x + Math.cos(pp.a) * 11, my = pp.y + Math.sin(pp.a) * 11;
        lights.add(mx, my, 34, pixelWHITE, 0.6, 0.12);
        lights.add(mx, my, 50, pixelC[2], 0.4, 0.4);
        for (let i = 0; i < 6; i++)
            ps.spawn(pixelP.SMOKE, mx, my, Math.cos(pp.a) * pixelR.range(20, 60) + pixelR.range(-10, 10), Math.sin(pp.a) * pixelR.range(20, 60), pixelR.range(0.6, 1), pixelC[0], pixelR.range(2.5, 4));
        for (let i = 0; i < 12; i++) {
            const an = pp.a + pixelR.range(-0.5, 0.5), sp = pixelR.range(120, 260);
            ps.spawn(pixelP.SPARK, mx, my, Math.cos(an) * sp, Math.sin(an) * sp, pixelR.range(0.1, 0.25));
        }
        // paper: thrown hard up the cone, the air soon stalls it
        for (let i = 0; i < 46; i++) {
            const an = pp.a + pixelR.range(-0.38, 0.38), sp = pixelR.range(200, 380);
            bits.push({ x: mx, y: my, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, c: pixelR.pick(pixelC), w: pixelR.range(2, 3), h: pixelR.range(3, 4.6), ang: pixelR.range(0, pixelTAU), spin: pixelR.range(-14, 14), flip: pixelR.range(0, pixelTAU), fs: pixelR.range(5, 13), ph: pixelR.range(0, pixelTAU), amp: pixelR.range(5, 12), fw: pixelR.range(2, 3.4), x0: 0, mode: 0, rest: 0, fall: pixelR.range(26, 40) });
        }
        // streamers: a head that flies like the paper, a tail that follows it and curls
        for (let i = 0; i < 4; i++) {
            const an = pp.a + pixelR.range(-0.25, 0.25), sp = pixelR.range(220, 330), n = 11;
            ribbons.push({ pts: Array.from({ length: n }, () => [mx, my]), vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, c: pixelR.pick(pixelC), ph: pixelR.range(0, pixelTAU), amp: pixelR.range(6, 12), fw: pixelR.range(1.5, 2.4), mode: 0, x0: 0, curl: pixelR.range(0.7, 1.1), fall: pixelR.range(22, 32) });
        }
    }
    let t = 0;
    return {
        update(dt) {
            t += dt;
            pixelPOPPERS.forEach((pp, i) => !fired[i] && t >= pp.t && ((fired[i] = true), Fire(pp)));
            for (const b of bits) {
                if (b.mode === 2) {
                    b.rest += dt;
                    continue;
                }
                b.flip += b.fs * dt;
                if (b.mode === 0) {
                    // the burst: heavy drag, a little gravity, tumbling fast; once slow it starts to flutter
                    b.vx -= b.vx * 3.4 * dt;
                    b.vy -= b.vy * 3.4 * dt - 140 * dt;
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;
                    b.ang += b.spin * dt;
                    if (Math.hypot(b.vx, b.vy) < 40)
                        (b.mode = 1), (b.x0 = b.x - Math.sin(b.ph) * b.amp);
                }
                else {
                    b.ph += b.fw * dt;
                    b.x0 += b.vx * dt;
                    b.vx -= b.vx * 2 * dt;
                    b.x = b.x0 + Math.sin(b.ph) * b.amp;
                    b.y += b.fall * (0.4 + 0.9 * Math.abs(Math.cos(b.ph))) * dt;
                    b.ang = Math.cos(b.ph) * 0.9;
                    if (b.y >= -1)
                        (b.y = -0.5), (b.mode = 2), (b.ang = pixelR.range(-0.3, 0.3)), (b.flip = 0);
                }
            }
            for (const r of ribbons) {
                const h = r.pts[0];
                if (r.mode === 0) {
                    r.vx -= r.vx * 3 * dt;
                    r.vy -= r.vy * 3 * dt - 120 * dt;
                    h[0] += r.vx * dt;
                    h[1] += r.vy * dt;
                    if (Math.hypot(r.vx, r.vy) < 35)
                        (r.mode = 1), (r.x0 = h[0] - Math.sin(r.ph) * r.amp);
                }
                else if (h[1] < -1) {
                    r.ph += r.fw * dt;
                    r.x0 += r.vx * dt;
                    r.vx -= r.vx * 2 * dt;
                    h[0] = r.x0 + Math.sin(r.ph) * r.amp;
                    h[1] += r.fall * (0.5 + 0.7 * Math.abs(Math.cos(r.ph))) * dt;
                }
                // the tail follows the head link by link and hangs a little
                for (let i = 1; i < r.pts.length; i++) {
                    const a = r.pts[i - 1], b = r.pts[i];
                    b[1] = Math.min(-0.5, b[1] + 20 * dt);
                    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
                    if (d > 2.6)
                        (b[0] = a[0] + (dx / d) * 2.6), (b[1] = a[1] + (dy / d) * 2.6);
                }
            }
            ps.update(dt);
            lights.update(dt);
        },
        drawBack(p) {
            ps.draw(p, "back");
        },
        draw(p) {
            const fade = 1 - seg(t, end - 0.45, end - 0.05);
            for (const pp of pixelPOPPERS) {
                const k = kick(t, pp);
                Popper(p, pp.x, pp.y, pp.a, k, pixelC, 1 - seg(t, 2.5, 2.9));
                const ft = t - pp.t;
                if (ft > 0 && ft < 0.12)
                    Sparkle(p, pp.x + Math.cos(pp.a) * 13, pp.y + Math.sin(pp.a) * 13, 7 * (1 - ft / 0.12), pixelWHITE, pixelC[2], 0.7);
            }
            // streamers: a two-tone ribbon that curls along its length
            for (const r of ribbons) {
                const pts = r.pts.map(([x, y], i) => [x + Math.sin(i * r.curl + t * 9 + r.ph) * (i ? 1.6 : 0), y]);
                for (let i = 1; i < pts.length; i++) {
                    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], front = Math.sin(i * r.curl + t * 9 + r.ph) > 0;
                    p.line(x0, y0, x1, y1, front ? r.c : scale(r.c, 0.6), fade);
                    p.line(x0 + 1, y0, x1 + 1, y1, front ? Mix(r.c, pixelWHITE, 0.35) : scale(r.c, 0.45), fade);
                }
            }
            // paper bits: a little card turned by its tilt, its width by its flip; the back side shows darker
            for (const b of bits) {
                if (b.y > 1)
                    continue;
                const fw = b.mode === 2 ? 1 : Math.cos(b.flip), w = Math.max(0.5, Math.abs(fw) * b.w), ca = Math.cos(b.ang), sa = Math.sin(b.ang);
                const c = fw >= 0 ? b.c : scale(b.c, 0.62), a = fade;
                if (b.mode === 2) {
                    p.dot(b.x, b.y, scale(b.c, 0.8), a);
                    p.dot(b.x + 1, b.y, scale(b.c, 0.6), a);
                    continue;
                }
                p.shade(b.x - 4, b.y - 4, b.x + 4, b.y + 4, (x, y, out) => {
                    const dx = x - b.x, dy = y - b.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
                    if (Math.abs(u) > w / 2 + 0.2 || Math.abs(v) > b.h / 2)
                        return;
                    out.a = a;
                    return Math.abs(fw) > 0.92 && v < -b.h / 2 + 1 ? pixelWHITE : c;
                });
                // it catches the light as it turns face-on
                if (Math.abs(fw) > 0.97)
                    p.glow(b.x, b.y, 5, Mix(b.c, pixelWHITE, 0.5), 0.35 * fade);
            }
            ps.draw(p, "front");
            lights.draw(p);
        },
    };
}
