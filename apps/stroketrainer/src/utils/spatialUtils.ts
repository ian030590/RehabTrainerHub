import { GetPixelsPerMM } from './settings';

export function PixelFromMillimeter(mm: number): number {
  return mm * GetPixelsPerMM();
}
