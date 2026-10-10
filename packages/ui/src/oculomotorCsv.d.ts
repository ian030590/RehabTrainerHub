import type { OculomotorCsvPayload } from './saveOculomotorCsv';
export function IsOculomotorCsvPayload(value: unknown): value is OculomotorCsvPayload;
export function IsReferenceCsvPayload(value: unknown): value is { fileName: string; text: string };
