import { CreateCsvContent } from '@rehab-trainer/ui/csv';
import { DownloadCsvFile } from '@rehab-trainer/ui/downloadFile';
import { GetSetting } from '@rehab-trainer/ui/settings';

export function DownloadTrainingCsv({ results, userName, moduleId, difficulty, t }: any) {
  if (results.length === 0) return;
  const prefix = GetSetting('downloadDirectory');
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false }).replace(/:/g, '');
  const headers = [t('exp.csv.user'), t('exp.csv.date'), t('exp.csv.time'), t('exp.csv.module'), t('exp.csv.diff'), t('exp.csv.round'), t('exp.csv.target'), t('exp.csv.response'), t('exp.csv.correct'), t('exp.csv.rt')];
  const rows = results.map((result: any, i: number) => [
    userName,
    dateStr,
    timeStr,
    moduleId,
    difficulty,
    i + 1,
    result.target,
    result.response,
    result.correct ? '✓' : '✗',
    result.rt,
  ]);
  const csvContent = CreateCsvContent([headers, ...rows]);
  DownloadCsvFile(csvContent, `${prefix ? prefix + '_' : ''}${userName}_${moduleId}_${dateStr}.csv`);
}
