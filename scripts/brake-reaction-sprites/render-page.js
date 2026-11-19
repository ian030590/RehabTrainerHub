import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const cars = [
  { key: 'sedan', model: 'sedan.glb', widthMeters: 1.80, paint: { swatchX: 416, rgb: [205, 214, 224] } },
  { key: 'suv', model: 'suv.glb', widthMeters: 1.90, paint: { swatchX: 224, rgb: [75, 89, 109] } },
  { key: 'ev', model: 'hatchback-sports.glb', widthMeters: 1.78, paint: { swatchX: 224, rgb: [249, 249, 249] } },
  { key: 'sport', model: 'sedan-sports.glb', widthMeters: 1.85, paint: { swatchX: 416, rgb: [37, 84, 149] } },
  { key: 'decoy-van', model: 'van.glb', widthMeters: 2.00 },
  { key: 'decoy-taxi', model: 'taxi.glb', widthMeters: 1.80 },
  { key: 'decoy-suv', model: 'suv-luxury.glb', widthMeters: 1.95, paint: { swatchX: 288, rgb: [154, 132, 192] } },
  { key: 'decoy-delivery', model: 'delivery.glb', widthMeters: 2.05 },
];
const bodyWidth = 480;
const renderWidth = 512;
const padding = 2;
const columns = 4;

export async function BakeCars(includePreview) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0, 0);
  const loader = new GLTFLoader();
  const sprites = [];
  try {
    for (const car of cars) {
      const { scene: model } = await loader.loadAsync(`/models/${car.model}`);
      sprites.push(RenderCar(renderer, model, car));
    }
  } finally {
    renderer.dispose();
  }

  const { canvas, frames } = PackAtlas(sprites);
  const png = Base64(canvas.toDataURL('image/png'));
  const webpUrl = canvas.toDataURL('image/webp', 0.9);
  const webp = webpUrl.startsWith('data:image/webp;') ? Base64(webpUrl) : null;
  const pngBytes = EncodedSize(png);
  const webpBytes = webp && EncodedSize(webp);
  const useWebp = webpBytes !== null && webpBytes <= pngBytes * 0.7;
  return {
    width: canvas.width,
    height: canvas.height,
    frames,
    atlas: useWebp ? webp : png,
    extension: useWebp ? 'webp' : 'png',
    pngBytes,
    webpBytes,
    preview: includePreview ? Base64(CreatePreview(sprites).toDataURL('image/png')) : undefined,
  };
}

function MakeCamera(model) {
  const box = new THREE.Box3().setFromObject(model, true);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const pitch = THREE.MathUtils.degToRad(4);
  const unitsPerPixel = size.x / bodyWidth;
  const height = Math.ceil((size.y + size.z * Math.sin(pitch)) / unitsPerPixel) + 32;
  const distance = size.x * 1.5;
  const bumper = new THREE.Vector3(center.x, box.min.y + size.x * 0.25, box.min.z);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, distance + size.length() * 2);
  // The kit's front wheels are on +Z, so the camera stays on the -Z centerline.
  camera.position.copy(bumper).add(new THREE.Vector3(0, distance * Math.tan(pitch), -distance));
  camera.lookAt(bumper);
  camera.updateMatrixWorld();
  const centerY = center.applyMatrix4(camera.matrixWorldInverse).y;
  camera.left = -renderWidth * unitsPerPixel / 2;
  camera.right = -camera.left;
  camera.top = centerY + height * unitsPerPixel / 2;
  camera.bottom = centerY - height * unitsPerPixel / 2;
  camera.updateProjectionMatrix();
  return { camera, height };
}

function ApplyBodyPaint(model, { swatchX, rgb }) {
  const original = model.getObjectByName('body').material.map;
  const { width, height } = original.image;
  if (width !== 512 || height !== 512) throw new Error('Body paint swatches require the 512 px Car Kit 3.1 colormap.');

  const canvas = CreateCanvas(width, height);
  const context = canvas.getContext('2d');
  context.drawImage(original.image, 0, 0);
  // The selected models' painted faces sample only this gradient in the kit palette.
  const swatchY = 128;
  const swatchWidth = 32;
  const swatch = context.getImageData(swatchX, swatchY, swatchWidth, 128);
  const { data } = swatch;
  const luminance = offset => 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
  const baseLuminance = luminance((swatchWidth / 2) * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    const shade = luminance(offset) / baseLuminance;
    data[offset] = rgb[0] * shade;
    data[offset + 1] = rgb[1] * shade;
    data[offset + 2] = rgb[2] * shade;
  }
  context.putImageData(swatch, swatchX, swatchY);

  const painted = original.clone();
  // Three.js texture clones share the original source until it is replaced.
  painted.source = new THREE.Source(canvas);
  painted.needsUpdate = true;
  const materials = new Set();
  model.traverse(mesh => {
    if (mesh.isMesh && mesh.material.map === original) materials.add(mesh.material);
  });
  for (const material of materials) material.map = painted;
  return () => {
    for (const material of materials) material.map = original;
    painted.dispose();
  };
}

function RenderCar(renderer, model, car) {
  const { camera, height } = MakeCamera(model);
  const scene = new THREE.Scene();
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
  keyLight.position.set(0.4, 1, -1);
  scene.add(model, new THREE.HemisphereLight(0xf1f3f8, 0x8d8c91, 1.25), keyLight);

  renderer.setSize(renderWidth, height, false);
  const image = CreateCanvas(renderWidth, height);
  const imageContext = image.getContext('2d', { willReadFrequently: true });
  const restorePaint = car.paint && ApplyBodyPaint(model, car.paint);
  try {
    renderer.render(scene, camera);
    imageContext.drawImage(renderer.domElement, 0, 0);
  } finally {
    restorePaint?.();
  }
  const silhouette = imageContext.getImageData(0, 0, renderWidth, height);
  const bounds = FindBounds(silhouette, 0, renderWidth, (red, green, blue, alpha) => alpha > 0);
  if (!bounds) throw new Error(`${car.model} produced an empty sprite.`);

  // The bottom padding lives between atlas rows so the sprite's bottom stays on the road.
  const canvas = CreateCanvas(bounds.w + 2 * padding, bounds.h + padding);
  canvas.getContext('2d').drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h, padding, padding, bounds.w, bounds.h);

  // Read the original palette under the same projection, since lighting shifts the lamp colors.
  const paletteMaterials = new Map();
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const material = mesh.material;
    if (!paletteMaterials.has(material)) {
      const map = material.map.clone();
      map.minFilter = THREE.NearestFilter;
      map.magFilter = THREE.NearestFilter;
      map.generateMipmaps = false;
      map.needsUpdate = true;
      paletteMaterials.set(material, new THREE.MeshBasicMaterial({ map, side: material.side }));
    }
    mesh.material = paletteMaterials.get(material);
  });
  renderer.render(scene, camera);
  imageContext.clearRect(0, 0, renderWidth, height);
  imageContext.drawImage(renderer.domElement, padding - bounds.x, padding - bounds.y);
  const palette = imageContext.getImageData(0, 0, canvas.width, canvas.height);
  for (const material of paletteMaterials.values()) {
    material.map.dispose();
    material.dispose();
  }

  const middle = Math.floor(canvas.width / 2);
  const tailLeft = FindBounds(palette, 0, middle, IsTailLamp);
  const tailRight = FindBounds(palette, middle, canvas.width, IsTailLamp);
  if (!tailLeft || !tailRight) {
    throw new Error(`${car.model} (${car.key}) has no detectable red ${tailLeft ? 'right' : tailRight ? 'left' : 'left or right'} tail lamp.`);
  }
  const third = FindThirdLamp(palette, Math.min(tailLeft.y, tailRight.y));
  const lamps = Object.fromEntries(Object.entries({ tailLeft, tailRight, third }).map(([key, { x, y, w, h }]) => [
    key, [x / canvas.width, y / canvas.height, w / canvas.width, h / canvas.height],
  ]));
  return { key: car.key, widthMeters: car.widthMeters, canvas, lamps };
}

function IsTailLamp(red, green, blue, alpha) {
  // The lamp swatch has less blue than the neighboring orange paint gradients.
  return alpha === 255 && red >= 205 && green <= 100 && blue >= 58 && blue <= 67 && red > 2 * green;
}

function FindBounds({ data, width, height }, startX, endX, matches) {
  let left = endX, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = startX; x < endX; x++) {
      const offset = (y * width + x) * 4;
      if (!matches(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = y;
    }
  }
  if (right < 0) return null;
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

function FindThirdLamp({ data, width, height }, tailY) {
  const w = Math.round(width * 0.22);
  const h = Math.round(height * 0.03);
  const x = Math.round((width - w) / 2);
  const stripRows = h + padding;
  let paleRows = 0;
  let tintedRows = 0;
  let tintedY;

  // A full-height band ignores thin highlights above the rear window.
  for (let y = padding; y < tailY; y++) {
    let palePixels = 0;
    let tintedPixels = 0;
    for (let px = x - 1; px <= x + w; px++) {
      const offset = (y * width + px) * 4;
      const [red, green, blue, alpha] = data.subarray(offset, offset + 4);
      if (alpha !== 255) continue;
      if (green >= 224 && blue >= 245 && blue - red >= 5) palePixels++;
      if (red >= 100 && red <= 132 && green >= red && green - red <= 6 && blue - green >= 18 && blue - green <= 28) tintedPixels++;
    }
    paleRows = palePixels === w + 2 ? paleRows + 1 : 0;
    tintedRows = tintedPixels === w + 2 ? tintedRows + 1 : 0;
    if (paleRows === stripRows) return { x, y: y - h + 1, w, h };
    if (tintedY === undefined && tintedRows === stripRows) tintedY = y - h + 1;
  }

  return { x, y: tintedY ?? padding + Math.round(height * 0.055), w, h };
}

function PackAtlas(sprites) {
  const columnWidth = Math.max(...sprites.map(({ canvas }) => canvas.width)) + padding;
  const rows = [];
  for (let start = 0; start < sprites.length; start += columns) rows.push(sprites.slice(start, start + columns));
  const rowHeights = rows.map(row => Math.max(...row.map(({ canvas }) => canvas.height)) + padding);
  const canvas = CreateCanvas(columns * columnWidth - padding, rowHeights.reduce((sum, height) => sum + height, -padding));
  const context = canvas.getContext('2d');
  const frames = {};
  let rowY = 0;
  for (const [row, spritesInRow] of rows.entries()) {
    for (const [column, sprite] of spritesInRow.entries()) {
      const { width: w, height: h } = sprite.canvas;
      const x = column * columnWidth;
      const y = rowY + rowHeights[row] - padding - h;
      context.drawImage(sprite.canvas, x, y);
      frames[sprite.key] = { x, y, w, h, widthMeters: sprite.widthMeters, lamps: sprite.lamps };
    }
    rowY += rowHeights[row];
  }
  return { canvas, frames };
}

function CreatePreview(sprites) {
  const cellWidth = 270;
  const spriteWidth = 240;
  const tallestSprite = Math.max(...sprites.map(({ canvas }) => Math.ceil(spriteWidth * canvas.height / canvas.width)));
  const cellHeight = tallestSprite + 48;
  const canvas = CreateCanvas(cellWidth * columns, cellHeight * Math.ceil(sprites.length / columns));
  const context = canvas.getContext('2d');
  context.fillStyle = '#1d2633';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = '15px sans-serif';
  context.textAlign = 'center';
  context.lineWidth = 2;
  for (const [index, sprite] of sprites.entries()) {
    const x = (index % columns) * cellWidth + (cellWidth - spriteWidth) / 2;
    const bottom = Math.floor(index / columns) * cellHeight + tallestSprite + 12;
    const h = spriteWidth * sprite.canvas.height / sprite.canvas.width;
    const y = bottom - h;
    context.drawImage(sprite.canvas, x, y, spriteWidth, h);
    for (const [name, [fx, fy, fw, fh]] of Object.entries(sprite.lamps)) {
      context.strokeStyle = name === 'third' ? '#ffdf68' : '#65ffdc';
      context.strokeRect(x + fx * spriteWidth, y + fy * h, fw * spriteWidth, fh * h);
    }
    context.fillStyle = '#f2f5fa';
    context.fillText(sprite.key, x + spriteWidth / 2, bottom + 22);
  }
  return canvas;
}

function CreateCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function Base64(dataUrl) {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

function EncodedSize(encoded) {
  return encoded.length * 3 / 4 - (encoded.endsWith('==') ? 2 : Number(encoded.endsWith('=')));
}
