// Pseudo-3D pixel renderer in the style of jakesgordon/javascript-racer:
// the road is cut into short segments that are projected and filled back to
// front, and everything upright is a scaled sprite. It draws into a small 2D
// canvas that CSS scales up with nearest-neighbour pixels.
import spriteSheetData from '../sprites/driving-sprites.json';
import {
  CalculateRearviewCameraPose,
  CreatePixelCamera,
  ProjectPixelPoint,
  SelectVehicleSpriteView,
  type PixelCamera,
  type PixelCameraPose,
  type RearviewMirrorId,
} from './pixelCamera';
import { CalculateCockpitLayout, DrawLeftHandDriveCockpit, type CockpitLayout, type CockpitState } from './pixelCockpit';
import { LoadSpriteAtlasImage, SpriteAtlas, type SpriteSheet } from './spriteAtlas';
import { TrafficLightSpriteName, type TrafficLampState } from './spriteNames';
import type { BuildingShape, GroundShape, PixelWorld, PropShape, WallFace } from './pixelWorld';

export interface PixelVehicle {
  x: number;
  z: number;
  heading: number;
  // Frame name without the view, such as car/sedan/blue or scooter/red.
  sprite: string;
}

export interface PixelScene {
  world: PixelWorld;
  vehicles: PixelVehicle[];
  signals: TrafficLampState[];
  player: { x: number; z: number; heading: number } | null;
}

export interface PixelFog {
  near: number;
  far: number;
}

export interface TopOverlay {
  left: number;
  right: number;
  bottom: number;
}

export interface PixelFrame {
  pose: PixelCameraPose;
  vehicle: { x: number; z: number; heading: number };
  firstPerson: boolean;
  drawDistance: number;
  fog: PixelFog;
  cockpit: CockpitState;
  updateMirrors: boolean;
}

interface ViewOptions {
  drawDistance: number;
  fog: PixelFog;
  mirror?: RearviewMirrorId;
}

interface DepthItem {
  depth: number;
  draw: () => void;
}

const fogColor = 0xcbd7d9;
const fogCss = '#cbd7d9';
const skyTop = '#5f9ed0';
const skyMiddle = '#a8d3e5';
const lotColor = 0x8d957f;
const mirrorDrawDistance = 110;
const lampColors: Record<TrafficLampState, string> = { red: '#ff4a3a', yellow: '#ffc83a', green: '#3cf08c' };
const lampDrops: Record<TrafficLampState, number> = { red: 0.385, yellow: 0.78, green: 1.17 };
const trafficLightHeight = 4.8;

function Clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function SmoothStep(edge0: number, edge1: number, value: number) {
  const t = Clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Small fixed canvas size for the given CSS size: each game pixel covers a
// whole number of device pixels, with about `budget` game pixels in total.
export function CalculatePixelCanvasSize(cssWidth: number, cssHeight: number, pixelRatio: number, budget: number) {
  const deviceWidth = Math.max(1, cssWidth * pixelRatio);
  const deviceHeight = Math.max(1, cssHeight * pixelRatio);
  const scale = Math.max(1, Math.round(Math.sqrt((deviceWidth * deviceHeight) / budget)));
  return { width: Math.max(1, Math.round(deviceWidth / scale)), height: Math.max(1, Math.round(deviceHeight / scale)) };
}

export class PixelDrivingRenderer {
  readonly domElement: HTMLCanvasElement;
  readonly ready: Promise<void>;
  width = 1;
  height = 1;
  private readonly context: CanvasRenderingContext2D;
  private pixelRatio = 1;
  private atlas: SpriteAtlas | null = null;
  private atlasImage: HTMLImageElement | null = null;
  private wheelImage: HTMLImageElement | null = null;
  private layout: CockpitLayout | null = null;
  private cssWidth = 1;
  private cssHeight = 1;
  private topOverlay: TopOverlay | null = null;
  private readonly mirrors: Partial<Record<RearviewMirrorId, { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }>> = {};
  private readonly fogStyles = new Map<number, string>();
  private disposed = false;
  mirrorVehicleCount = 0;

  constructor(private readonly options: { pixelBudget: number; spriteUrl: string; wheelUrl: string }) {
    const canvas = document.createElement('canvas');
    canvas.dataset.drivingView = 'main';
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('2D canvas is unavailable.');
    Object.assign(canvas.style, {
      width: '100%',
      height: '100%',
      display: 'block',
    });
    canvas.style.imageRendering = 'pixelated';
    this.domElement = canvas;
    this.context = context;
    this.context.imageSmoothingEnabled = false;
    this.ready = Promise.all([
      LoadSpriteAtlasImage(options.spriteUrl).then(image => {
        this.atlasImage = image;
        this.atlas = new SpriteAtlas(image, spriteSheetData as SpriteSheet, fogCss);
      }),
      LoadSpriteAtlasImage(options.wheelUrl).then(image => { this.wheelImage = image; }, () => { this.wheelImage = null; }),
    ]).then(() => undefined);
  }

  // DrivingViewportController calls these with CSS sizes.
  setPixelRatio(value: number) {
    this.pixelRatio = value;
  }

  setSize(cssWidth: number, cssHeight: number) {
    const size = CalculatePixelCanvasSize(cssWidth, cssHeight, this.pixelRatio, this.options.pixelBudget);
    this.cssWidth = Math.max(1, cssWidth);
    this.cssHeight = Math.max(1, cssHeight);
    if (size.width === this.width && size.height === this.height && this.layout) return;
    this.width = size.width;
    this.height = size.height;
    this.domElement.width = size.width;
    this.domElement.height = size.height;
    this.domElement.dataset.drivingPixels = `${size.width}x${size.height}`;
    this.context.imageSmoothingEnabled = false;
    this.updateLayout();
  }

  // The status panel at the top of the page, in CSS pixels. When it would
  // cover the interior mirror, the mirror hangs below it instead.
  setTopOverlay(overlay: TopOverlay | null) {
    const same = overlay && this.topOverlay
      && overlay.left === this.topOverlay.left && overlay.right === this.topOverlay.right && overlay.bottom === this.topOverlay.bottom;
    if (same || overlay === this.topOverlay) return;
    this.topOverlay = overlay;
    if (this.layout) this.updateLayout();
  }

  private updateLayout() {
    const scaleX = this.width / this.cssWidth;
    const scaleY = this.height / this.cssHeight;
    let layout = CalculateCockpitLayout(this.width, this.height);
    const overlay = this.topOverlay;
    const mirror = layout.mirrors.center;
    if (overlay && overlay.left * scaleX < mirror.x + mirror.w && overlay.right * scaleX > mirror.x && (overlay.bottom + 2) * scaleY > mirror.y) {
      layout = CalculateCockpitLayout(this.width, this.height, (overlay.bottom + 2) * scaleY);
    }
    this.layout = layout;
    this.domElement.dataset.drivingMirrorTop = String(layout.mirrors.center.y);
    for (const id of ['center', 'left', 'right'] as const) {
      const rect = this.layout.mirrors[id];
      const canvas = document.createElement('canvas');
      canvas.width = rect.w;
      canvas.height = rect.h;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) continue;
      context.imageSmoothingEnabled = false;
      this.mirrors[id] = { canvas, context };
    }
  }

  setRenderTarget() {}

  setScissorTest() {}

  render(scene: PixelScene, frame: PixelFrame) {
    if (this.disposed || !this.layout) return;
    const camera = CreatePixelCamera({ ...frame.pose, width: this.width, height: this.height });
    this.drawView(this.context, camera, scene, { drawDistance: frame.drawDistance, fog: frame.fog });
    if (!frame.firstPerson) return;
    if (frame.updateMirrors) {
      let vehicles = 0;
      for (const id of ['center', 'left', 'right'] as const) {
        const mirror = this.mirrors[id];
        if (!mirror) continue;
        const pose = CalculateRearviewCameraPose({ vehicleX: frame.vehicle.x, vehicleZ: frame.vehicle.z, vehicleHeading: frame.vehicle.heading, mirror: id });
        const mirrorCamera = CreatePixelCamera({ ...pose, width: mirror.canvas.width, height: mirror.canvas.height, mirrored: true });
        vehicles += this.drawView(mirror.context, mirrorCamera, scene, { drawDistance: mirrorDrawDistance, fog: frame.fog, mirror: id });
      }
      this.mirrorVehicleCount = vehicles;
    }
    DrawLeftHandDriveCockpit(this.context, this.layout, { ...frame.cockpit, wheelImage: this.wheelImage }, {
      center: this.mirrors.center?.canvas ?? null,
      left: this.mirrors.left?.canvas ?? null,
      right: this.mirrors.right?.canvas ?? null,
    });
  }

  dispose() {
    this.disposed = true;
    this.atlas?.dispose();
    this.atlas = null;
    this.domElement.remove();
  }

  private fogStyle(color: number, amount: number) {
    const level = Math.round(Clamp(amount, 0, 1) * 16);
    const key = color * 32 + level;
    let style = this.fogStyles.get(key);
    if (!style) {
      const t = level / 16;
      const mix = (shift: number) => Math.round(((color >> shift) & 255) * (1 - t) + ((fogColor >> shift) & 255) * t);
      style = `rgb(${mix(16)},${mix(8)},${mix(0)})`;
      this.fogStyles.set(key, style);
    }
    return style;
  }

  private fogAmount(distance: number, options: ViewOptions) {
    const linear = Clamp((distance - options.fog.near) / Math.max(1, options.fog.far - options.fog.near), 0, 1);
    return Math.max(linear, SmoothStep(options.drawDistance * 0.7, options.drawDistance, distance));
  }

  // Returns how many traffic vehicles were drawn in the view.
  private drawView(context: CanvasRenderingContext2D, camera: PixelCamera, scene: PixelScene, options: ViewOptions): number {
    const horizon = this.drawSky(context, camera);
    this.drawGroundFill(context, camera, horizon, options);
    for (const shape of scene.world.ground) this.drawGround(context, camera, shape, options);

    const items: DepthItem[] = [];
    for (const building of scene.world.buildings) this.collectBuilding(items, context, camera, building, options);
    for (const prop of scene.world.props) this.collectProp(items, context, camera, prop, scene, options);
    let vehicles = 0;
    for (const vehicle of scene.vehicles) {
      const view = SelectVehicleSpriteView(camera.x, camera.z, vehicle.x, vehicle.z, vehicle.heading);
      const item = this.collectSprite(items, context, camera, vehicle.x, vehicle.z, `${vehicle.sprite}/${view.index}`, view.mirrored, options);
      if (item) vehicles += 1;
    }
    if (scene.player && !options.mirror) this.collectSprite(items, context, camera, scene.player.x, scene.player.z, 'player/rear', false, options);
    items.sort((left, right) => right.depth - left.depth);
    for (const item of items) item.draw();
    if (options.mirror === 'left' || options.mirror === 'right') {
      // The edge of the player's own car shows on the inside of each door mirror.
      context.fillStyle = '#244f9e';
      const bodyWidth = Math.max(2, Math.round(camera.width * 0.16));
      context.fillRect(options.mirror === 'left' ? camera.width - bodyWidth : 0, Math.round(camera.height * 0.45), bodyWidth, camera.height);
    }
    return vehicles;
  }

  private drawSky(context: CanvasRenderingContext2D, camera: PixelCamera) {
    const horizontal = Math.hypot(camera.forwardX, camera.forwardZ) || 1;
    const far = ProjectPixelPoint(camera, camera.x + (camera.forwardX / horizontal) * 5000, camera.y, camera.z + (camera.forwardZ / horizontal) * 5000);
    const horizon = Clamp(far ? far.y : camera.height / 2, 0, camera.height);
    const gradient = context.createLinearGradient(0, 0, 0, Math.max(1, horizon));
    gradient.addColorStop(0, skyTop);
    gradient.addColorStop(0.55, skyMiddle);
    gradient.addColorStop(1, fogCss);
    context.fillStyle = gradient;
    context.fillRect(0, 0, camera.width, Math.ceil(horizon) + 1);
    const skyline = this.atlas?.source('skyline', 0.35);
    if (skyline && this.atlasImage) {
      const height = Math.max(4, Math.round(camera.height * 0.17));
      const width = Math.max(8, Math.round((skyline.w / skyline.h) * height));
      const yaw = Math.atan2(camera.forwardX, -camera.forwardZ);
      let offset = ((yaw / (Math.PI * 2)) * width * 3) % width;
      if (camera.mirrored) offset = -offset;
      offset = ((offset % width) + width) % width;
      for (let x = -offset; x < camera.width; x += width) {
        context.drawImage(skyline.image, skyline.x, skyline.y, skyline.w, skyline.h, Math.round(x), Math.round(horizon - height + 1), width, height);
      }
    }
    return horizon;
  }

  // Open ground between the roads, fading into the fog towards the horizon.
  private drawGroundFill(context: CanvasRenderingContext2D, camera: PixelCamera, horizon: number, options: ViewOptions) {
    const top = Math.floor(horizon);
    const groundAt = (distance: number) => horizon + (camera.y * camera.focal) / distance;
    const nearDistance = 30;
    const bottom = Math.max(top + 1, groundAt(nearDistance));
    const gradient = context.createLinearGradient(0, top, 0, bottom);
    for (const fraction of [1, 0.85, 0.7, 0.5, 0.3]) {
      const distance = Math.max(nearDistance, options.drawDistance * fraction);
      const stop = Clamp((groundAt(distance) - top) / (bottom - top), 0, 1);
      gradient.addColorStop(stop, this.fogStyle(lotColor, this.fogAmount(distance, options)));
    }
    gradient.addColorStop(1, this.fogStyle(lotColor, this.fogAmount(nearDistance, options)));
    context.fillStyle = gradient;
    context.fillRect(0, top, camera.width, camera.height - top);
  }

  private drawGround(context: CanvasRenderingContext2D, camera: PixelCamera, shape: GroundShape, options: ViewOptions) {
    const dx = shape.x - camera.x;
    const dz = shape.z - camera.z;
    const distance = Math.hypot(dx, dz);
    if (distance - shape.radius > options.drawDistance) return;
    if (dx * camera.forwardX + dz * camera.forwardZ < -shape.radius) return;
    const projected = this.projectGroundPolygon(camera, shape.points);
    if (!projected) return;
    context.fillStyle = this.fogStyle(shape.color, this.fogAmount(distance, options));
    context.beginPath();
    for (let index = 0; index < projected.length; index += 2) {
      if (index === 0) context.moveTo(projected[index], projected[index + 1]);
      else context.lineTo(projected[index], projected[index + 1]);
    }
    context.closePath();
    context.fill();
  }

  // Clips a ground polygon (y = 0) against the near plane and projects it.
  private projectGroundPolygon(camera: PixelCamera, points: GroundShape['points']): number[] | null {
    const cameraSpace: Array<[number, number, number]> = points.map(point => {
      const dx = point.x - camera.x;
      const dy = -camera.y;
      const dz = point.z - camera.z;
      return [
        dx * camera.rightX + dz * camera.rightZ,
        dx * camera.upX + dy * camera.upY + dz * camera.upZ,
        dx * camera.forwardX + dy * camera.forwardY + dz * camera.forwardZ,
      ];
    });
    const near = camera.near;
    const clipped: Array<[number, number, number]> = [];
    for (let index = 0; index < cameraSpace.length; index += 1) {
      const current = cameraSpace[index];
      const next = cameraSpace[(index + 1) % cameraSpace.length];
      const currentInside = current[2] >= near;
      const nextInside = next[2] >= near;
      if (currentInside) clipped.push(current);
      if (currentInside !== nextInside) {
        const t = (near - current[2]) / (next[2] - current[2]);
        clipped.push([current[0] + (next[0] - current[0]) * t, current[1] + (next[1] - current[1]) * t, near]);
      }
    }
    if (clipped.length < 3) return null;
    const output: number[] = [];
    let anyVisible = false;
    for (const [side, lift, depth] of clipped) {
      let x = camera.centerX + (side * camera.focal) / depth;
      if (camera.mirrored) x = camera.width - x;
      const y = camera.centerY - (lift * camera.focal) / depth;
      if (x > -2 && x < camera.width + 2 && y > -2 && y < camera.height + 2) anyVisible = true;
      output.push(x, y);
    }
    if (!anyVisible) {
      // A huge polygon can cover the view with every corner off screen.
      const xs = output.filter((_, index) => index % 2 === 0);
      const ys = output.filter((_, index) => index % 2 === 1);
      if (Math.max(...xs) < 0 || Math.min(...xs) > camera.width || Math.max(...ys) < 0 || Math.min(...ys) > camera.height) return null;
    }
    return output;
  }

  private collectBuilding(items: DepthItem[], context: CanvasRenderingContext2D, camera: PixelCamera, building: BuildingShape, options: ViewOptions) {
    const dx = building.x - camera.x;
    const dz = building.z - camera.z;
    const distance = Math.hypot(dx, dz);
    if (distance - building.radius > options.drawDistance) return;
    if (dx * camera.forwardX + dz * camera.forwardZ < -building.radius) return;
    const fog = this.fogAmount(distance, options);
    for (const face of building.faces) {
      const midX = (face.ax + face.bx) / 2;
      const midZ = (face.az + face.bz) / 2;
      if ((camera.x - midX) * face.normalX + (camera.z - midZ) * face.normalZ <= 0) continue;
      const depth = (midX - camera.x) * camera.forwardX + (midZ - camera.z) * camera.forwardZ;
      items.push({ depth, draw: () => this.drawWall(context, camera, face, building.height, fog) });
    }
  }

  // Draws a textured wall one screen column at a time with perspective-correct
  // texture lookup, then darkens it for shade and fog.
  private drawWall(context: CanvasRenderingContext2D, camera: PixelCamera, face: WallFace, height: number, fog: number) {
    const frame = this.atlas?.frame(face.frame);
    const toCamera = (x: number, y: number, z: number) => {
      const dx = x - camera.x;
      const dy = y - camera.y;
      const dz = z - camera.z;
      return {
        side: dx * camera.rightX + dz * camera.rightZ,
        lift: dx * camera.upX + dy * camera.upY + dz * camera.upZ,
        depth: dx * camera.forwardX + dy * camera.forwardY + dz * camera.forwardZ,
      };
    };
    const a = toCamera(face.ax, 0, face.az);
    const b = toCamera(face.bx, 0, face.bz);
    const near = camera.near + 0.05;
    let t0 = 0;
    let t1 = 1;
    if (a.depth < near && b.depth < near) return;
    if (a.depth < near) t0 = (near - a.depth) / (b.depth - a.depth);
    if (b.depth < near) t1 = (near - a.depth) / (b.depth - a.depth);
    const at = (t: number, y: number) => {
      const side = a.side + (b.side - a.side) * t;
      const depth = a.depth + (b.depth - a.depth) * t + y * camera.forwardY;
      const lift = a.lift + (b.lift - a.lift) * t + y * camera.upY;
      let x = camera.centerX + (side * camera.focal) / depth;
      if (camera.mirrored) x = camera.width - x;
      return { x, y: camera.centerY - (lift * camera.focal) / depth };
    };
    const start = at(t0, 0);
    const end = at(t1, 0);
    const left = Math.max(0, Math.floor(Math.min(start.x, end.x)));
    const right = Math.min(camera.width, Math.ceil(Math.max(start.x, end.x)));
    if (right <= left) return;
    const step = Math.max(1, Math.ceil((right - left) / 160));
    const dSide = b.side - a.side;
    const dDepth = b.depth - a.depth;
    // The texture spans the whole face width. A wall lower than the texture
    // shows its bottom rows (the shopfront); a taller one stretches it.
    let sourceTop = 0;
    let sourceHeight = 0;
    if (frame) {
      const textureHeight = (frame.h / frame.w) * Math.hypot(face.bx - face.ax, face.bz - face.az);
      sourceHeight = Math.max(1, Math.round(frame.h * Math.min(1, height / textureHeight)));
      sourceTop = frame.y + frame.h - sourceHeight;
    }
    for (let x = left; x < right; x += step) {
      const screenX = (camera.mirrored ? camera.width - (x + step / 2) : x + step / 2);
      const s = (screenX - camera.centerX) / camera.focal;
      const denominator = dSide - s * dDepth;
      if (Math.abs(denominator) < 1e-9) continue;
      const t = Clamp((s * a.depth - a.side) / denominator, t0, t1);
      const bottom = at(t, 0).y;
      const top = at(t, height).y;
      if (bottom < 0 || top > camera.height) continue;
      if (frame && this.atlasImage) {
        // Seen from outside, the face runs from b on the left to a on the right.
        const u = Math.min(frame.w - 1, Math.floor((1 - t) * frame.w));
        context.drawImage(this.atlasImage, frame.x + u, sourceTop, 1, sourceHeight, x, Math.round(top), step, Math.round(bottom) - Math.round(top));
      } else {
        context.fillStyle = '#9aa3ab';
        context.fillRect(x, Math.round(top), step, Math.round(bottom) - Math.round(top));
      }
    }
    const corners = [at(t0, 0), at(t1, 0), at(t1, height), at(t0, height)];
    const overlay = (style: string, alpha: number) => {
      if (alpha <= 0.01) return;
      context.globalAlpha = alpha;
      context.fillStyle = style;
      context.beginPath();
      corners.forEach((corner, index) => (index === 0 ? context.moveTo(corner.x, corner.y) : context.lineTo(corner.x, corner.y)));
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    };
    overlay('#000', face.shade);
    overlay(fogCss, fog);
  }

  private collectProp(items: DepthItem[], context: CanvasRenderingContext2D, camera: PixelCamera, prop: PropShape, scene: PixelScene, options: ViewOptions) {
    if (prop.canvas) {
      const canvas = prop.canvas;
      const ppm = prop.canvasPpm ?? 10;
      const projected = this.projectUpright(camera, prop.x, prop.z, options);
      if (!projected) return;
      const scale = camera.focal / projected.depth / ppm;
      const width = Math.round(canvas.width * scale);
      const height = Math.round(canvas.height * scale);
      if (width < 1 || height < 1) return;
      items.push({
        depth: projected.depth,
        draw: () => {
          context.globalAlpha = 1 - projected.fog * 0.8;
          context.drawImage(canvas, Math.round(projected.x - width / 2), Math.round(projected.y - height), width, height);
          context.globalAlpha = 1;
        },
      });
      return;
    }
    if (prop.signal !== undefined) {
      const state = scene.signals[prop.signal] ?? 'red';
      const item = this.collectSprite(items, context, camera, prop.x, prop.z, TrafficLightSpriteName(state), false, options);
      if (!item) return;
      const baseDraw = item.draw;
      item.draw = () => {
        baseDraw();
        // A glow over the lit lamp keeps the signal readable at a distance.
        const scale = camera.focal / item.depth;
        const radius = Math.max(1, Math.round(0.2 * scale));
        const y = item.screenY - (trafficLightHeight - lampDrops[state]) * scale;
        context.fillStyle = lampColors[state];
        context.fillRect(Math.round(item.screenX - radius), Math.round(y - radius), radius * 2, radius * 2);
      };
      return;
    }
    if (prop.frame) this.collectSprite(items, context, camera, prop.x, prop.z, prop.frame, prop.mirrored ?? false, options);
  }

  private projectUpright(camera: PixelCamera, x: number, z: number, options: ViewOptions) {
    const distance = Math.hypot(x - camera.x, z - camera.z);
    if (distance > options.drawDistance) return null;
    const point = ProjectPixelPoint(camera, x, 0, z);
    if (!point || point.depth < 0.6) return null;
    return { ...point, fog: this.fogAmount(distance, options) };
  }

  private collectSprite(items: DepthItem[], context: CanvasRenderingContext2D, camera: PixelCamera, x: number, z: number, name: string, mirrored: boolean, options: ViewOptions): (DepthItem & { screenX: number; screenY: number }) | null {
    if (!this.atlas) return null;
    const projected = this.projectUpright(camera, x, z, options);
    if (!projected) return null;
    const source = this.atlas.source(name, projected.fog);
    if (!source) return null;
    const { frame } = source;
    const scale = camera.focal / projected.depth / frame.ppm;
    const width = Math.round(frame.w * scale);
    const height = Math.round(frame.h * scale);
    if (width < 1 || height < 1) return null;
    const flip = mirrored !== camera.mirrored;
    const anchorX = flip ? frame.w - frame.ax : frame.ax;
    const left = Math.round(projected.x - anchorX * scale);
    const top = Math.round(projected.y - frame.ay * scale);
    if (left > camera.width || left + width < 0 || top > camera.height || top + height < 0) return null;
    const item = {
      depth: projected.depth,
      screenX: projected.x,
      screenY: projected.y,
      draw: () => {
        if (flip) {
          context.save();
          context.translate(left + width, top);
          context.scale(-1, 1);
          context.drawImage(source.image, source.x, source.y, source.w, source.h, 0, 0, width, height);
          context.restore();
        } else {
          context.drawImage(source.image, source.x, source.y, source.w, source.h, left, top, width, height);
        }
      },
    };
    items.push(item);
    return item;
  }
}
