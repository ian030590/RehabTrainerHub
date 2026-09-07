import { CreateCsvContent } from '@rehab-trainer/ui/csv';
import { DownloadCsvFile } from '@rehab-trainer/ui/downloadFile';
import { GetSetting } from '@rehab-trainer/ui/settings';
import { FindOculomotorResult } from './results/resultData';

export function DownloadTrainingCsv({
  results,
  userName,
  moduleId,
  oculomotorMode,
  oculomotorPattern,
  t,
}: any) {
  if (results.length === 0) return;

  const prefix = GetSetting('downloadDirectory');
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false }).replace(/:/g, '');

  const headers = [
    t('exp.csv.user'),
    t('exp.csv.date'),
    t('exp.csv.time'),
    t('exp.csv.module'),
    t('exp.csv.mode'),
    t('exp.csv.path'),
    t('exp.csv.duration'),
    t('exp.csv.acquired'),
    t('exp.csv.fps'),
    t('exp.csv.aoi'),
    t('exp.csv.status'),
    t('exp.csv.meanTargetDistance'),
    t('exp.csv.targetDistanceSd'),
    t('exp.csv.timeToFirstFixation'),
    t('exp.csv.pupilSizeEstimate'),
    t('exp.csv.pupilSizeSd'),
    t('exp.csv.blinkCountEstimate'),
    t('exp.csv.gazeSampleCount'),
    t('exp.csv.gazeTimestamp'),
    t('exp.csv.gazeX'),
    t('exp.csv.gazeY'),
    t('exp.csv.targetX'),
    t('exp.csv.targetY'),
    t('exp.csv.targetDistance'),
    t('exp.csv.samplePupilSizeEstimate'),
    t('exp.csv.sampleBlinkEstimate'),
    t('exp.csv.fixationSegment'),
  ];

  const result = FindOculomotorResult(results);
  const baseRow = [
    userName,
    dateStr,
    timeStr,
    moduleId,
    t(`preset.mode.${result?.mode || oculomotorMode}`),
    t(`preset.path.${result?.pattern || oculomotorPattern}`),
    result?.duration_ms ?? result?.rt ?? '',
    result?.acquired_targets ?? 0,
    result?.average_fps ?? '',
    result?.aoi_score ?? '',
    result?.response ?? '',
    result?.mean_target_distance_px ?? '',
    result?.target_distance_sd_px ?? '',
    result?.time_to_first_fixation_ms ?? '',
    result?.average_pupil_size_px ?? '',
    result?.pupil_size_sd_px ?? '',
    result?.blink_count ?? '',
    result?.gaze_sample_count ?? result?.gaze_samples?.length ?? 0,
  ];
  const samples = result?.gaze_samples ?? [];
  const rows = samples.length > 0
    ? samples.map((sample: any) => [
      ...baseRow,
      sample[0],
      sample[1],
      sample[2],
      sample[3],
      sample[4],
      sample[5],
      sample[6] ?? '',
      sample[7],
      sample[8],
    ])
    : [[...baseRow, '', '', '', '', '', '', '', '', '']];

  const csvContent = CreateCsvContent([headers, ...rows]);
  DownloadCsvFile(
    csvContent,
    `${prefix ? prefix + '_' : ''}${userName}_${moduleId}_${dateStr}.csv`,
  );
}
