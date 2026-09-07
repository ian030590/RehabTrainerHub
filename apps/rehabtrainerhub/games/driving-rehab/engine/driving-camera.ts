export type DrivingCameraMode = 'third-person' | 'first-person';

export interface DrivingCameraPose {
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
  up: { x: 0; y: 1; z: 0 };
  fov: number;
}

export interface DrivingCameraPoseInput {
  vehicleX: number;
  vehicleZ: number;
  vehicleHeading: number;
  mode: DrivingCameraMode;
}

const firstPersonForwardOffset = 0.45;
const firstPersonHeight = 2.05;
const firstPersonLookAhead = 35;
const firstPersonLookHeight = 1.65;
const firstPersonFov = 68;
const thirdPersonDistance = 9;
const thirdPersonHeight = 3.35;
const thirdPersonLookAhead = 10.5;
const thirdPersonLookHeight = 1.45;
const thirdPersonFov = 65;

/**
 * A deterministic camera rig expressed only in vehicle/world coordinates.
 * Aspect ratio, DPR, quality, frame rate, speed, and braking never enter this
 * calculation, so they cannot tilt, crop, bob, or zoom the driving view.
 */
export function CalculateDrivingCameraPose({
  vehicleX,
  vehicleZ,
  vehicleHeading,
  mode,
}: DrivingCameraPoseInput): DrivingCameraPose {
  const forwardX = Math.sin(vehicleHeading);
  const forwardZ = -Math.cos(vehicleHeading);

  if (mode === 'third-person') {
    return {
      position: {
        x: vehicleX - forwardX * thirdPersonDistance,
        y: thirdPersonHeight,
        z: vehicleZ - forwardZ * thirdPersonDistance,
      },
      lookAt: {
        x: vehicleX + forwardX * thirdPersonLookAhead,
        y: thirdPersonLookHeight,
        z: vehicleZ + forwardZ * thirdPersonLookAhead,
      },
      up: { x: 0, y: 1, z: 0 },
      fov: thirdPersonFov,
    };
  }

  return {
    position: {
      x: vehicleX + forwardX * firstPersonForwardOffset,
      y: firstPersonHeight,
      z: vehicleZ + forwardZ * firstPersonForwardOffset,
    },
    lookAt: {
      x: vehicleX + forwardX * firstPersonLookAhead,
      y: firstPersonLookHeight,
      z: vehicleZ + forwardZ * firstPersonLookAhead,
    },
    up: { x: 0, y: 1, z: 0 },
    fov: firstPersonFov,
  };
}
