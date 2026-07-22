import { ToCsvCell } from './csv';

type JsPsychDataWriter = {
  data?: {
    write?: (data: unknown) => void;
  };
};

export const csvCell = ToCsvCell;

export function Clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function FormatTestDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function WriteJsPsychData(
  jsPsychRef: { current: unknown },
  record: Record<string, unknown>,
  warningMessage: string,
): void {
  try {
    const jsPsychData = (jsPsychRef.current as JsPsychDataWriter | null)?.data;
    jsPsychData?.write?.call(jsPsychData, record);
  } catch (error) {
    console.warn(warningMessage, error);
  }
}
