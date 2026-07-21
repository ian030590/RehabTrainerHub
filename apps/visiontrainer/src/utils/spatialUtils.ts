/**
 * Spatial utility functions.
 * Pixel↔mm↔degree conversions based on calibration.
 */
import { GetSetting, GetMMPerPixel, GetPixelsPerMM } from './settings';

/** Convert visual degrees to pixels given current calibration and distance */
export function PixelFromDegree(degs: number): number {
  const mm = Math.tan((degs * Math.PI) / 180) * 10 * GetSetting('distanceInCM');
  return PixelFromMillimeter(mm);
}

/** Convert pixels to visual degrees */
export function DegreeFromPixel(pixel: number): number {
  return (180 / Math.PI) * Math.atan2(MillimeterFromPixel(pixel), GetSetting('distanceInCM') * 10);
}

/** Convert millimeters to pixels */
export function PixelFromMillimeter(mm: number): number {
  return mm * GetPixelsPerMM();
}

/** Convert pixels to millimeters */
export function MillimeterFromPixel(pixel: number): number {
  return pixel * GetMMPerPixel();
}
