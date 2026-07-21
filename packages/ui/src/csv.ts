export const csvUtf8Bom = '\uFEFF';

export type CsvCellValue = unknown;
export type CsvRow = CsvCellValue[];

export function ToCsvCell(value: CsvCellValue): string {
  if (value === null || value === undefined) return '';

  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (!/[",\r\n]/.test(text)) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

export function CreateCsvContent(rows: CsvRow[]): string {
  return rows.map((row) => row.map(ToCsvCell).join(',')).join('\n');
}

export function EnsureCsvUtf8Bom(content: string): string {
  return content.startsWith(csvUtf8Bom) ? content : `${csvUtf8Bom}${content}`;
}
