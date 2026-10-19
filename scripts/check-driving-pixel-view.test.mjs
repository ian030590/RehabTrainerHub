import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/driving-rehab');
const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };

async function ImportGameModule(file) {
  const source = await readFile(resolve(gameRoot, file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

// Builds a class containing only the named runtime methods, so input and
// traffic rules can run without a canvas or a browser.
async function LoadRuntimeMethods(names, globals = {}) {
  const source = await readFile(resolve(gameRoot, 'three-driving-rehab.ts'), 'utf8');
  const ast = ts.createSourceFile('driving.ts', source, ts.ScriptTarget.Latest, true);
  const runtime = ast.statements.find(ts.isClassDeclaration);
  const members = runtime.members.filter(node => names.includes(node.name?.getText(ast)));
  assert.deepEqual(members.map(node => node.name.getText(ast)).sort(), [...names].sort(), 'Every requested runtime method exists.');
  const compiled = ts.transpileModule(`class RuntimeHarness { ${members.map(node => node.getText(ast)).join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(globals), `${compiled}; return RuntimeHarness;`)(...Object.values(globals));
}

function PolygonArea(points) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

// Builds the whole runtime class, with its imports taken from the game
// modules, so the player car and traffic can be stepped without a canvas.
let drivingRuntimeLoad = null;
async function LoadDrivingRuntime() {
  const modules = await Promise.all([
    'traffic/drivingTraffic.ts', 'route/driving-route.ts', 'hazards/driving-hazards.ts', 'rendering/driving-rendering.ts', 'text/driving-text.ts', 'pixel/spriteNames.ts',
  ].map(ImportGameModule));
  const source = await readFile(resolve(gameRoot, 'three-driving-rehab.ts'), 'utf8');
  const ast = ts.createSourceFile('driving.ts', source, ts.ScriptTarget.Latest, true);
  const runtimeClass = ast.statements.find(ts.isClassDeclaration);
  const compiled = ts.transpileModule(runtimeClass.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const globals = Object.assign({}, ...modules.map(module => ({ ...module })), { info: {}, soundManager: { playFailure() {}, playSuccess() {} } });
  delete globals.default;
  const runtimeType = new Function(...Object.keys(globals), `${compiled}; return ${runtimeClass.name.text};`)(...Object.values(globals));
  return { runtimeType, route: modules[1] };
}

async function CreateDrivingWorld(variantIndex) {
  drivingRuntimeLoad ??= LoadDrivingRuntime();
  const { runtimeType, route } = await drivingRuntimeLoad;
  const runtime = new runtimeType({});
  runtime.route = runtime.ensureRoute(route.BuildDrivingRoute(route.drivingRouteVariants[variantIndex]));
  runtime.updateRouteMetrics();
  Object.assign(runtime, {
    intersections: [], ambientTrafficActors: [], activeHazards: [], eventResults: [], buildingCollisionBoxes: [], lastCollisionEventTime: -Infinity,
  });
  // Lane rules and lane resets are driven by their own tests.
  runtime.updateDrivingRuleViolations = () => {};
  runtime.updateLaneDepartureState = () => {};
  return runtime;
}

function PlaceDrivingPlayer(runtime, distance, lateral, speed = 0) {
  const point = runtime.getRoutePoint(distance);
  Object.assign(runtime, {
    vehicleX: point.x + point.normal.x * lateral,
    vehicleZ: point.z + point.normal.z * lateral,
    vehicleHeading: runtime.getHeadingFromDirection(point.dir),
    vehicleSpeed: speed,
    progress: distance,
    previousProgress: distance,
    lateralOffset: lateral,
  });
}

function AddDrivingCar(runtime, distance, lateral, speed = 0) {
  const car = runtime.createTrafficActor('car', 'car/sedan/white', { distance, lateral, direction: 1, cruiseSpeed: speed, rearSlot: null, waiting: false });
  car.speed = speed;
  runtime.ambientTrafficActors.push(car);
  runtime.positionTrafficActor(car);
  return car;
}

function IsTouchingTraffic(runtime) {
  const player = runtime.getVehicleCollisionBox();
  return runtime.ambientTrafficActors.some(actor => !actor.waiting && runtime.boxesOverlap(player, runtime.getTrafficActorCollisionBox(actor)));
}

// A missing module fails only the tests that use it.
async function OptionalGameModule(file) {
  try {
    return await ImportGameModule(file);
  } catch (error) {
    return new Proxy({}, { get: (_, key) => { if (key === 'then') return undefined; throw new Error(`${file} is not available: ${error.code ?? error.message}`); } });
  }
}

const pixelCamera = await OptionalGameModule('pixel/pixelCamera.ts');
const cockpit = await OptionalGameModule('pixel/pixelCockpit.ts');
const traffic = await OptionalGameModule('traffic/drivingTraffic.ts');

test('the driving view is a pixelated 2D canvas with no three.js or WebGL', async () => {
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies.three, undefined, 'The game no longer depends on three.');
  const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages['apps/rehabtrainerhub/games/driving-rehab'].dependencies.three, undefined);
  const files = (await readdir(gameRoot, { recursive: true }))
    .filter(file => /\.(tsx?|css|html)$/.test(file) && !/^(dist|node_modules)[\\/]/.test(file));
  // Hash-pinned helpers keep comments about the old renderer; only code counts.
  const printer = ts.createPrinter({ removeComments: true });
  for (const file of files) {
    const text = await readFile(resolve(gameRoot, file), 'utf8');
    const code = /\.tsx?$/.test(file)
      ? printer.printFile(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS))
      : text.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, '');
    assert.doesNotMatch(code, /from ['"]three|WebGL|webgl|GLTFLoader/, file);
  }
  const runtime = await readFile(resolve(gameRoot, 'three-driving-rehab.ts'), 'utf8');
  const renderer = await readFile(resolve(gameRoot, 'pixel/pixelRenderer.ts'), 'utf8');
  assert.match(renderer, /getContext\('2d'/);
  assert.match(renderer, /imageSmoothingEnabled = false/);
  assert.match(renderer, /imageRendering = 'pixelated'/);
  assert.match(runtime, /PixelDrivingRenderer/);
  const vite = await readFile(resolve(gameRoot, 'vite.config.ts'), 'utf8');
  assert.doesNotMatch(vite, /vehicle-data|car\.glb/, 'The 6 MB GLB is no longer bundled into the game.');
});

test('projection puts the road ahead at the centre and farther points closer to the horizon', () => {
  const camera = pixelCamera.CreatePixelCamera({
    position: { x: 0, y: 2, z: 0 }, lookAt: { x: 0, y: 2, z: -50 }, fov: 60, width: 320, height: 180,
  });
  const ahead = pixelCamera.ProjectPixelPoint(camera, 0, 2, -20);
  assert.ok(Math.abs(ahead.x - 160) < 1e-9 && Math.abs(ahead.y - 90) < 1e-9);
  const near = pixelCamera.ProjectPixelPoint(camera, 0, 0, -10);
  const far = pixelCamera.ProjectPixelPoint(camera, 0, 0, -80);
  assert.ok(near.y > far.y && far.y > 90, 'Road points rise toward the horizon as they recede.');
  assert.ok(near.depth < far.depth);
  const right = pixelCamera.ProjectPixelPoint(camera, 3, 0, -20);
  assert.ok(right.x > 160, 'Positive x is on the right of a camera looking down -z.');
  assert.equal(pixelCamera.ProjectPixelPoint(camera, 0, 0, 5), null, 'Points behind the camera are culled.');
});

test('the first-person eye sits in the left seat of a left-hand-drive car', () => {
  for (const heading of [0, Math.PI / 2, 2.4]) {
    const pose = {
      position: { x: 10, y: 2.05, z: 20 }, lookAt: { x: 10 + Math.sin(heading) * 35, y: 1.65, z: 20 - Math.cos(heading) * 35 },
      up: { x: 0, y: 1, z: 0 }, fov: 68,
    };
    const eye = pixelCamera.CalculateDriverEyePose(pose, heading);
    const right = { x: Math.cos(heading), z: Math.sin(heading) };
    const shift = (eye.position.x - pose.position.x) * right.x + (eye.position.z - pose.position.z) * right.z;
    assert.ok(Math.abs(shift + pixelCamera.driverEyeLeftOffset) < 1e-9, 'The eye moves left of the car centre.');
    assert.ok(pixelCamera.driverEyeLeftOffset > 0.25 && pixelCamera.driverEyeLeftOffset < 0.5);
    const lookShift = (eye.lookAt.x - pose.lookAt.x) * right.x + (eye.lookAt.z - pose.lookAt.z) * right.z;
    assert.ok(Math.abs(lookShift - shift) < 1e-9, 'The driver still looks straight down the car heading.');
    assert.equal(eye.fov, pose.fov);
  }
});

test('the cockpit has the wheel in front of the driver, two A-pillars and three mirrors', () => {
  for (const [width, height] of [[480, 270], [300, 400], [640, 300]]) {
    const layout = cockpit.CalculateCockpitLayout(width, height);
    assert.ok(Math.abs(layout.wheel.x - width / 2) < width * 0.06, `${width}x${height}: the wheel is in front of the driver.`);
    assert.ok(layout.console.x > layout.wheel.x + layout.wheel.radius * 0.6, 'The centre console sits to the right of the driver.');
    assert.ok(layout.leftPillar.some(point => point.x <= 0), 'The left A-pillar meets the left edge.');
    assert.ok(layout.rightPillar.some(point => point.x >= width), 'The right A-pillar meets the right edge.');
    assert.ok(PolygonArea(layout.leftPillar) > PolygonArea(layout.rightPillar), 'The nearer left pillar looks wider.');
    const { left, center, right } = layout.mirrors;
    for (const [name, mirror] of Object.entries(layout.mirrors)) {
      assert.ok(mirror.x >= 0 && mirror.y >= 0 && mirror.x + mirror.w <= width && mirror.y + mirror.h <= height, `${name} mirror fits.`);
      assert.ok(mirror.w >= 24 && mirror.h >= 12, `${name} mirror is large enough to read.`);
      const nearestX = Math.max(mirror.x, Math.min(layout.wheel.x, mirror.x + mirror.w));
      const nearestY = Math.max(mirror.y, Math.min(layout.wheel.y, mirror.y + mirror.h));
      assert.ok(Math.hypot(nearestX - layout.wheel.x, nearestY - layout.wheel.y) > layout.wheel.radius, `${name} mirror clears the wheel.`);
    }
    assert.ok(left.x + left.w <= width * 0.34 && right.x >= width * 0.66, 'Side mirrors sit at the left and right edges.');
    assert.ok(center.y + center.h <= height * 0.3, 'The interior mirror hangs at the top of the windscreen.');
    assert.ok(center.x > left.x + left.w && center.x + center.w < right.x);
    assert.ok(center.x + center.w / 2 > layout.wheel.x, 'The interior mirror is on the car centreline, right of the driver.');
  }
});

test('on a phone the interior mirror hangs below the status panel at the top', () => {
  const plain = cockpit.CalculateCockpitLayout(195, 422);
  const inset = cockpit.CalculateCockpitLayout(195, 422, 44);
  assert.ok(plain.mirrors.center.y < 44, 'Without room reserved the mirror would sit under the panel.');
  assert.ok(inset.mirrors.center.y >= 44, 'The interior mirror starts below the reserved top band.');
  assert.ok(inset.mirrors.center.y + inset.mirrors.center.h < inset.mirrors.left.y, 'It still hangs above the door mirrors.');
  assert.deepEqual(inset.mirrors.left, plain.mirrors.left);
  assert.deepEqual(inset.mirrors.right, plain.mirrors.right);
  assert.deepEqual(inset.wheel, plain.wheel);
});

test('the desktop navigation map leaves all three mirrors and the stop button visible', () => {
  const stopButtonBottom = 60;
  for (const [width, height] of [[752, 485], [1024, 640], [1280, 720], [1920, 1080]]) {
    const layout = cockpit.CalculateCockpitLayout(width, height);
    const map = cockpit.CalculateDesktopMiniMapRect(width, height);
    const label = `${width}x${height}`;
    assert.ok(map.x >= 0 && map.x + map.w <= width && map.y + map.h <= height, `${label}: the map fits.`);
    assert.ok(map.y >= stopButtonBottom, `${label}: the map sits below the stop button.`);
    assert.ok(map.w >= 160 && map.h >= 150, `${label}: the map is large enough to read.`);
    for (const [name, mirror] of Object.entries(layout.mirrors)) {
      const apart = map.x >= mirror.x + mirror.w || mirror.x >= map.x + map.w
        || map.y >= mirror.y + mirror.h || mirror.y >= map.y + map.h;
      assert.ok(apart, `${label}: the map does not cover the ${name} mirror.`);
    }
  }
});

test('the speedometer needle and readout follow the real speed', () => {
  assert.equal(cockpit.CalculateSpeedometerNeedleAngle(0, 65), -115);
  assert.equal(cockpit.CalculateSpeedometerNeedleAngle(65, 65), 115);
  assert.equal(cockpit.CalculateSpeedometerNeedleAngle(200, 65), 115);
  let previous = -Infinity;
  for (let speed = 0; speed <= 65; speed += 5) {
    const angle = cockpit.CalculateSpeedometerNeedleAngle(speed, 65);
    assert.ok(angle > previous);
    previous = angle;
  }
  assert.ok(cockpit.CalculateSteeringWheelAngle(0.72) > 60, 'The wheel visibly turns at full lock.');
  assert.equal(cockpit.CalculateSteeringWheelAngle(0), 0);
  assert.equal(cockpit.CalculateSteeringWheelAngle(-0.3), -cockpit.CalculateSteeringWheelAngle(0.3));
});

test('mirrors look backwards and show a car behind on the side it really is', () => {
  const vehicle = { vehicleX: 0, vehicleZ: 0, vehicleHeading: 0 };
  const view = mirror => {
    const pose = pixelCamera.CalculateRearviewCameraPose({ ...vehicle, mirror });
    const size = mirror === 'center' ? { width: 96, height: 30 } : { width: 56, height: 40 };
    return { size, camera: pixelCamera.CreatePixelCamera({ ...pose, ...size, mirrored: true }) };
  };
  const visible = ({ camera, size }, x, z) => {
    const point = pixelCamera.ProjectPixelPoint(camera, x, 0.9, z);
    return point && point.x >= 0 && point.x <= size.width && point.y >= 0 && point.y <= size.height ? point : null;
  };
  const center = view('center');
  const behindLeft = visible(center, -3.2, 25);
  const behindRight = visible(center, 3.2, 25);
  assert.ok(behindLeft && behindRight, 'The interior mirror sees both adjacent lanes behind.');
  assert.ok(behindLeft.x < center.size.width / 2, 'A car behind on the left shows on the left of the mirror.');
  assert.ok(behindRight.x > center.size.width / 2);
  assert.equal(visible(center, 0, -25), null, 'The interior mirror does not show the road ahead.');
  assert.ok(visible(view('left'), -3.2, 18), 'The left mirror sees the lane to the left.');
  assert.equal(visible(view('right'), -3.2, 18), null);
  assert.ok(visible(view('right'), 3.2, 18), 'The right mirror sees the lane to the right.');
  assert.equal(visible(view('left'), 3.2, 18), null);
  const turned = pixelCamera.CalculateRearviewCameraPose({ vehicleX: 5, vehicleZ: 5, vehicleHeading: Math.PI / 2, mirror: 'center' });
  assert.ok(turned.lookAt.x < turned.position.x, 'Mirrors turn with the car.');
});

test('vehicle sprites pick the view that faces the camera', () => {
  const pick = (cameraX, cameraZ) => pixelCamera.SelectVehicleSpriteView(cameraX, cameraZ, 0, 0, 0);
  assert.deepEqual(pick(0, -20), { index: 0, mirrored: false }, 'Oncoming car shows its front.');
  assert.deepEqual(pick(0, 20), { index: 4, mirrored: false }, 'A car ahead shows its rear.');
  assert.deepEqual(pick(-20, 0), { index: 2, mirrored: false }, 'Left side from the left.');
  assert.deepEqual(pick(20, 0), { index: 2, mirrored: true }, 'Right side mirrors the left view.');
  assert.deepEqual(pick(-14, 14), { index: 3, mirrored: false });
  assert.deepEqual(pick(14, -14), { index: 1, mirrored: true });
});

test('the sprite atlas holds every frame the renderer draws and lists CC0 sources', async () => {
  const atlas = JSON.parse(await readFile(resolve(gameRoot, 'sprites/driving-sprites.json'), 'utf8'));
  const png = await readFile(resolve(gameRoot, 'sprites/driving-sprites.png'));
  assert.equal(png.readUInt32BE(16), atlas.width);
  assert.equal(png.readUInt32BE(20), atlas.height);
  const { spriteFrameNames } = await ImportGameModule('pixel/spriteNames.ts');
  for (const name of spriteFrameNames) {
    const frame = atlas.frames[name];
    assert.ok(frame, `Missing sprite ${name}`);
    assert.ok(frame.x + frame.w <= atlas.width && frame.y + frame.h <= atlas.height && frame.ppm > 0, name);
  }
  const sources = await readFile(resolve(gameRoot, 'sprites/SOURCES.md'), 'utf8');
  for (const kit of ['Car Kit', 'City Kit (Commercial)', 'City Kit (Roads)', 'Nature Kit', 'Mini Characters']) {
    assert.match(sources, new RegExp(`${kit.replace(/[()]/g, '\\$&')}.*kenney\\.nl.*CC0`), `${kit} is listed with its CC0 licence.`);
  }
  const build = await readFile(resolve(root, 'scripts/driving-pixel-sprites/render-page.js'), 'utf8');
  const kits = new Set([...build.matchAll(/'([a-z-]+)\/Models\//g)].map(match => match[1]));
  assert.deepEqual([...kits].sort(), ['car-kit', 'city-kit-commercial', 'city-kit-roads', 'mini-characters', 'nature-kit']);
  const textures = await readFile(resolve(gameRoot, 'textures/SOURCES.md'), 'utf8');
  assert.match(textures, /steering-wheel\.svg.*CC0/);
});

// The touch steering control uses the SVG as a CSS mask, which only scales
// an SVG that has a viewBox.
test('the steering wheel image scales to fill the touch control', async () => {
  const svg = await readFile(resolve(gameRoot, 'textures/steering-wheel.svg'), 'utf8');
  const viewBox = svg.match(/<svg[^>]*\sviewBox="([^"]+)"/)?.[1]?.trim().split(/[\s,]+/).map(Number);
  assert.ok(viewBox?.length === 4, 'The wheel SVG declares a viewBox.');
  const [x, y, w, h] = viewBox;
  assert.equal(w, h, 'The viewBox is square, like the control.');
  // Rim centre and radii from the Inkscape arc: (180, 224.4), 104.7 x 110, stroke about 20.
  assert.ok(Math.abs(x + w / 2 - 180) < 2 && Math.abs(y + h / 2 - 224.4) < 2, 'The viewBox is centred on the hub.');
  assert.ok(w / 2 >= 110 + 10 && w / 2 <= 130, 'The rim fills the viewBox without being clipped.');
});

// Vite's IIFE build resolves asset URLs against document.currentScript, which
// only points at the game script while the module first runs. A URL built
// later, after the player presses start, drops the assets/ folder.
test('image URLs are resolved when the game script loads, not when a trial starts', async () => {
  const source = await readFile(resolve(gameRoot, 'three-driving-rehab.ts'), 'utf8');
  const ast = ts.createSourceFile('driving.ts', source, ts.ScriptTarget.Latest, true);
  const lateUrls = [];
  function Visit(node, depth) {
    const isAssetUrl = ts.isNewExpression(node) && node.expression.getText(ast) === 'URL'
      && node.arguments?.[1]?.getText(ast) === 'import.meta.url';
    if (isAssetUrl && depth > 0) lateUrls.push(node.getText(ast));
    const inner = ts.isFunctionLike(node) || ts.isClassDeclaration(node) ? depth + 1 : depth;
    ts.forEachChild(node, child => Visit(child, inner));
  }
  Visit(ast, 0);
  assert.deepEqual(lateUrls, [], 'Asset URLs are module-level constants.');
  assert.match(source, /^const \w+ = new URL\('\.\/sprites\/driving-sprites\.png', import\.meta\.url\)\.href;$/m);
});

test('Space brakes like the brake key in both keyboard layouts', async () => {
  const runtimeClass = await LoadRuntimeMethods(['setKeyboardInput', 'shouldPreventKeyDefault']);
  for (const controlMode of ['arrow', 'wasd']) {
    const runtime = new runtimeClass();
    const brakes = [];
    Object.assign(runtime, {
      controlMode, keyState: { left: false, right: false, up: false, down: false },
      captureBrakeInputTimestamp: time => brakes.push(time), captureSteeringInputTimestamp() {},
    });
    assert.equal(runtime.shouldPreventKeyDefault('Space'), true);
    runtime.setKeyboardInput('Space', true, 100);
    assert.equal(runtime.keyState.down, true);
    runtime.setKeyboardInput('Space', true, 120);
    assert.deepEqual(brakes, [100], 'Holding Space records one brake press.');
    runtime.setKeyboardInput('Space', false, 300);
    assert.equal(runtime.keyState.down, false);
  }
});

test('cars behind slow down for the player and pass in the next lane', () => {
  const player = { distance: 200, lateral: 4.8, direction: 1, speed: 0, halfLength: 2.25, halfWidth: 1 };
  const sameLane = { distance: 165, lateral: 4.8, direction: 1, speed: 15, cruiseSpeed: 15, halfLength: 2.25, halfWidth: 1 };
  const nextLane = { distance: 165, lateral: 1.6, direction: 1, speed: 15, cruiseSpeed: 15, halfLength: 2.25, halfWidth: 1 };
  const dt = 1 / 120;
  let closest = Infinity;
  for (let step = 0; step < 120 * 20; step += 1) {
    for (const actor of [sameLane, nextLane]) {
      const gap = traffic.FindTrafficLeaderGap(actor, [player, sameLane, nextLane]);
      actor.speed = traffic.CalculateFollowingSpeed(actor.cruiseSpeed, gap?.gap ?? Infinity, gap?.leader.speed ?? 0, actor.speed, dt);
      actor.distance += actor.direction * actor.speed * dt;
    }
    closest = Math.min(closest, player.distance - sameLane.distance - player.halfLength - sameLane.halfLength);
  }
  assert.ok(closest >= traffic.minimumFollowingGap - 1e-6, `The car behind stops short of the player (closest gap ${closest.toFixed(2)} m).`);
  assert.ok(sameLane.speed < 0.05, 'It waits behind a stopped player.');
  assert.ok(nextLane.distance > player.distance + 20, 'A car in the next lane drives past.');
  const oncoming = { distance: 230, lateral: -4.8, direction: -1, speed: 9, cruiseSpeed: 9, halfLength: 2.25, halfWidth: 1 };
  assert.equal(traffic.FindTrafficLeaderGap(oncoming, [player]), null, 'Oncoming traffic does not queue behind the player.');
});

test('rear traffic starts behind the player and respawns behind once it is far away', () => {
  for (const start of [18, 30, 90]) {
    const plan = traffic.PlanRearTraffic(4, start);
    assert.equal(plan.length, 4);
    const placed = plan.filter(item => !item.waiting);
    assert.ok(placed.length >= 1, `${start} m: a car waits behind the player at the start.`);
    assert.ok(placed.some(item => start - item.distance <= 40), 'It is close enough to see in the mirrors.');
    assert.ok(placed.every(item => item.distance >= 4 && item.distance <= start - 8), 'Placed cars sit behind the player on the route.');
    const gaps = placed.map(item => item.distance).sort((a, b) => a - b).slice(1).map((distance, index) => distance - placed.map(item => item.distance).sort((a, b) => a - b)[index]);
    assert.ok(gaps.every(gap => gap >= 12), 'Placed cars never overlap.');
    assert.ok(plan.every(item => item.cruiseSpeed >= 12 && item.cruiseSpeed <= 17));
  }
  assert.equal(traffic.ShouldRespawnRearTraffic(400, 200), true, 'Far ahead.');
  assert.equal(traffic.ShouldRespawnRearTraffic(40, 200), true, 'Left far behind.');
  assert.equal(traffic.ShouldRespawnRearTraffic(180, 200), false);
  const respawn = traffic.CalculateRearSpawnDistance(200, 1);
  assert.ok(respawn < 200 - 30 && respawn > 200 - 120, 'Respawned cars come back from behind.');
  assert.equal(traffic.CalculateRearSpawnDistance(40, 0), null, 'No room behind yet, so the car keeps waiting.');
});

test('scooters collide with their own small footprint', async () => {
  const runtimeClass = await LoadRuntimeMethods(['getTrafficActorCollisionBox']);
  const runtime = new runtimeClass();
  const scooter = runtime.getTrafficActorCollisionBox({ kind: 'scooter', x: 1, z: 2, heading: 0.5 });
  const car = runtime.getTrafficActorCollisionBox({ kind: 'car', x: 1, z: 2, heading: 0.5 });
  assert.deepEqual(scooter, { centerX: 1, centerZ: 2, angle: 0.5, halfWidth: 0.55, halfLength: 0.95 });
  assert.deepEqual(car, { centerX: 1, centerZ: 2, angle: 0.5, halfWidth: 1.0, halfLength: 2.25 });
});

test('a car the player bumps while changing lanes never pins it in place', async () => {
  const dt = 1 / 120;
  let bumps = 0;
  for (const ahead of [0.5, 1.5, 2.5, 3.5]) {
    for (const steering of [-1, -0.5]) {
      for (const carSpeed of [6, 9]) {
        const runtime = await CreateDrivingWorld(0);
        const [carLane, playerLane] = runtime.getTravelLaneOffsets(runtime.route[0], 1);
        PlaceDrivingPlayer(runtime, 100 + ahead, playerLane, 8);
        AddDrivingCar(runtime, 100, carLane, carSpeed);
        let bumpedAt = null;
        for (let step = 0; step < 120 * 6; step += 1) {
          const time = step * dt * 1000;
          runtime.updateVehicleFree({ throttle: 0.6, brake: 0, steering: time < 900 ? steering : 0 }, dt, time);
          runtime.updateAmbientTraffic(dt);
          if (bumpedAt === null && runtime.eventResults.some(event => event.event_id === 'vehicle-collision')) bumpedAt = runtime.progress;
        }
        if (bumpedAt === null) continue;
        bumps += 1;
        assert.ok(runtime.progress - bumpedAt > 10, `${ahead} m ahead, steering ${steering}, car at ${carSpeed} m/s: the player drove ${(runtime.progress - bumpedAt).toFixed(1)} m after the bump.`);
      }
    }
  }
  assert.ok(bumps >= 4, `The cut-ins reach the other car (${bumps} bumps).`);
});

test('a car left overlapping the player lets it drive away', async () => {
  const dt = 1 / 120;
  for (const [behind, sideways] of [[3, 0], [2, 0.8], [0, 1.6]]) {
    const runtime = await CreateDrivingWorld(0);
    const lane = runtime.getDrivingLaneOffset(120);
    PlaceDrivingPlayer(runtime, 120, lane);
    AddDrivingCar(runtime, 120 - behind, lane - sideways);
    assert.equal(IsTouchingTraffic(runtime), true, 'The scene starts with the two cars overlapping.');
    for (let step = 0; step < 120 * 3; step += 1) {
      runtime.updateVehicleFree({ throttle: 1, brake: 0, steering: 0 }, dt, step * dt * 1000);
      runtime.updateAmbientTraffic(dt);
    }
    assert.ok(runtime.progress > 130, `Car ${behind} m behind and ${sideways} m aside: the player reached ${runtime.progress.toFixed(1)} m.`);
    assert.equal(IsTouchingTraffic(runtime), false);
  }
});

test('a lane reset never puts the player inside another car', async () => {
  const runtime = await CreateDrivingWorld(0);
  const lane = runtime.getDrivingLaneOffset(120);
  PlaceDrivingPlayer(runtime, 150, lane);
  AddDrivingCar(runtime, 121, lane, 9);
  runtime.applyLaneResetPose({ x: 0, z: 0, progress: 120, lateral: lane });
  assert.ok(Math.abs(runtime.progress - 120) < 0.5, 'The player is back at the reset point.');
  assert.equal(IsTouchingTraffic(runtime), false, 'No car is left on the reset point.');
});

test('ambient cars come back beyond the visible road, never in front of the player near the destination', async () => {
  const dt = 1 / 30;
  for (const variant of [0, 1, 2]) {
    const runtime = await CreateDrivingWorld(variant);
    const view = runtime.getMainDrawDistance();
    let distance = runtime.getInitialRouteDistance();
    PlaceDrivingPlayer(runtime, distance, runtime.getDrivingLaneOffset(distance), 12);
    runtime.createAmbientTraffic();
    const popIns = [];
    let returnedOncoming = 0;
    while (distance < runtime.routeLength - 2) {
      distance += 12 * dt;
      PlaceDrivingPlayer(runtime, distance, runtime.getDrivingLaneOffset(distance), 12);
      const before = runtime.ambientTrafficActors.map(actor => ({ waiting: actor.waiting, distance: actor.distance }));
      runtime.updateAmbientTraffic(dt);
      runtime.ambientTrafficActors.forEach((actor, index) => {
        const appeared = !actor.waiting && (before[index].waiting || Math.abs(actor.distance - before[index].distance) > 5);
        if (!appeared) return;
        const ahead = actor.distance - distance;
        if (ahead < view && ahead > -150) popIns.push(`${actor.direction === -1 ? 'oncoming' : 'same-direction'} car ${ahead.toFixed(0)} m ahead, ${(runtime.routeLength - distance).toFixed(0)} m from the destination`);
        if (actor.direction === -1) returnedOncoming += 1;
      });
    }
    assert.deepEqual(popIns, [], `Route ${variant}: cars appear only outside the ${view} m view and the mirrors.`);
    if (variant === 0) assert.ok(returnedOncoming > 0, 'Oncoming traffic keeps coming on a long route.');
  }
});
