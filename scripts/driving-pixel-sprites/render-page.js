// Browser half of build.mjs. Loads the Kenney CC0 kits with three.js, renders
// fixed orthographic views, and turns each view into pixel art.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as CloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const superSample = 4;
const atlasWidth = 1024;
const vehicleViewAngles = [0, 45, 90, 135, 180];
const vehicleElevation = 7;
const paint = { white: '#e9edf0', blue: '#2563eb', red: '#e0403a', amber: '#f0a020', green: '#2fa85a', navy: '#24324a' };
const scooterPaint = { white: '#e9edf0', blue: '#3b82f6', red: '#e0403a', amber: '#f0a020', green: '#2fa85a', navy: '#3a4a66' };
const carKit = 'car-kit/Models/GLB format/';
const commercialKit = 'city-kit-commercial/Models/GLB format/';
const roadsKit = 'city-kit-roads/Models/GLB format/';
const natureKit = 'nature-kit/Models/GLTF format/';
const charactersKit = 'mini-characters/Models/GLB format/';

const loader = new GLTFLoader();
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(1);
const cache = new Map();

window.spriteBuild = location.search.includes('debug') ? BuildDebug() : BuildAtlas();

// ?debug renders a few frames for checking paint, lamps and the scooter rider.
async function BuildDebug() {
  const frames = [];
  frames.push({ name: 'debug/sedan-blue', ...RenderSprite(await LoadVehicle(carKit + 'sedan.glb', 4.5, paint.blue), { yaw: 45, elevation: vehicleElevation, ppm: 18 }) });
  for (const state of ['red', 'yellow', 'green']) {
    frames.push({ name: `debug/light-${state}`, ...RenderSprite(await LoadTrafficLight(state), { yaw: 270, elevation: 3, ppm: 24 }) });
  }
  const scooter = await BuildScooter(scooterPaint.red, 'character-male-a.glb');
  for (const yaw of vehicleViewAngles) frames.push({ name: `debug/scooter-${yaw}`, ...RenderSprite(scooter, { yaw, elevation: vehicleElevation, ppm: 18 }) });
  return PackAtlas(frames);
}

async function BuildAtlas() {
  const frames = [];
  for (const model of [
    { id: 'sedan', file: 'sedan.glb', length: 4.5 },
    { id: 'hatchback', file: 'hatchback-sports.glb', length: 4.3 },
    { id: 'suv', file: 'suv.glb', length: 4.6 },
    { id: 'van', file: 'van.glb', length: 4.7 },
  ]) {
    for (const [color, hex] of Object.entries(paint)) {
      const car = await LoadVehicle(carKit + model.file, model.length, hex);
      for (const [index, angle] of vehicleViewAngles.entries()) {
        frames.push({ name: `car/${model.id}/${color}/${index}`, ...RenderSprite(car, { yaw: angle, elevation: vehicleElevation, ppm: 18 }) });
      }
    }
  }
  const taxi = await LoadVehicle(carKit + 'taxi.glb', 4.5, null);
  for (const [index, angle] of vehicleViewAngles.entries()) {
    frames.push({ name: `car/taxi/taxi/${index}`, ...RenderSprite(taxi, { yaw: angle, elevation: vehicleElevation, ppm: 18 }) });
  }
  const player = await LoadVehicle(carKit + 'sedan.glb', 4.5, '#2b63c8');
  frames.push({ name: 'player/rear', ...RenderSprite(player, { yaw: 180, elevation: 15, ppm: 22 }) });
  for (const [index, [color, hex]] of Object.entries(scooterPaint).entries()) {
    const scooter = await BuildScooter(hex, index % 2 === 0 ? 'character-male-a.glb' : 'character-female-b.glb');
    for (const [view, angle] of vehicleViewAngles.entries()) {
      frames.push({ name: `scooter/${color}/${view}`, ...RenderSprite(scooter, { yaw: angle, elevation: vehicleElevation, ppm: 18 }) });
    }
  }
  const parkedScooter = await BuildScooter(scooterPaint.blue, null);
  frames.push({ name: 'prop/parked-scooter', ...RenderSprite(parkedScooter, { yaw: 90, elevation: 10, ppm: 16 }) });
  for (const [name, file, height] of [['tree-a', 'tree_default.glb', 6.4], ['tree-b', 'tree_oak.glb', 7.2], ['tree-c', 'tree_detailed.glb', 6.0]]) {
    frames.push({ name: `prop/${name}`, ...RenderSprite(await LoadProp(natureKit + file, height), { yaw: 0, elevation: 4, ppm: 9 }) });
  }
  frames.push({ name: 'prop/street-light', ...RenderSprite(await LoadProp(roadsKit + 'light-curved.glb', 7.5), { yaw: 90, elevation: 3, ppm: 9 }) });
  frames.push({ name: 'prop/utility-pole', ...RenderSprite(await LoadProp(roadsKit + 'electricity-pole-single.glb', 9), { yaw: 0, elevation: 3, ppm: 9 }) });
  for (const state of ['red', 'yellow', 'green']) {
    frames.push({ name: `prop/traffic-light/${state}`, ...RenderSprite(await LoadTrafficLight(state), { yaw: 270, elevation: 3, ppm: 12 }) });
  }
  const facades = [...'abcdefghijklmn'].map(letter => `building-${letter}.glb`).concat([...'abcde'].map(letter => `building-skyscraper-${letter}.glb`));
  for (const file of facades) {
    const building = await LoadBuilding(commercialKit + file);
    const id = file.replace('.glb', '').replace('building-', '');
    frames.push({ name: `facade/${id}/front`, aspect: building.aspect, ...RenderSprite(building.object, { yaw: 0, elevation: 0, ppm: 64 / building.width, outline: false, crop: false }) });
    frames.push({ name: `facade/${id}/side`, aspect: building.aspect, ...RenderSprite(building.object, { yaw: 90, elevation: 0, ppm: 64 / building.width, outline: false, crop: false }) });
  }
  frames.push({ name: 'skyline', ...RenderSprite(await BuildSkyline(), { yaw: 0, elevation: 0, ppm: 2.4, outline: false, haze: 0.5 }) });
  return PackAtlas(frames);
}

async function LoadGltf(path) {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(`/kits/${path.split('/').map(encodeURIComponent).join('/')}`));
  const gltf = await cache.get(path);
  return { scene: CloneSkinned(gltf.scene), animations: gltf.animations };
}

// Uniformly scales an object so its length (z extent) or height matches the
// game's footprint, then rests it on y = 0 centred on the origin.
function Normalize(object, { length, height }) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const scale = length ? length / size.z : height / size.y;
  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);
  const placed = new THREE.Box3().setFromObject(object);
  const center = placed.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= placed.min.y;
  const holder = new THREE.Group();
  holder.add(object);
  holder.updateMatrixWorld(true);
  return holder;
}

async function LoadVehicle(path, length, paintHex) {
  const { scene } = await LoadGltf(path);
  if (paintHex) {
    const body = scene.getObjectByName('body');
    RecolorPaint(body, paintHex);
  }
  return Normalize(scene, { length });
}

async function LoadProp(path, height) {
  const { scene } = await LoadGltf(path);
  return Normalize(scene, { height });
}

async function LoadBuilding(path) {
  const { scene } = await LoadGltf(path);
  scene.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
  const object = Normalize(scene, { height: size.y });
  return { object, width: size.x, aspect: size.y / size.x };
}

// The Kenney traffic light is one mesh whose lamp colours sit on texture
// gradients, so the lamps are covered with flat discs (own geometry, CC0)
// placed on the housing face: the lit one bright, the other two dark.
async function LoadTrafficLight(state) {
  const { scene } = await LoadGltf(roadsKit + 'traffic-light.glb');
  const holder = Normalize(scene, { height: 4.8 });
  const head = new THREE.Box3();
  const point = new THREE.Vector3();
  holder.traverse(child => {
    if (!child.isMesh) return;
    const position = child.geometry.attributes.position;
    for (let index = 0; index < position.count; index++) {
      point.fromBufferAttribute(position, index).applyMatrix4(child.matrixWorld);
      if (point.y > 3.45) head.expandByPoint(point);
    }
  });
  const lamps = [['red', 0.385, '#ff5040', '#4a1c18'], ['yellow', 0.78, '#ffc840', '#4a3a14'], ['green', 1.17, '#40f090', '#143a24']];
  for (const [name, drop, lit, off] of lamps) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), new THREE.MeshBasicMaterial({ color: name === state ? lit : off }));
    disc.rotation.y = -Math.PI / 2;
    disc.position.set(head.min.x - 0.02, head.max.y - drop, (head.min.z + head.max.z) / 2);
    holder.add(disc);
  }
  holder.updateMatrixWorld(true);
  return holder;
}

// A scooter body built from simple boxes (own geometry, released as CC0 with
// the atlas) on Kenney wheels, with a Kenney mini character in its drive pose.
async function BuildScooter(paintHex, riderFile) {
  const group = new THREE.Group();
  const paintMaterial = new THREE.MeshStandardMaterial({ color: paintHex, roughness: 0.6 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: '#202428', roughness: 0.8 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: '#9aa4ad', roughness: 0.5, metalness: 0.2 });
  const lightMaterial = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#fff3c4', emissiveIntensity: 0.6 });
  const tailMaterial = new THREE.MeshStandardMaterial({ color: '#d02020', emissive: '#a01010', emissiveIntensity: 0.5 });
  const AddBox = (material, width, height, depth, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  AddBox(darkMaterial, 0.3, 0.08, 0.86, 0, 0.3, 0.02);
  AddBox(paintMaterial, 0.42, 0.36, 0.72, 0, 0.55, -0.26);
  AddBox(darkMaterial, 0.34, 0.1, 0.62, 0, 0.78, -0.22);
  AddBox(paintMaterial, 0.44, 0.72, 0.14, 0, 0.66, 0.46);
  AddBox(paintMaterial, 0.2, 0.28, 0.42, 0, 0.42, 0.62);
  AddBox(trimMaterial, 0.66, 0.05, 0.05, 0, 1.04, 0.52);
  AddBox(lightMaterial, 0.16, 0.1, 0.06, 0, 0.92, 0.55);
  AddBox(tailMaterial, 0.24, 0.07, 0.05, 0, 0.66, -0.63);
  const { scene: wheelScene } = await LoadGltf(carKit + 'wheel-default.glb');
  for (const z of [0.62, -0.6]) {
    const wheel = Normalize(wheelScene.clone(true), { height: 0.46 });
    wheel.scale.set(0.42, 1, 1);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0, 0, z);
    group.add(wheel);
  }
  if (riderFile) {
    const { scene: rider, animations } = await LoadGltf(charactersKit + riderFile);
    const mixer = new THREE.AnimationMixer(rider);
    const drive = animations.find(clip => clip.name === 'drive') ?? animations.find(clip => clip.name === 'sit');
    mixer.clipAction(drive).play();
    mixer.update(0.2);
    rider.updateMatrixWorld(true);
    const standing = new THREE.Box3().setFromObject(rider).getSize(new THREE.Vector3());
    rider.scale.multiplyScalar(1.05 / standing.y);
    rider.updateMatrixWorld(true);
    const seated = new THREE.Box3().setFromObject(rider);
    rider.position.set(0, 0.84 - seated.min.y - (seated.max.y - seated.min.y) * 0.32, -0.12);
    group.add(rider);
  }
  return Normalize(group, { length: 1.8 });
}

async function BuildSkyline() {
  const group = new THREE.Group();
  let x = 0;
  for (const letter of 'abcdefghijklmnacegikm') {
    const { scene } = await LoadGltf(`${commercialKit}low-detail-building-${letter}.glb`);
    const building = Normalize(scene, { height: 18 + ((letter.charCodeAt(0) * 7) % 5) * 9 });
    const width = new THREE.Box3().setFromObject(building).getSize(new THREE.Vector3()).x;
    building.position.x = x + width / 2;
    x += width + 1.5;
    group.add(building);
  }
  return Normalize(group, { height: new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).y });
}

function ColorDistance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function CloneTexture(texture, canvas) {
  const next = new THREE.CanvasTexture(canvas);
  next.flipY = texture.flipY;
  next.colorSpace = texture.colorSpace;
  next.wrapS = texture.wrapS;
  next.wrapT = texture.wrapT;
  next.magFilter = THREE.NearestFilter;
  next.minFilter = THREE.NearestFilter;
  next.offset.copy(texture.offset);
  next.repeat.copy(texture.repeat);
  next.rotation = texture.rotation;
  next.center.copy(texture.center);
  next.needsUpdate = true;
  return next;
}

function KeyToRgb(key) {
  return [(key >> 16) & 255, (key >> 8) & 255, key & 255];
}

function Saturation([red, green, blue]) {
  const max = Math.max(red, green, blue);
  return max === 0 ? 0 : (max - Math.min(red, green, blue)) / max;
}

function Hue([red, green, blue]) {
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  if (delta === 0) return 0;
  const hue = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return (hue * 60 + 360) % 360;
}

function Luminance([red, green, blue]) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

// Area of the mesh's surface that samples each texel colour.
function ReadMeshTexels(mesh) {
  const texture = mesh.material.map;
  const image = texture.image;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const { position, uv } = mesh.geometry.attributes;
  const index = mesh.geometry.index;
  const weights = new Map();
  const triangleCount = (index ? index.count : position.count) / 3;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  texture.updateMatrix();
  for (let triangle = 0; triangle < triangleCount; triangle++) {
    const ids = [0, 1, 2].map(corner => index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner);
    a.fromBufferAttribute(position, ids[0]);
    b.fromBufferAttribute(position, ids[1]);
    c.fromBufferAttribute(position, ids[2]);
    const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    const point = new THREE.Vector2(ids.reduce((sum, id) => sum + uv.getX(id), 0) / 3, ids.reduce((sum, id) => sum + uv.getY(id), 0) / 3).applyMatrix3(texture.matrix);
    const px = Math.min(canvas.width - 1, Math.max(0, Math.floor(point.x * canvas.width)));
    const py = Math.min(canvas.height - 1, Math.max(0, Math.floor((texture.flipY ? 1 - point.y : point.y) * canvas.height)));
    const offset = (py * canvas.width + px) * 4;
    const key = (pixels.data[offset] << 16) | (pixels.data[offset + 1] << 8) | pixels.data[offset + 2];
    weights.set(key, (weights.get(key) ?? 0) + area);
  }
  return { texture, canvas, context, pixels, weights };
}

function ReplaceTexels(mesh, { texture, canvas, context, pixels }, changes) {
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const next = changes.get((pixels.data[offset] << 16) | (pixels.data[offset + 1] << 8) | pixels.data[offset + 2]);
    if (!next) continue;
    for (let channel = 0; channel < 3; channel++) pixels.data[offset + channel] = next[channel];
  }
  context.putImageData(pixels, 0, 0);
  mesh.material = mesh.material.clone();
  mesh.material.map = CloneTexture(texture, canvas);
}

// Paint is the saturated colour covering the most body surface, plus its
// nearby shades. Each shade keeps its brightness relative to the base paint so
// windows, lights and trim keep their original texels.
function RecolorPaint(mesh, paintHex) {
  const texels = ReadMeshTexels(mesh);
  const ranked = [...texels.weights.entries()].map(([key, weight]) => ({ key, rgb: KeyToRgb(key), weight }))
    .sort((left, right) => right.weight - left.weight);
  const base = ranked.find(item => Saturation(item.rgb) >= 0.35);
  const target = new THREE.Color(paintHex);
  const targetRgb = [target.r, target.g, target.b].map(channel => channel * 255);
  const changes = new Map();
  const data = texels.pixels.data;
  for (let offset = 0; offset < data.length; offset += 4) {
    const rgb = [data[offset], data[offset + 1], data[offset + 2]];
    const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    if (changes.has(key) || ColorDistance(rgb, base.rgb) > 46) continue;
    const ratio = Luminance(rgb) / Math.max(1, Luminance(base.rgb));
    changes.set(key, targetRgb.map(channel => Math.min(255, Math.round(channel * ratio))));
  }
  ReplaceTexels(mesh, texels, changes);
}

// Orthographic render from a direction given in degrees: yaw 0 looks at the
// object's front (+z), 90 at its left side (+x), 180 at its rear.
function RenderSprite(object, { yaw, elevation, ppm, outline = true, crop = true, haze = 0 }) {
  const scene = new THREE.Scene();
  scene.add(object);
  const yawRad = yaw * Math.PI / 180;
  const elevationRad = elevation * Math.PI / 180;
  const direction = new THREE.Vector3(Math.sin(yawRad) * Math.cos(elevationRad), Math.sin(elevationRad), Math.cos(yawRad) * Math.cos(elevationRad));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  camera.position.copy(direction.clone().multiplyScalar(300));
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const corners = [];
  object.updateMatrixWorld(true);
  object.traverse(child => {
    if (!child.isMesh) return;
    child.geometry.computeBoundingBox();
    const box = child.geometry.boundingBox;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      corners.push(new THREE.Vector3(x, y, z).applyMatrix4(child.matrixWorld).applyMatrix4(camera.matrixWorldInverse));
    }
  });
  const left = Math.min(...corners.map(point => point.x));
  const bottom = Math.min(...corners.map(point => point.y));
  const width = Math.max(1, Math.ceil((Math.max(...corners.map(point => point.x)) - left) * ppm));
  const height = Math.max(1, Math.ceil((Math.max(...corners.map(point => point.y)) - bottom) * ppm));
  camera.left = left;
  camera.right = left + width / ppm;
  camera.bottom = bottom;
  camera.top = bottom + height / ppm;
  camera.updateProjectionMatrix();
  const lightDirection = new THREE.Vector3(-0.55, 0.85, 0.35).applyQuaternion(camera.quaternion);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.copy(lightDirection.multiplyScalar(50));
  scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x77808a, 1.5));
  renderer.setSize(width * superSample, height * superSample, false);
  renderer.render(scene, camera);
  scene.remove(object);
  const origin = new THREE.Vector3(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
  const anchorX = (origin.x - left) * ppm;
  const anchorY = (camera.top - origin.y) * ppm;
  const pixels = Pixelate(renderer.domElement, width, height, { outline, haze });
  const pad = outline ? 1 : 0;
  const trimmed = crop ? Trim(pixels, width + pad * 2, height + pad * 2) : { pixels, x: 0, y: 0, width: width + pad * 2, height: height + pad * 2 };
  return {
    pixels: trimmed.pixels, width: trimmed.width, height: trimmed.height, ppm,
    anchorX: Round(anchorX + pad - trimmed.x), anchorY: Round(anchorY + pad - trimmed.y),
  };
}

function Round(value) {
  return Math.round(value * 100) / 100;
}

// Box-filter the supersampled render down to one texel per pixel, cut alpha
// to on/off, posterize to 16 levels per channel and add a dark 1 px outline.
function Pixelate(source, width, height, { outline, haze }) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, 0, 0);
  const sample = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const pad = outline ? 1 : 0;
  const outWidth = width + pad * 2;
  const outHeight = height + pad * 2;
  const output = new Uint8ClampedArray(outWidth * outHeight * 4);
  const hazeColor = [176, 200, 214];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let red = 0, green = 0, blue = 0, alpha = 0;
      for (let sy = 0; sy < superSample; sy++) {
        for (let sx = 0; sx < superSample; sx++) {
          const offset = ((y * superSample + sy) * canvas.width + x * superSample + sx) * 4;
          const weight = sample[offset + 3];
          red += sample[offset] * weight;
          green += sample[offset + 1] * weight;
          blue += sample[offset + 2] * weight;
          alpha += weight;
        }
      }
      if (alpha / (superSample * superSample) < 115) continue;
      const target = ((y + pad) * outWidth + x + pad) * 4;
      const color = [red / alpha, green / alpha, blue / alpha].map((channel, index) => channel * (1 - haze) + hazeColor[index] * haze);
      for (let channel = 0; channel < 3; channel++) output[target + channel] = Math.min(255, Math.round(color[channel] / 17) * 17);
      output[target + 3] = 255;
    }
  }
  if (outline) {
    const solid = index => output[index * 4 + 3] === 255;
    const edges = [];
    for (let y = 0; y < outHeight; y++) {
      for (let x = 0; x < outWidth; x++) {
        if (solid(y * outWidth + x)) continue;
        const neighbour = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy])
          .find(([nx, ny]) => nx >= 0 && ny >= 0 && nx < outWidth && ny < outHeight && solid(ny * outWidth + nx));
        if (neighbour) edges.push([y * outWidth + x, neighbour[1] * outWidth + neighbour[0]]);
      }
    }
    for (const [index, from] of edges) {
      for (let channel = 0; channel < 3; channel++) output[index * 4 + channel] = Math.round(output[from * 4 + channel] * 0.3);
      output[index * 4 + 3] = 255;
    }
  }
  return output;
}

function Trim(pixels, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] === 0) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (maxX < 0) return { pixels: new Uint8ClampedArray(4), x: 0, y: 0, width: 1, height: 1 };
  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;
  const trimmed = new Uint8ClampedArray(trimmedWidth * trimmedHeight * 4);
  for (let y = 0; y < trimmedHeight; y++) {
    trimmed.set(pixels.subarray(((y + minY) * width + minX) * 4, ((y + minY) * width + maxX + 1) * 4), y * trimmedWidth * 4);
  }
  return { pixels: trimmed, x: minX, y: minY, width: trimmedWidth, height: trimmedHeight };
}

// Shelf packing, tallest first, with 1 px gaps so nearest sampling never bleeds.
function PackAtlas(frames) {
  const ordered = [...frames].sort((left, right) => right.height - left.height);
  let x = 0, y = 0, shelf = 0;
  for (const frame of ordered) {
    if (x + frame.width > atlasWidth) { x = 0; y += shelf + 1; shelf = 0; }
    frame.x = x;
    frame.y = y;
    x += frame.width + 1;
    shelf = Math.max(shelf, frame.height);
  }
  const height = Math.ceil((y + shelf) / 4) * 4;
  const canvas = document.createElement('canvas');
  canvas.width = atlasWidth;
  canvas.height = height;
  const context = canvas.getContext('2d');
  for (const frame of frames) context.putImageData(new ImageData(frame.pixels, frame.width, frame.height), frame.x, frame.y);
  const preview = document.createElement('canvas');
  preview.width = atlasWidth;
  preview.height = height;
  const previewContext = preview.getContext('2d');
  previewContext.fillStyle = '#7f8c8d';
  previewContext.fillRect(0, 0, atlasWidth, height);
  previewContext.drawImage(canvas, 0, 0);
  const frameMap = Object.fromEntries(frames.map(frame => [frame.name, Object.fromEntries(Object.entries({
    x: frame.x, y: frame.y, w: frame.width, h: frame.height, ax: frame.anchorX, ay: frame.anchorY, ppm: Round(frame.ppm), aspect: frame.aspect === undefined ? undefined : Round(frame.aspect),
  }).filter(([, value]) => value !== undefined))]));
  return {
    atlasPng: canvas.toDataURL('image/png').split(',')[1],
    previewPng: preview.toDataURL('image/png').split(',')[1],
    frames: frameMap, width: atlasWidth, height,
  };
}
