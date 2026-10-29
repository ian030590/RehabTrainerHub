export type RawCoordinateKind = 'hand' | 'pose' | 'tongue' | 'head';
export type RawCoordinateFile = { kind: RawCoordinateKind; csv: string; rows: number; truncated: boolean };
export const rawCoordinateColumns: Readonly<Record<RawCoordinateKind, readonly string[]>>;
export function CreateRawCoordinateRecorder(kinds: RawCoordinateKind[]): {
  Record(kind: string, message: { type: string; payload: unknown }): void;
  Files(): RawCoordinateFile[];
  Reset(): void;
};
export function ValidateRawCoordinateCsv(kind: RawCoordinateKind, csv: string): number | null;
