import { ToCsvCell } from '@rehab-trainer/ui/csv';

export const csvCell = ToCsvCell;
export function Clamp(value: number, min: number, max: number): number { return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min; }
export function FormatTestDate(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function WriteJsPsychData(ref: { current: unknown }, record: Record<string, unknown>, warning: string) {
  try { ((ref.current as { data?: { write?: (data: unknown) => void } } | null)?.data?.write)?.(record); } catch (error) { console.warn(warning, error); }
}
