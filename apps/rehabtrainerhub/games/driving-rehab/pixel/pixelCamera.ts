// Camera maths for the pixel renderer. World axes match the simulation:
// x right, y up, z towards the viewer; heading 0 drives towards -z.

export interface PixelVector3 {
  x: number;
  y: number;
  z: number;
}

export interface PixelCameraPose {
  position: PixelVector3;
  lookAt: PixelVector3;
  fov: number;
}

export interface PixelCameraInput extends PixelCameraPose {
  width: number;
  height: number;
  near?: number;
  mirrored?: boolean;
}

export interface PixelCamera {
  x: number;
  y: number;
  z: number;
  rightX: number;
  rightY: number;
  rightZ: number;
  upX: number;
  upY: number;
  upZ: number;
  forwardX: number;
  forwardY: number;
  forwardZ: number;
  focal: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  near: number;
  mirrored: boolean;
}

export interface ProjectedPixelPoint {
  x: number;
  y: number;
  depth: number;
}

export type RearviewMirrorId = 'center' | 'left' | 'right';

// Distance from the car centreline to the driver's eye in a left-hand-drive car.
export const driverEyeLeftOffset = 0.36;

export function CreatePixelCamera({ position, lookAt, fov, width, height, near = 0.25, mirrored = false }: PixelCameraInput): PixelCamera {
  let forwardX = lookAt.x - position.x;
  let forwardY = lookAt.y - position.y;
  let forwardZ = lookAt.z - position.z;
  const forwardLength = Math.hypot(forwardX, forwardY, forwardZ) || 1;
  forwardX /= forwardLength;
  forwardY /= forwardLength;
  forwardZ /= forwardLength;
  // right = forward x worldUp, up = right x forward
  let rightX = -forwardZ;
  let rightZ = forwardX;
  const rightLength = Math.hypot(rightX, rightZ) || 1;
  rightX /= rightLength;
  rightZ /= rightLength;
  const upX = -rightZ * forwardY;
  const upY = rightZ * forwardX - rightX * forwardZ;
  const upZ = rightX * forwardY;
  return {
    x: position.x,
    y: position.y,
    z: position.z,
    rightX,
    rightY: 0,
    rightZ,
    upX,
    upY,
    upZ,
    forwardX,
    forwardY,
    forwardZ,
    focal: (height / 2) / Math.tan((fov * Math.PI) / 360),
    centerX: width / 2,
    centerY: height / 2,
    width,
    height,
    near,
    mirrored,
  };
}

export function ProjectPixelPoint(camera: PixelCamera, x: number, y: number, z: number): ProjectedPixelPoint | null {
  const dx = x - camera.x;
  const dy = y - camera.y;
  const dz = z - camera.z;
  const depth = dx * camera.forwardX + dy * camera.forwardY + dz * camera.forwardZ;
  if (depth < camera.near) return null;
  const side = dx * camera.rightX + dz * camera.rightZ;
  const lift = dx * camera.upX + dy * camera.upY + dz * camera.upZ;
  const screenX = camera.centerX + (side * camera.focal) / depth;
  return {
    x: camera.mirrored ? camera.width - screenX : screenX,
    y: camera.centerY - (lift * camera.focal) / depth,
    depth,
  };
}

export function CalculateDriverEyePose<T extends PixelCameraPose>(pose: T, vehicleHeading: number): T {
  const leftX = -Math.cos(vehicleHeading) * driverEyeLeftOffset;
  const leftZ = -Math.sin(vehicleHeading) * driverEyeLeftOffset;
  return {
    ...pose,
    position: { ...pose.position, x: pose.position.x + leftX, z: pose.position.z + leftZ },
    lookAt: { ...pose.lookAt, x: pose.lookAt.x + leftX, z: pose.lookAt.z + leftZ },
  };
}

const rearviewMirrors: Record<RearviewMirrorId, { side: number; forward: number; height: number; outward: number; fov: number }> = {
  center: { side: 0, forward: 0.95, height: 2.2, outward: 0, fov: 20 },
  left: { side: -1.05, forward: 0.8, height: 1.6, outward: 0.24, fov: 30 },
  right: { side: 1.05, forward: 0.8, height: 1.6, outward: 0.24, fov: 30 },
};

// Each mirror is a backwards camera. Callers flip the picture horizontally,
// as a mirror does, by creating the camera with mirrored: true.
export function CalculateRearviewCameraPose({ vehicleX, vehicleZ, vehicleHeading, mirror }: {
  vehicleX: number;
  vehicleZ: number;
  vehicleHeading: number;
  mirror: RearviewMirrorId;
}): PixelCameraPose {
  const setup = rearviewMirrors[mirror];
  const forwardX = Math.sin(vehicleHeading);
  const forwardZ = -Math.cos(vehicleHeading);
  const rightX = Math.cos(vehicleHeading);
  const rightZ = Math.sin(vehicleHeading);
  const position = {
    x: vehicleX + forwardX * setup.forward + rightX * setup.side,
    y: setup.height,
    z: vehicleZ + forwardZ * setup.forward + rightZ * setup.side,
  };
  const outward = Math.sign(setup.side) * Math.tan(setup.outward);
  const lookDistance = 60;
  return {
    position,
    lookAt: {
      x: position.x + (-forwardX + rightX * outward) * lookDistance,
      y: 1.25,
      z: position.z + (-forwardZ + rightZ * outward) * lookDistance,
    },
    fov: setup.fov,
  };
}

// Vehicle sprites have five views: 0 front, 1 front-left, 2 left side,
// 3 rear-left and 4 rear. Views from the right reuse the left ones flipped.
export function SelectVehicleSpriteView(
  cameraX: number,
  cameraZ: number,
  vehicleX: number,
  vehicleZ: number,
  vehicleHeading: number,
): { index: number; mirrored: boolean } {
  const offsetX = cameraX - vehicleX;
  const offsetZ = cameraZ - vehicleZ;
  const forward = offsetX * Math.sin(vehicleHeading) - offsetZ * Math.cos(vehicleHeading);
  const left = -(offsetX * Math.cos(vehicleHeading) + offsetZ * Math.sin(vehicleHeading));
  const angle = Math.atan2(left, forward);
  const index = Math.min(4, Math.round(Math.abs(angle) / (Math.PI / 4)));
  return { index, mirrored: index > 0 && index < 4 && angle < 0 };
}
