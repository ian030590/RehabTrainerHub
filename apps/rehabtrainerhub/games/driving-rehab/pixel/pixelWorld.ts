// Static scene description for the pixel renderer: flat ground shapes,
// building boxes and upright sprites. Collision boxes stay in the runtime.

export interface GroundPoint {
  x: number;
  z: number;
}

export interface GroundShape {
  points: GroundPoint[];
  color: number;
  layer: number;
  x: number;
  z: number;
  radius: number;
}

export interface WallFace {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  normalX: number;
  normalZ: number;
  frame: string;
  shade: number;
}

export interface BuildingShape {
  x: number;
  z: number;
  radius: number;
  height: number;
  faces: WallFace[];
}

export interface PropShape {
  x: number;
  z: number;
  frame?: string;
  // Flips the sprite, so a street light's arm can reach over the road.
  mirrored?: boolean;
  // Intersection index whose signal state picks the traffic-light frame.
  signal?: number;
  // Code-drawn sprite, in pixels per metre, anchored at its bottom centre.
  canvas?: HTMLCanvasElement;
  canvasPpm?: number;
}

export interface PixelWorld {
  ground: GroundShape[];
  buildings: BuildingShape[];
  props: PropShape[];
}

export interface BuildingBox {
  centerX: number;
  centerZ: number;
  angle: number;
  halfWidth: number;
  halfLength: number;
}

// Ground layers, drawn in this order.
export const groundLayer = { lot: 0, sidewalk: 1, curb: 2, asphalt: 3, paint: 4 } as const;

const sun = { x: -0.6, z: -0.8 };

export class PixelWorldBuilder {
  private readonly world: PixelWorld = { ground: [], buildings: [], props: [] };

  // Quad along a direction: `along` runs from `from` to `to` metres past the
  // origin, `across` from `left` to `right` metres on the normal.
  addStrip(origin: GroundPoint, dir: GroundPoint, normal: GroundPoint, from: number, to: number, left: number, right: number, color: number, layer: number) {
    const points = [
      { x: origin.x + dir.x * from + normal.x * left, z: origin.z + dir.z * from + normal.z * left },
      { x: origin.x + dir.x * to + normal.x * left, z: origin.z + dir.z * to + normal.z * left },
      { x: origin.x + dir.x * to + normal.x * right, z: origin.z + dir.z * to + normal.z * right },
      { x: origin.x + dir.x * from + normal.x * right, z: origin.z + dir.z * from + normal.z * right },
    ];
    this.addPolygon(points, color, layer);
  }

  addPolygon(points: GroundPoint[], color: number, layer: number) {
    const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const z = points.reduce((sum, point) => sum + point.z, 0) / points.length;
    const radius = Math.max(...points.map(point => Math.hypot(point.x - x, point.z - z)));
    this.world.ground.push({ points, color, layer, x, z, radius });
  }

  // The face nearest the road gets the storefront texture, the others the side one.
  addBuilding(box: BuildingBox, height: number, facadeId: string, road: GroundPoint) {
    const forward = { x: Math.sin(box.angle), z: -Math.cos(box.angle) };
    const right = { x: Math.cos(box.angle), z: Math.sin(box.angle) };
    const corner = (along: number, across: number) => ({
      x: box.centerX + forward.x * along * box.halfLength + right.x * across * box.halfWidth,
      z: box.centerZ + forward.z * along * box.halfLength + right.z * across * box.halfWidth,
    });
    const corners = [corner(1, -1), corner(1, 1), corner(-1, 1), corner(-1, -1)];
    const toRoad = { x: road.x - box.centerX, z: road.z - box.centerZ };
    const faces: WallFace[] = corners.map((a, index) => {
      const b = corners[(index + 1) % corners.length];
      const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      // Corners run clockwise seen from above, so the outward normal is on the left.
      const normalX = (b.z - a.z) / length;
      const normalZ = -(b.x - a.x) / length;
      return { ax: a.x, az: a.z, bx: b.x, bz: b.z, normalX, normalZ, frame: '', shade: 0.38 * (1 - Math.max(0, normalX * sun.x + normalZ * sun.z)) };
    });
    const front = faces.reduce((best, face) => (
      face.normalX * toRoad.x + face.normalZ * toRoad.z > best.normalX * toRoad.x + best.normalZ * toRoad.z ? face : best
    ));
    for (const face of faces) face.frame = `facade/${facadeId}/${face === front ? 'front' : 'side'}`;
    this.world.buildings.push({
      x: box.centerX,
      z: box.centerZ,
      radius: Math.hypot(box.halfWidth, box.halfLength),
      height,
      faces,
    });
  }

  addProp(prop: PropShape) {
    this.world.props.push(prop);
  }

  finish(): PixelWorld {
    this.world.ground.sort((left, right) => left.layer - right.layer);
    return this.world;
  }
}
