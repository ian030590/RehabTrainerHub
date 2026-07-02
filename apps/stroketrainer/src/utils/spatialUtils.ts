import { getPixelsPerMM } from './settings';

export function pixelFromMillimeter(mm: number): number {
  return mm * getPixelsPerMM();
}
