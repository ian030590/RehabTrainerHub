export const CSV_UTF8_BOM = '\uFEFF';

export type CsvCellValue = unknown;
export type CsvRow = CsvCellValue[];

export function toCsvCell(value: CsvCellValue): string {
  if (value === null || value === undefined) return '';

  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (!/[",\r\n]/.test(text)) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

export function createCsvContent(rows: CsvRow[]): string {
  return rows.map((row) => row.map(toCsvCell).join(',')).join('\n');
}

export function ensureCsvUtf8Bom(content: string): string {
  return content.startsWith(CSV_UTF8_BOM) ? content : `${CSV_UTF8_BOM}${content}`;
}
