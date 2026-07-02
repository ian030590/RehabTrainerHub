/**
 * Spatial utility functions.
 * Pixel↔mm↔degree conversions based on calibration.
 */
import { getSetting, getMMPerPixel, getPixelsPerMM } from './settings';

/** Convert visual degrees to pixels given current calibration and distance */
export function pixelFromDegree(degs: number): number {
  const mm = Math.tan((degs * Math.PI) / 180) * 10 * getSetting('distanceInCM');
  return pixelFromMillimeter(mm);
}

/** Convert pixels to visual degrees */
export function degreeFromPixel(pixel: number): number {
  return (180 / Math.PI) * Math.atan2(millimeterFromPixel(pixel), getSetting('distanceInCM') * 10);
}

/** Convert millimeters to pixels */
export function pixelFromMillimeter(mm: number): number {
  return mm * getPixelsPerMM();
}

/** Convert pixels to millimeters */
export function millimeterFromPixel(pixel: number): number {
  return pixel * getMMPerPixel();
}
