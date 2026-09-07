import { CreateCsvContent } from '@rehab-trainer/ui/csv';
import { DownloadCsvFile } from '@rehab-trainer/ui/downloadFile';
import { GetSetting } from '@rehab-trainer/ui/settings';

export function DownloadTrainingCsv({ results, userName, moduleId, t }: any) {
  if (results.length === 0) return;
  const prefix = GetSetting('downloadDirectory');
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false }).replace(/:/g, '');
  const headers = [t('exp.csv.user'), t('exp.csv.date'), t('exp.csv.time'), t('exp.csv.module'), 'WPS', 'Crowding', t('exp.csv.target'), t('exp.csv.response'), t('exp.csv.correct'), t('exp.csv.rt')];
  const rows = results.map((result: any) => {
    const baseRow = [userName, dateStr, timeStr, moduleId];
    if (result.trial_type === 'html-button-response') {
      return [...baseRow, GetSetting('readingWPS'), GetSetting('readingCrowding'), result.target, result.response_text || result.response, result.correct ? '✓' : '✗', result.rt];
    }
    return [...baseRow, GetSetting('readingWPS'), GetSetting('readingCrowding'), 'Reading Phase', '-', '-', result.reading_time || 0];
  });
  const csvContent = CreateCsvContent([headers, ...rows]);
  DownloadCsvFile(csvContent, `${prefix ? prefix + '_' : ''}${userName}_${moduleId}_${dateStr}.csv`);
}
