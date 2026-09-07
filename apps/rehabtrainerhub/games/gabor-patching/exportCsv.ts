import { CreateCsvContent } from '@rehab-trainer/ui/csv';
import { DownloadCsvFile } from '@rehab-trainer/ui/downloadFile';
import { GetSetting } from '@rehab-trainer/ui/settings';

export function DownloadTrainingCsv({ results, userName, moduleId, t }: any) {
  if (results.length === 0) return;
  const prefix = GetSetting('downloadDirectory');
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false }).replace(/:/g, '');
  const headers = [t('exp.csv.user'), t('exp.csv.date'), t('exp.csv.time'), t('exp.csv.module'), t('exp.csv.duration'), t('exp.csv.score'), t('exp.csv.acquired')];
  const rows = results.map((result: any) => [userName, dateStr, timeStr, moduleId, result.duration_ms ?? result.rt, result.score ?? 0, result.acquired_targets ?? 0]);
  const csvContent = CreateCsvContent([headers, ...rows]);
  DownloadCsvFile(csvContent, `${prefix ? prefix + '_' : ''}${userName}_${moduleId}_${dateStr}.csv`);
}
