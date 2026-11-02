// Simulated particles, debris and lights, for effects that want real physics: sparks that streak and bounce
// off the floor, shards that tumble and settle, vapour and smoke that swell and thin, lights that flare and die.
// Adapted from Sprite Fusion's open-source pixel art VFX (https://www.spritefusion.com/pixel-art-vfx),
// MIT License, Copyright (c) 2026 Hugo Duprez. Units here are art pixels and seconds; draw through a Painter,
// so effects stay in local space and mirror or rotate like any other.
import { Rng, clamp, pixelTAU } from "./math.js";
import { Hex, scale, Mix, rgb, pixelWHITE } from "./color.js";
export const pixelGRAVITY = 950; // px/s²
const pixelCROSS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const pixelDIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const pixelHOT = ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"].map(Hex);
/** Fire from white-hot to smouldering, and smoke from fresh to thin: the ramps FIRE puffs and SMOKE walk down. */
export const pixelFIRERAMP = ["#ffffff", "#fff3a6", "#ffe26b", "#ffc23d", "#ff8a2a", "#f2561d", "#c9281f", "#8a1f17", "#4a1712"].map(Hex);
export const pixelSMOKERAMP = ["#7b6f72", "#5d5660", "#433d48", "#2b2630", "#1a171e"].map(Hex);
const rampAt = (r, t) => r[Math.min(r.length - 1, Math.max(0, Math.floor(t * r.length)))];
/** Particle kinds. */
export const pixelP = { SPARK: 0, MOTE: 1, STREAK: 2, FLAKE: 3, VAPOUR: 4, DUST: 5, STAR: 6, EMBER: 7, SMOKE: 8, FIRE: 9, BRAND: 10, GRIT: 11 };
/** Particle flags: SMOKES (a FIRE puff leaves smoke when it dies), BIG (bigger, slower smoke), BACK (draw behind). */
export const pixelPF = { SMOKES: 1, BIG: 2, BACK: 4 };
const pixelSOFT = new Set([pixelP.VAPOUR, pixelP.DUST, pixelP.SMOKE]);
/**
 * A particle system. opts: { seed, ground: (x) => floor y (local px; sparks bounce on it), sparks: [head..tail]
 * colors for SPARK, haze: color vapour glows with }.
 * spawn(kind, x, y, vx, vy, life, color, size); update(dt); draw(p, layer): "back" draws the soft kinds
 * (vapour, dust, smoke), "front" the rest, nothing for both.
 */
export class Particles {
    constructor(opts = {}) {
        this.R = opts.rng ?? new Rng(opts.seed ?? 1);
        this.list = [];
        this.t = 0;
        this.ground = opts.ground ?? (() => Infinity);
        this.sparks = (opts.sparks ?? pixelHOT).map(Hex);
        this.haze = opts.haze === undefined ? null : Hex(opts.haze);
        this.onLand = opts.onLand ?? null; // (x, y) when a BRAND hits the floor
    }
    /** delay: seconds before it appears; flag: PF bits. col 0 lets FIRE and SMOKE use their own ramps. */
    spawn(k, x, y, vx, vy, life, col = pixelWHITE, size = 1, delay = 0, flag = 0) {
        this.list.push({ k, x, y, vx, vy, life, max: life, col: col ? Hex(col) : 0, size, seed: this.R.next() * 100, delay, flag });
    }
    get count() {
        return this.list.length;
    }
    update(dt) {
        this.t += dt;
        const pixelR = this.R, t = this.t;
        for (let i = this.list.length - 1; i >= 0; i--) {
            const p = this.list[i];
            if (p.delay > 0) {
                p.delay -= dt;
                continue;
            }
            if ((p.life -= dt) <= 0) {
                if (p.k === pixelP.FIRE && p.flag & pixelPF.SMOKES) {
                    const big = p.flag & pixelPF.BIG;
                    this.spawn(pixelP.SMOKE, p.x, p.y, p.vx * 0.6, p.vy * 0.6 - 6, big ? pixelR.range(1.3, 2.3) : pixelR.range(0.8, 1.4), 0, p.size * (big ? 0.85 : 0.7), 0, big ? pixelPF.BIG : 0);
                }
                this.list.splice(i, 1);
                continue;
            }
            switch (p.k) {
                case pixelP.FIRE:
                    p.vy -= 95 * dt;
                    p.vx += Math.sin(t * 17 + p.seed) * 30 * dt;
                    p.vx -= p.vx * 5 * dt;
                    p.vy -= p.vy * 3.2 * dt;
                    break;
                case pixelP.GRIT: {
                    p.vy += pixelGRAVITY * dt;
                    p.vx -= p.vx * 0.8 * dt;
                    const g = this.ground(p.x), ny = p.y + p.vy * dt;
                    p.x += p.vx * dt;
                    if (p.vy > 0 && p.y <= g && ny >= g) {
                        p.y = g - 0.25;
                        if (p.vy > 130 && pixelR.chance(0.4))
                            (p.vy = -p.vy * 0.25), (p.vx = p.vx * 0.5 + pixelR.range(-10, 10));
                        else
                            (p.vx = p.vy = 0), (p.life = Math.min(p.life, 0.5));
                    }
                    else
                        p.y = ny;
                    continue;
                }
                case pixelP.BRAND: {
                    // a burning chunk: arcs, trails flame, and starts a little fire where it lands
                    p.vy += pixelGRAVITY * 0.8 * dt;
                    p.vx -= p.vx * 0.9 * dt;
                    if (pixelR.chance(0.9 * Math.min(1, dt * 60)))
                        this.spawn(pixelP.FIRE, p.x, p.y, p.vx * 0.1 + pixelR.range(-7, 7), p.vy * 0.1 - 10, pixelR.range(0.16, 0.32), 0, pixelR.range(0.9, 1.7) * (0.5 + (p.life / p.max) * 0.6), 0, pixelR.chance(0.4) ? pixelPF.SMOKES : 0);
                    const g = this.ground(p.x), ny = p.y + p.vy * dt;
                    p.x += p.vx * dt;
                    if (p.vy > 0 && p.y <= g && ny >= g) {
                        this.onLand?.(p.x, g);
                        this.list.splice(i, 1);
                    }
                    else
                        p.y = ny;
                    continue;
                }
                case pixelP.SPARK: {
                    p.vy += pixelGRAVITY * 0.45 * dt;
                    p.vx -= p.vx * 2.2 * dt;
                    p.vy -= p.vy * 2.2 * dt;
                    const g = this.ground(p.x), ny = p.y + p.vy * dt;
                    p.x += p.vx * dt;
                    if (p.vy > 0 && p.y <= g && ny >= g)
                        (p.vy = -p.vy * 0.45), (p.vx *= 0.7), (p.y = g - 0.25);
                    else
                        p.y = ny;
                    continue;
                }
                case pixelP.STREAK:
                    (p.vx += p.vx * 3 * dt), (p.vy += p.vy * 3 * dt);
                    break;
                case pixelP.FLAKE:
                    p.vx -= p.vx * 2.2 * dt;
                    p.vy -= p.vy * 2.2 * dt - 35 * dt;
                    p.x += Math.sin(this.t * 2.5 + p.seed) * 7 * dt;
                    break;
                case pixelP.EMBER:
                    p.vy += (-30 + Math.sin(t * 3 + p.seed) * 20) * dt;
                    p.vx += Math.cos(t * 2.3 + p.seed) * 45 * dt;
                    p.vx -= p.vx * 1.6 * dt;
                    p.vy -= p.vy * 1.6 * dt;
                    break;
                case pixelP.SMOKE: {
                    const big = p.flag & pixelPF.BIG;
                    p.vy -= (big ? 23 : 16) * dt;
                    p.vx += Math.sin(t * 1.3 + p.seed) * 8 * dt;
                    p.vx -= p.vx * 1.6 * dt;
                    p.vy -= p.vy * 1.2 * dt;
                    break;
                }
                case pixelP.MOTE:
                    p.vx -= p.vx * 0.6 * dt;
                    p.vy -= p.vy * 0.6 * dt;
                    break;
                default: {
                    const drag = pixelSOFT.has(p.k) ? 4 : 1.6;
                    p.vx -= p.vx * drag * dt;
                    p.vy -= p.vy * drag * dt + 5 * dt;
                }
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    }
    draw(p, layer) {
        for (const q of this.list) {
            if (q.delay > 0)
                continue;
            if (layer && (pixelSOFT.has(q.k) || q.flag & pixelPF.BACK ? "back" : "front") !== layer)
                continue;
            const k = q.life / q.max, x = q.x, y = q.y, sp = Math.hypot(q.vx, q.vy) || 1, ux = q.vx / sp, uy = q.vy / sp;
            switch (q.k) {
                case pixelP.SPARK: {
                    const pixelS = this.sparks, head = k > 0.6 ? pixelS[0] : k > 0.3 ? pixelS[1] : pixelS[2], len = Math.min(9, 1 + sp * 0.022);
                    p.line(x - ux * len, y - uy * len, x - ux * len * 0.4, y - uy * len * 0.4, k > 0.5 ? head : pixelS[pixelS.length - 1]);
                    p.line(x - ux * len * 0.45, y - uy * len * 0.45, x, y, head);
                    p.glow(x, y, 3, head, 0.45 * k);
                    break;
                }
                case pixelP.MOTE: {
                    const len = Math.min(16, 0.5 + sp * 0.026) * q.size, a = k < 0.35 ? k / 0.35 : 1;
                    p.line(x - ux * len, y - uy * len, x - ux * len * 0.35, y - uy * len * 0.35, scale(q.col, 0.55), a);
                    p.line(x - ux * len * 0.4, y - uy * len * 0.4, x, y, q.col, a);
                    p.glow(x, y, 2.5 + q.size, q.col, 0.4 * k);
                    break;
                }
                case pixelP.STREAK: {
                    const pixelL = clamp(sp / 30, 1, 7);
                    for (let d = pixelL; d >= 0; d -= 0.5)
                        p.dot(x - ux * d, y - uy * d, d < 1 ? pixelWHITE : d < pixelL * 0.5 ? q.col : scale(q.col, 0.6), d < pixelL * 0.5 ? 1 : 1.2 - d / pixelL);
                    p.glow(x, y, 4, q.col, 0.4);
                    break;
                }
                case pixelP.FLAKE: {
                    const a = Math.min(1, k * 3);
                    p.dot(x, y, q.col, a);
                    if (q.size > 1.3)
                        for (const [dx, dy] of pixelCROSS)
                            p.dot(x + dx, y + dy, scale(q.col, 0.8), a * 0.8);
                    break;
                }
                case pixelP.VAPOUR: {
                    const r = q.size * (0.6 + (1 - k) * 0.9);
                    p.disc(x, y, r, q.col, Math.pow(k, 1.3) * 0.45);
                    if (this.haze)
                        p.glow(x, y, r * 1.8, this.haze, 0.16 * k);
                    break;
                }
                case pixelP.DUST:
                    p.disc(x, y, q.size * (0.6 + (1 - k) * 0.9), q.col, Math.pow(k, 1.3) * 0.7);
                    break;
                case pixelP.SMOKE: {
                    // three soft discs: a body, a denser core sitting low, a lit cap while it's young
                    const age = 1 - k, big = q.flag & pixelPF.BIG;
                    const r = q.size * (0.65 + Math.min(1, age * 2.5) * 0.45 + age * (big ? 0.5 : 0.4));
                    const a = Math.min(1, age * 12) * Math.min(1, k * 2.4) * (big ? 0.7 : 0.58);
                    const c = q.col ? Mix(q.col, rampAt(pixelSMOKERAMP, age), age) : rampAt(pixelSMOKERAMP, age * 1.05);
                    p.disc(x, y, r, c, a * 0.45);
                    p.disc(x + r * 0.05, y + r * 0.06, r * 0.74, c, a * 0.62);
                    if (age < 0.5)
                        p.disc(x - r * 0.22, y - r * 0.3, r * 0.5, Mix(c, pixelWHITE, 0.12), a * 0.4 * (1 - age * 2));
                    break;
                }
                case pixelP.FIRE: {
                    // a ball of flame that cools down the ramp as it rises: a darker rim, a lit core, a tongue on top
                    const age = 1 - k, heat = Math.min(0.999, Math.pow(age, 0.62) + (q.seed % 1) * 0.1), pixelF = pixelFIRERAMP, n = pixelF.length;
                    const idx = Math.min(n - 2, Math.floor(heat * (n - 1)));
                    const r = q.size * (0.55 + 0.45 * Math.min(1, age * 7)) * (1 - age * 0.55), c = pixelF[idx];
                    if (idx >= n - 2)
                        p.disc(x, y, r, c, Math.min(1, k * 3) * 0.85);
                    else {
                        p.circle(x, y, r, pixelF[Math.min(n - 1, idx + 2)]);
                        p.circle(x - r * 0.16, y - r * 0.22, r * 0.78, c);
                        if (r > 1.6)
                            p.circle(x, y - r * 0.9, r * 0.42, c);
                        if (idx <= 3 && r > 1.8)
                            p.circle(x - r * 0.28, y - r * 0.34, r * 0.36, pixelF[Math.max(0, idx - 1)]);
                        if (idx < 6)
                            p.glow(x, y, r * 2.4 + 2, c, 0.18 * k);
                    }
                    break;
                }
                case pixelP.BRAND:
                    p.circle(x, y, 1.6, pixelHOT[3]);
                    p.px(x, y, Math.sin(this.t * 40 + q.seed) > 0 ? pixelHOT[0] : pixelHOT[1]);
                    p.px(x + 1, y, pixelHOT[1]);
                    p.glow(x, y, 7, pixelHOT[2], 0.45);
                    break;
                case pixelP.GRIT:
                    if (k > 0.25 || k * 4 > 0.5) {
                        p.px(x, y, q.col);
                        if (q.size >= 2)
                            p.px(x + 1, y, q.col), p.px(x, y + 1, scale(q.col, 0.8)), p.px(x + 1, y + 1, scale(q.col, 0.7));
                    }
                    break;
                case pixelP.EMBER: {
                    const c = k > 0.6 ? this.sparks[0] : k > 0.3 ? this.sparks[1] : this.sparks[2];
                    if (k < 0.25 && Math.sin(this.t * 40 + q.seed) < 0)
                        break;
                    p.px(x, y, c);
                    if (q.size > 1.5)
                        p.px(x, y + 1, this.sparks[this.sparks.length - 1]);
                    p.glow(x, y, 3 + q.size, c, 0.35 * k);
                    break;
                }
                default: {
                    // STAR: a twinkling cross, arms set by size
                    const tw = 0.6 + 0.4 * Math.sin(this.t * (8 + (q.seed % 5)) + q.seed);
                    if (q.size < 1) {
                        if (tw * k > 0.25)
                            p.px(x, y, tw > 0.8 ? pixelWHITE : q.col);
                        p.glow(x, y, 3, q.col, 0.4 * k * tw);
                        break;
                    }
                    Sparkle(p, x, y, q.size * tw * Math.min(1, k * 3), q.col, scale(q.col, 0.75), 0.5 * k * tw);
                }
            }
        }
    }
}
/**
 * Little fires burning where something landed: add(x, y, life, power) feeds FIRE puffs (and the odd ember)
 * into a particle system, fading over its life. update(dt); drawBack(p) adds a hot pixel and a glow at its foot.
 */
export class Blazes {
    constructor(ps) {
        this.ps = ps;
        this.list = [];
    }
    add(x, y, life, power) {
        this.list.push({ x, y, life, max: life, acc: this.ps.R.next(), power });
    }
    get count() {
        return this.list.length;
    }
    update(dt) {
        const ps = this.ps, pixelR = ps.R;
        for (let i = this.list.length - 1; i >= 0; i--) {
            const b = this.list[i];
            if ((b.life -= dt) <= 0) {
                this.list.splice(i, 1);
                continue;
            }
            const k = b.life / b.max, intensity = b.power * (k > 0.7 ? 1 : 0.35 + (k / 0.7) * 0.65);
            for (b.acc += dt * (6 + 16 * intensity); b.acc > 1; b.acc--) {
                const s = pixelR.range(1.2, 2.8) * intensity;
                ps.spawn(pixelP.FIRE, b.x + pixelR.range(-1.5, 1.5), b.y - s * 0.6, pixelR.range(-6, 6), pixelR.range(-30, -12), pixelR.range(0.28, 0.6), 0, s, 0, pixelPF.BACK | (pixelR.chance(0.3) ? pixelPF.SMOKES : 0));
                if (pixelR.chance(0.06))
                    ps.spawn(pixelP.EMBER, b.x, b.y - 1.5, pixelR.range(-15, 15), pixelR.range(-45, -15), pixelR.range(0.6, 1.4), pixelHOT[2], 1, 0, pixelPF.BACK);
            }
        }
    }
    drawBack(p) {
        for (const b of this.list) {
            const k = b.life / b.max;
            p.px(b.x, b.y, k > 0.4 ? (Math.sin(b.life * 31 + b.x) > 0 ? pixelHOT[1] : pixelHOT[2]) : pixelHOT[3]);
            p.glow(b.x, b.y, 6 + 5 * k * b.power, pixelHOT[2], 0.3 * k * b.power);
        }
    }
}
/** Debris kinds. */
export const pixelB = { SHARD: 0, CHUNK: 1, DRIP: 2 };
/**
 * Rigid debris that tumbles, bounces and settles. add({ kind, x, y, vx, vy, a, va, s (size), c (color), ramp
 * (chunk shading, dark to bright), g (gravity scale), drag, bounce, life }); update(dt); draw(p).
 */
export class Bits {
    constructor(opts = {}) {
        this.list = [];
        this.ground = opts.ground ?? (() => Infinity);
    }
    add(b) {
        const life = b.life ?? 1;
        this.list.push({ kind: pixelB.SHARD, vx: 0, vy: 0, a: 0, va: 0, s: 1, c: pixelWHITE, g: 1, drag: 0, bounce: 0, rest: false, ...b, life, max: life });
    }
    get count() {
        return this.list.length;
    }
    update(dt) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const b = this.list[i];
            if ((b.life -= dt) <= 0) {
                this.list.splice(i, 1);
                continue;
            }
            if (b.rest)
                continue;
            b.vy += pixelGRAVITY * b.g * dt;
            b.vx -= b.vx * b.drag * dt;
            b.vy -= b.vy * b.drag * dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.a += b.va * dt;
            const floor = this.ground(b.x), sp = b.vy;
            if (b.g <= 0 || b.y < floor || sp <= 0)
                continue;
            b.y = floor - 0.01;
            if (b.kind === pixelB.DRIP)
                b.life = 0;
            else if (b.bounce > 0 && sp > 70)
                (b.vy = -sp * b.bounce), (b.vx *= 0.7), (b.va *= 0.6);
            else
                (b.rest = true), (b.vx = b.vy = 0);
        }
    }
    draw(p) {
        for (const b of this.list) {
            const a = Math.min(1, b.life / 0.4), ca = Math.cos(b.a), sa = Math.sin(b.a);
            if (b.kind === pixelB.SHARD) {
                for (let d = -b.s / 2; d <= b.s / 2; d += 0.5)
                    p.dot(b.x + ca * d, b.y + sa * d, d > b.s / 2 - 0.6 ? pixelWHITE : Hex(b.c), a);
            }
            else if (b.kind === pixelB.DRIP) {
                p.dot(b.x, b.y, Hex(b.c), a);
                p.dot(b.x, b.y - 1, Hex(b.c), a * 0.5);
            }
            else {
                // a shaded chunk: lit top-left, dark bottom-right, a dark rim
                const pixelR = (b.ramp ?? ["#1c2030", "#3a4a66", "#6e86a8", "#a8c0dc", "#e8f2ff"]).map(Hex), n = pixelR.length;
                const x = Math.round(b.x), y = Math.round(b.y), r = Math.ceil(b.s) + 1;
                for (let py = -r; py <= r; py++)
                    for (let px = -r; px <= r; px++) {
                        const u = (px + 0.5) * ca + (py + 0.5) * sa, v = -(px + 0.5) * sa + (py + 0.5) * ca;
                        const d = Math.abs(u) / b.s + Math.abs(v) / (b.s * 0.62);
                        if (d > 1.3)
                            continue;
                        p.dot(x + px, y + py, d > 1 ? pixelR[0] : v < 0 ? (u < 0 ? pixelR[n - 1] : pixelR[n - 2]) : u < 0 ? pixelR[n - 3] : pixelR[Math.max(1, n - 4)], a);
                    }
            }
        }
    }
}
/** Lights that flare and die: add(x, y, r, color, k, life); update(dt); draw(p). */
export class Lights {
    constructor() {
        this.list = [];
    }
    add(x, y, r, color, k, life) {
        this.list.push({ x, y, r, color: Hex(color), k, life, max: life });
    }
    update(dt) {
        for (let i = this.list.length - 1; i >= 0; i--)
            if ((this.list[i].life -= dt) <= 0)
                this.list.splice(i, 1);
    }
    draw(p) {
        for (const l of this.list) {
            const k = l.life / l.max;
            p.glow(l.x, l.y, l.r * (0.55 + 0.45 * k), l.color, l.k * k * k);
        }
    }
}
/** A star glint: arms of length arm in color c with tips in tip, a white heart, light. */
export function Sparkle(p, x, y, arm, c, tip = c, k = 0.6) {
    const n = Math.round(arm);
    if (n < 1)
        return;
    const pixelX = Math.floor(x), pixelY = Math.floor(y);
    for (let d = 1; d <= n; d++) {
        const cc = d > n * 0.6 ? tip : c;
        for (const [dx, dy] of pixelCROSS)
            p.px(pixelX + dx * d, pixelY + dy * d, cc);
    }
    if (n >= 3)
        for (const [dx, dy] of pixelDIAG)
            p.px(pixelX + dx, pixelY + dy, c);
    if (n >= 6)
        for (const [dx, dy] of pixelDIAG)
            p.px(pixelX + dx * 2, pixelY + dy * 2, tip);
    p.px(pixelX, pixelY, pixelWHITE);
    p.glow(x, y, 4 + n * 2, c, k);
}
/** An 8-ray flare: long rays on the axes, shorter between, fading out along their length. ramp dark to bright. */
export function Flare(p, x, y, pixelL, k, ramp) {
    if (pixelL < 1)
        return;
    const pixelR = ramp.map(Hex), n = pixelR.length;
    for (let i = 0; i < 8; i++) {
        const an = (i * Math.PI) / 4, len = i % 4 === 0 ? pixelL : i % 2 === 0 ? pixelL * 0.6 : pixelL * 0.3, ca = Math.cos(an), sa = Math.sin(an);
        for (let d = 0; d <= len; d += 0.5) {
            const u = d / len;
            p.dot(x + ca * d, y + sa * d, u < 0.35 ? pixelWHITE : u < 0.7 ? pixelR[n - 2] : pixelR[n - 3], u < 0.6 ? 1 : k * 1.5 * (1 - u) + 0.2);
        }
    }
}
/**
 * A ring on a tilted plane (sy squashes it: 0.16 lies on the floor, 1 stands up), thickness th inward, alpha k,
 * colored by depth through the band with ramp (dark to bright). keep(angle) picks which part to draw, so the
 * far half can go behind things and the near half in front: (g) => Math.sin(g) < 0 is the far half.
 */
export function Band(p, cx, cy, r, sy, th, k, ramp, keep = () => true, hot = false) {
    if (r <= 0 || k <= 0)
        return;
    const pixelR = ramp.map(Hex), n = pixelR.length;
    for (let j = 0, m = Math.ceil(r * pixelTAU * 1.2); j < m; j++) {
        const ang = (j / m) * pixelTAU, ca = Math.cos(ang), sa = Math.sin(ang);
        if (!keep(ang))
            continue;
        for (let o = th; o >= 0; o -= 0.5) {
            const u = o / th, c = u < 0.15 ? (hot ? pixelWHITE : pixelR[n - 1]) : u < 0.4 ? pixelR[n - 2] : u < 0.7 ? pixelR[n - 3] : pixelR[n - 4];
            p.dot(cx + ca * (r - o), cy + sa * (r - o) * sy, c, k * (u < 0.4 ? 1.2 : 1.15 - u));
        }
    }
}
/**
 * A faceted crystal spike standing on (x, base), height h, base width w, leaning lean px at the tip, shaded in
 * ramp (dark to bright, 6+ steps): a lit ridge, a bright left face, a darker right face, a dark rim.
 * opts: { a (alpha), white (flash it white), glint (0..1 height of a sweeping highlight, or -1) }.
 */
export function Crystal(p, x, base, h, w, lean, ramp, opts = {}) {
    if (h < 1.5)
        return;
    const pixelR = ramp.map(Hex), n = pixelR.length, pixelC = (i) => pixelR[Math.max(0, n - 1 - i)];
    const a = opts.a ?? 1, top = base - h, ridge0 = x - w * 0.14, glint = opts.glint ?? -1;
    const inside = (px, py) => {
        const u = (base - (py + 0.5)) / h;
        return u >= 0 && u <= 1 && Math.abs(px + 0.5 - (x + lean * u)) <= (w / 2) * (1 - u) + 0.35;
    };
    for (let py = Math.floor(top) - 1; py < Math.ceil(base); py++)
        for (let px = Math.floor(x - w / 2 - Math.abs(lean) - 2); px <= Math.ceil(x + w / 2 + Math.abs(lean) + 2); px++) {
            if (!inside(px, py)) {
                if (inside(px - 1, py) || inside(px + 1, py) || inside(px, py + 1) || (inside(px, py - 1) && py < base - 1))
                    p.dot(px, py, pixelR[0], a);
                continue;
            }
            if (opts.white) {
                p.dot(px, py, pixelWHITE, a);
                continue;
            }
            const u = (base - (py + 0.5)) / h, rx = ridge0 + (x + lean - ridge0) * u, c = x + lean * u, hw = (w / 2) * (1 - u) + 0.35, fx = px + 0.5;
            let col = u > 0.9 ? pixelWHITE : Math.abs(fx - rx) < 0.55 ? pixelC(1)
                : fx < rx ? (fx - (c - hw) < 1 ? pixelC(1) : (fx - (c - hw)) / Math.max(1, rx - (c - hw)) > 0.55 ? pixelC(2) : pixelC(3))
                    : c + hw - fx < 1.2 ? pixelC(Math.min(n - 2, 6)) : (fx - rx) / Math.max(1, c + hw - rx) > 0.5 ? pixelC(5) : pixelC(4);
            if (glint >= 0 && fx <= rx + 0.6) {
                const g = Math.abs(u - glint);
                if (g < 0.05)
                    col = pixelWHITE;
                else if (g < 0.1)
                    col = pixelC(1);
            }
            p.dot(px, py, col, a);
        }
}
