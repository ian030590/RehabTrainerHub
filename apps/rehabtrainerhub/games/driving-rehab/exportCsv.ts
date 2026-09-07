import { CreateCsvContent } from '@rehab-trainer/ui/csv';
import { DownloadCsvFile } from '@rehab-trainer/ui/downloadFile';
import { GetSetting } from '@rehab-trainer/ui/settings';

export function DownloadTrainingCsv({ results, userName, moduleId, t }: any) {
  if (results.length === 0) return;
  const prefix = GetSetting('downloadDirectory');
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false }).replace(/:/g, '');
  const headers = [
    t('exp.csv.user'),
    t('exp.csv.date'),
    t('exp.csv.time'),
    t('exp.csv.module'),
    t('exp.csv.event'),
    t('exp.csv.rt'),
    t('exp.csv.rawRt'),
    t('exp.csv.reactionFrames'),
    t('exp.csv.valid'),
    t('exp.csv.collision'),
    t('exp.csv.preBrake'),
    t('exp.csv.response'),
    t('exp.csv.laneDeviations'),
    t('exp.csv.fps'),
    t('exp.csv.refreshHz'),
  ];
  const rows = (results[0]?.driving_events ?? []).map((event: any) => [
    userName,
    dateStr,
    timeStr,
    moduleId,
    event.label,
    event.rt_ms ?? '',
    event.raw_rt_ms !== null && event.raw_rt_ms !== undefined ? Math.round(event.raw_rt_ms * 1000) / 1000 : '',
    results[0]?.refresh_measurement_valid ? event.reaction_frames ?? '' : '',
    event.valid ? 'true' : 'false',
    event.collision ? 'true' : 'false',
    event.brake_preheld ? 'true' : 'false',
    event.response,
    results[0]?.lane_deviations ?? 0,
    results[0]?.average_fps ?? '',
    results[0]?.refresh_measurement_valid ? results[0]?.display_refresh_hz ?? '' : '',
  ]);
  const csvContent = CreateCsvContent([headers, ...rows]);
  DownloadCsvFile(csvContent, `${prefix ? prefix + '_' : ''}${userName}_${moduleId}_${dateStr}.csv`);
}
