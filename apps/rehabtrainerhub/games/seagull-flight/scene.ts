import {
  BufferGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, Float32BufferAttribute, Fog,
  Group, HemisphereLight, IcosahedronGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PerspectiveCamera, PlaneGeometry, Scene, SphereGeometry, TorusGeometry, WebGLRenderer,
} from 'three';
import { flight, type FlightSession } from './logic/flight';

// Both lane axes share the same scale so the visible ring matches the circular hit area.
const laneScale = 8;
const speed = 9;

export function CreateSeagullScene(root: HTMLElement, host: HTMLElement) {
  const color = (name: string) => new Color(getComputedStyle(root).getPropertyValue(`--seagull-${name}`).trim());
  const scene = new Scene();
  scene.background = color('sky');
  scene.fog = new Fog(color('sky'), 65, 165);
  const camera = new PerspectiveCamera(48, 1, 0.1, 220);
  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'seagull-canvas';
  host.appendChild(renderer.domElement);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<MeshStandardMaterial | MeshBasicMaterial>();
  const geometry = <T extends BufferGeometry>(value: T) => { geometries.add(value); return value; };
  const material = (name: string) => {
    const value = new MeshStandardMaterial({ color: color(name), flatShading: true, roughness: 1 });
    materials.add(value);
    return value;
  };
  const basic = (name: string) => {
    const value = new MeshBasicMaterial({ color: color(name), depthTest: false });
    materials.add(value);
    return value;
  };
  const bodyMaterial = material('body');
  const wingMaterial = material('wing');
  const tipMaterial = material('wingtip');
  const beakMaterial = material('beak');
  const ringMaterial = material('ring');
  const passedMaterial = material('ring-passed');
  const cloudMaterial = material('cloud');
  scene.add(new HemisphereLight(color('light'), color('sea'), 2.5));
  const sun = new DirectionalLight(color('light'), 3);
  sun.position.set(-20, 40, 15);
  scene.add(sun);

  const seaGeometry = geometry(new PlaneGeometry(300, 320, 36, 40).rotateX(-Math.PI / 2).toNonIndexed());
  const sea = new Mesh(seaGeometry, material('sea'));
  sea.position.z = -90;
  scene.add(sea);
  const seaPositions = seaGeometry.getAttribute('position');
  const seaBase = Float32Array.from(seaPositions.array);
  const cloudGeometry = geometry(new IcosahedronGeometry(1, 0));
  const clouds = new Group();
  for (let index = 0; index < 8; index++) {
    const cloud = new Group();
    for (let part = 0; part < 3; part++) {
      const puff = new Mesh(cloudGeometry, cloudMaterial);
      puff.position.set(part * 2, part % 2 * 0.5, 0);
      puff.scale.set(2.4, 0.7 + part % 2 * 0.4, 1.2);
      cloud.add(puff);
    }
    cloud.position.set((index % 2 ? 1 : -1) * (18 + index * 3), 14 + index % 3 * 3, -25 - index * 18);
    clouds.add(cloud);
  }
  scene.add(clouds);
  const rockMaterial = material('rock');
  for (let index = 0; index < 10; index++) {
    const rock = new Mesh(cloudGeometry, rockMaterial);
    rock.scale.set(2 + index % 3, 1 + index % 2, 3);
    rock.position.set((index % 2 ? 1 : -1) * (20 + index % 3 * 5), 0, -10 - index * 17);
    scene.add(rock);
  }

  const gull = new Group();
  const body = new Mesh(geometry(new SphereGeometry(0.6, 7, 5)), bodyMaterial);
  body.scale.set(0.65, 0.65, 1.5);
  gull.add(body);
  const head = new Mesh(geometry(new IcosahedronGeometry(0.32, 1)), bodyMaterial);
  head.position.set(0, 0.22, -0.75);
  gull.add(head);
  const beak = new Mesh(geometry(new ConeGeometry(0.13, 0.48, 4)), beakMaterial);
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.2, -1.12);
  gull.add(beak);
  const tail = new Mesh(geometry(new ConeGeometry(0.44, 0.8, 3)), wingMaterial);
  tail.rotation.x = Math.PI / 2;
  tail.scale.z = 0.25;
  tail.position.set(0, 0, 1);
  gull.add(tail);
  const WingGeometry = (length: number, width: number) => {
    const value = new BufferGeometry();
    value.setAttribute('position', new Float32BufferAttribute([
      0, 0, -width, length, 0, 0, 0, 0, width,
      0, 0, width, length, 0, 0, 0, 0.12, 0,
      0, 0.12, 0, length, 0, 0, 0, 0, -width,
      0, 0, -width, 0, 0, width, 0, 0.12, 0,
    ], 3));
    value.computeVertexNormals();
    return geometry(value);
  };
  const innerGeometry = WingGeometry(1.25, 0.45);
  const outerGeometry = WingGeometry(1.3, 0.3);
  const wings = [-1, 1].map(side => {
    const inner = new Group();
    inner.position.set(side * 0.25, 0.1, 0);
    inner.scale.x = side;
    inner.add(new Mesh(innerGeometry, wingMaterial));
    const outer = new Group();
    outer.position.x = 1.2;
    outer.add(new Mesh(outerGeometry, tipMaterial));
    inner.add(outer);
    gull.add(inner);
    return { inner, outer, side };
  });
  scene.add(gull);

  // A billboard follows the back, independently of the bank, so the fixation mark stays upright.
  const fixation = new Group();
  const crossMaterial = basic('fixation');
  const outlineMaterial = basic('body');
  for (const [width, height] of [[0.46, 0.14], [0.14, 0.46]]) {
    const outline = new Mesh(geometry(new PlaneGeometry(width + 0.1, height + 0.1)), outlineMaterial);
    outline.renderOrder = 8;
    fixation.add(outline);
    const bar = new Mesh(geometry(new PlaneGeometry(width, height)), crossMaterial);
    bar.position.z = 0.01;
    bar.renderOrder = 9;
    fixation.add(bar);
  }
  scene.add(fixation);
  const ringGeometry = geometry(new TorusGeometry(flight.ringRadius * laneScale, 0.12, 5, 24));
  const buoyGeometry = geometry(new ConeGeometry(0.3, 0.65, 5));
  const poleGeometry = geometry(new CylinderGeometry(0.04, 0.04, 1.3, 4));
  const rings = new Map<number, { group: Group; torus: Mesh }>();
  const splash = new Group();
  const dropGeometry = geometry(new IcosahedronGeometry(0.17, 0));
  for (let index = 0; index < 20; index++) splash.add(new Mesh(dropGeometry, cloudMaterial));
  splash.visible = false;
  scene.add(splash);
  let decorationClock = 0;
  let crashClock = 0;
  let disposed = false;

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    const halfLane = laneScale * (1 + flight.ringRadius) + 1.5;
    const laneDistance = halfLane / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
    camera.position.set(0, 8.5, Math.max(19, laneDistance));
    camera.lookAt(0, 5, -26);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  const update = (session: FlightSession, dt: number) => {
    if (disposed) return;
    if (!reducedMotion.matches && !session.frozen) decorationClock += dt;
    if (!reducedMotion.matches) {
      for (let index = 0; index < seaPositions.count; index++) {
        const x = seaBase[index * 3];
        const z = seaBase[index * 3 + 2];
        seaPositions.setY(index, Math.sin(x * 0.21 + decorationClock * 0.7) * 0.13 + Math.cos(z * 0.17 + decorationClock * 0.5) * 0.12);
      }
      seaPositions.needsUpdate = true;
      seaGeometry.computeVertexNormals();
      clouds.position.x = Math.sin(decorationClock * 0.04) * 2;
    }
    gull.position.set(session.x * laneScale, session.altitude * laneScale + 0.4, 0);
    gull.rotation.z = Math.max(-0.5, Math.min(0.5, -session.velocityX * 0.16));
    const flapAge = session.clock - session.lastFlapClock;
    const flap = flapAge < 0.55 ? Math.sin(flapAge / 0.55 * Math.PI * 2) * 0.85 : 0.08;
    wings.forEach(({ inner, outer, side }) => { inner.rotation.z = flap * side; outer.rotation.z = flap * 0.45; });
    fixation.position.copy(gull.position);
    fixation.position.y += 0.5;
    fixation.position.z += 0.15;
    fixation.quaternion.copy(camera.quaternion);
    const visible = [...session.rings, ...session.results.filter(ring => session.elapsed - ring.at < 2.5)];
    const active = new Set(visible.map(ring => ring.index));
    for (const [index, entry] of rings) if (!active.has(index)) { scene.remove(entry.group); rings.delete(index); }
    for (const ring of visible) {
      let entry = rings.get(ring.index);
      if (!entry) {
        const group = new Group();
        const torus = new Mesh(ringGeometry, ringMaterial);
        torus.position.y = flight.ringAltitude * laneScale + 0.4;
        const buoy = new Mesh(buoyGeometry, ringMaterial);
        buoy.position.y = 0.32;
        const pole = new Mesh(poleGeometry, tipMaterial);
        pole.position.y = 1.15;
        group.add(torus, buoy, pole);
        scene.add(group);
        entry = { group, torus };
        rings.set(ring.index, entry);
      }
      entry.group.position.set(ring.x * laneScale, 0, -(ring.at - session.elapsed) * speed);
      entry.torus.material = 'passed' in ring && ring.passed ? passedMaterial : ringMaterial;
    }
    if (session.crashed) {
      crashClock += dt;
      splash.visible = true;
      splash.position.set(gull.position.x, 0.2, 0);
      splash.children.forEach((drop, index) => {
        const angle = index / splash.children.length * Math.PI * 2;
        const distance = crashClock * (1.5 + index % 3 * 0.4);
        drop.position.set(Math.cos(angle) * distance, Math.max(0, crashClock * 4 - crashClock ** 2 * 3), Math.sin(angle) * distance);
        drop.scale.setScalar(Math.max(0, 1 - crashClock / 1.3));
      });
    } else { crashClock = 0; splash.visible = false; }
    gull.visible = !session.crashed;
    fixation.visible = !session.crashed;
    renderer.render(scene, camera);
  };
  const dispose = () => {
    disposed = true;
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    renderer.dispose();
    renderer.domElement.remove();
    scene.clear();
  };
  resize();
  return { update, resize, dispose };
}
export type SeagullScene = ReturnType<typeof CreateSeagullScene>;
