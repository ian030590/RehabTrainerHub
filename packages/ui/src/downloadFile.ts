import { EnsureCsvUtf8Bom } from './csv';

export function DownloadFile(
  content: BlobPart | BlobPart[],
  filename: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  const blobParts = Array.isArray(content) ? content : [content];
  const blob = new Blob(blobParts, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function DownloadCsvFile(csvContent: string, filename: string): void {
  DownloadFile(EnsureCsvUtf8Bom(csvContent), filename, 'text/csv;charset=utf-8');
}
