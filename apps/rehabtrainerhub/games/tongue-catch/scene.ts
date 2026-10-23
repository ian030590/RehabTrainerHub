import { Container, MeshRope, Point, Sprite, Texture, type Application } from 'pixi.js';
import { tonguePlay, type TongueSession } from './logic/tongueCatch';

export type ScenePalette = ReturnType<typeof ReadScenePalette>;
export type TongueScene = ReturnType<typeof CreateTongueScene>;

// Pixi draws with the colors defined in game.css.
export function ReadScenePalette(element: Element) {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(`--tongue-${name}`).trim();
  return { ropeLight: token('rope-light'), ropeDark: token('rope-dark'), ropeEdge: token('rope-edge'), ropeShine: token('rope-shine') };
}

// The original rope texture: a rounded bar shaded from light to dark with a shine along the top.
function CreateRopeTexture(palette: ScenePalette) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, palette.ropeLight);
    gradient.addColorStop(1, palette.ropeDark);
    context.fillStyle = gradient;
    context.beginPath();
    context.roundRect(1, 2, 94, 28, 14);
    context.fill();
    context.strokeStyle = palette.ropeEdge;
    context.lineWidth = 2;
    context.stroke();
    context.beginPath();
    context.moveTo(10, 11);
    context.lineTo(84, 11);
    context.strokeStyle = palette.ropeShine;
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.stroke();
  }
  return Texture.from(canvas);
}

export function CreateTongueScene(app: Application, appleTexture: Texture, palette: ScenePalette) {
  const root = new Container();
  const ropeTexture = CreateRopeTexture(palette);
  const points = Array.from({ length: tonguePlay.tongueSegments }, () => new Point(app.screen.width / 2, app.screen.height * tonguePlay.startY));
  const tongue = new MeshRope({ texture: ropeTexture, points, width: tonguePlay.tongueWidth });
  tongue.visible = false;
  root.addChild(tongue);
  app.stage.addChild(root);
  return { root, tongue, points, ropeTexture, appleTexture, apples: new Map<number, Sprite>() };
}

// Mirrors the session: the rope follows its points, and each falling apple has one sprite.
export function DrawTongueScene(scene: TongueScene, session: TongueSession | null) {
  scene.points.forEach((point, index) => point.set(session?.points[index].x ?? point.x, session?.points[index].y ?? point.y));
  scene.tongue.visible = Boolean(session?.tongueVisible);
  const live = new Set(session?.apples.map(apple => apple.id) ?? []);
  for (const [id, sprite] of scene.apples) {
    if (live.has(id)) continue;
    sprite.destroy();
    scene.apples.delete(id);
  }
  for (const apple of session?.apples ?? []) {
    let sprite = scene.apples.get(apple.id);
    if (!sprite) {
      sprite = new Sprite({ texture: scene.appleTexture, anchor: 0.5, width: apple.size, height: apple.size });
      scene.apples.set(apple.id, sprite);
      scene.root.addChild(sprite);
    }
    sprite.position.set(apple.x, apple.y);
    sprite.rotation = apple.rotation;
  }
}

export function DestroyTongueScene(scene: TongueScene) {
  scene.apples.clear();
  scene.root.removeFromParent();
  scene.root.destroy({ children: true });
  scene.ropeTexture.destroy(true);
}
