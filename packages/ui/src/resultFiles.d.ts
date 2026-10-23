export interface ResultFile { fileName: string; text: string }
export const ufovTrialColumns: readonly string[];
export function IsUfovResultFileName(fileName: unknown): fileName is string;
export function IsUfovResultFile(value: unknown): value is ResultFile;
export function StageResultFile(files: Map<string, string>, file: ResultFile): void;
export function ResultFileMimeType(fileName: string): string;
export function DownloadResultFile(fileName: string, text: string): void;
