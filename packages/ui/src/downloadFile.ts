export function DownloadFile(
  content: string | Blob,
  filename: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  if (typeof window === 'undefined') return;
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DownloadCsvFile(csvContent: string, filename: string): void {
  DownloadFile(csvContent, filename, 'text/csv;charset=utf-8');
}
