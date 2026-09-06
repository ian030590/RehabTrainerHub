// Result export local to the Hub-owned vision modules.
import { CreateCsvContent } from '@rehab-trainer/ui/csv';
import { GetSetting } from '../../utils/settings';
import { DownloadCsvFile } from '../../utils/downloadFile';
import { Mean } from '../../utils/mathUtils';
import { FindOculomotorResult } from './oculomotor/resultData';
import type { TFunction, TrialData } from './types';

interface DownloadTrainingCsvArgs {
  results: TrialData[];
  userName: string;
  moduleId: string;
  difficulty: string;
  oculomotorMode: string;
  oculomotorPattern: string;
  t: TFunction;
}

export function DownloadTrainingCsv({
  results,
  userName,
  moduleId,
  difficulty,
  oculomotorMode,
  oculomotorPattern,
  t,
}: DownloadTrainingCsvArgs) {
  if (results.length === 0) return;

  const prefix = GetSetting('downloadDirectory');
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false }).replace(/:/g, '');
  const isOculomotor = moduleId === 'oculomotor-training';
  const isGabor = moduleId === 'gabor-patching';
  const isReading = moduleId === 'reading-training';
  const isDriving = moduleId === 'driving-rehab';

  let headers: string[];
  if (isOculomotor) {
    headers = [
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
  } else if (isGabor) {
    headers = [t('exp.csv.user'), t('exp.csv.date'), t('exp.csv.time'), t('exp.csv.module'), t('exp.csv.duration'), t('exp.csv.score'), t('exp.csv.acquired')];
  } else if (isReading) {
    headers = [t('exp.csv.user'), t('exp.csv.date'), t('exp.csv.time'), t('exp.csv.module'), 'WPS', 'Crowding', t('exp.csv.target'), t('exp.csv.response'), t('exp.csv.correct'), t('exp.csv.rt')];
  } else if (isDriving) {
    headers = [t('exp.csv.user'), t('exp.csv.date'), t('exp.csv.time'), t('exp.csv.module'), t('exp.csv.event'), t('exp.csv.rt'), t('exp.csv.rawRt'), t('exp.csv.reactionFrames'), t('exp.csv.valid'), t('exp.csv.collision'), t('exp.csv.preBrake'), t('exp.csv.response'), t('exp.csv.laneDeviations'), t('exp.csv.fps'), t('exp.csv.refreshHz')];
  } else {
    headers = [t('exp.csv.user'), t('exp.csv.date'), t('exp.csv.time'), t('exp.csv.module'), t('exp.csv.diff'), t('exp.csv.round'), t('exp.csv.target'), t('exp.csv.response'), t('exp.csv.correct'), t('exp.csv.rt')];
  }

  let rows: (string | number)[][];
  if (isOculomotor) {
    const result = FindOculomotorResult(results);
    const baseRow: (string | number)[] = [
      userName,
      dateStr,
      timeStr,
      moduleId,
      t(`preset.mode.${result?.mode || oculomotorMode}` as any),
      t(`preset.path.${result?.pattern || oculomotorPattern}` as any),
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
    rows = samples.length > 0
      ? samples.map((sample) => [
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
  } else if (isDriving) {
    rows = (results[0]?.driving_events ?? []).map((event) => [
      userName,
      dateStr,
      timeStr,
      moduleId,
      event.label,
      event.rt_ms ?? '',
      event.raw_rt_ms !== null && event.raw_rt_ms !== undefined
        ? Math.round(event.raw_rt_ms * 1000) / 1000
        : '',
      results[0]?.refresh_measurement_valid ? event.reaction_frames ?? '' : '',
      event.valid ? 'true' : 'false',
      event.collision ? 'true' : 'false',
      event.brake_preheld ? 'true' : 'false',
      event.response,
      results[0]?.lane_deviations ?? 0,
      results[0]?.average_fps ?? '',
      results[0]?.refresh_measurement_valid ? results[0]?.display_refresh_hz ?? '' : '',
    ]);
  } else {
    rows = results.map((result, i) => {
      const baseRow: (string | number)[] = [userName, dateStr, timeStr, moduleId];
      if (isGabor) {
        return [...baseRow, result.duration_ms ?? result.rt, result.score ?? 0, result.acquired_targets ?? 0];
      }
      if (isReading) {
        if (result.trial_type === 'html-button-response') {
          return [...baseRow, GetSetting('readingWPS'), GetSetting('readingCrowding'), result.target, result.response_text || result.response, result.correct ? '✓' : '✗', result.rt];
        }
        return [...baseRow, GetSetting('readingWPS'), GetSetting('readingCrowding'), 'Reading Phase', '-', '-', result.reading_time || 0];
      }
      return [...baseRow, difficulty, i + 1, result.target, result.response, result.correct ? '✓' : '✗', result.rt];
    });
  }

  if (!isOculomotor && !isGabor && !isDriving) {
    const avgRt = Math.round(Mean(results.map((result) => result.rt)));
    const correctCount = results.filter((result) => result.correct).length;
    rows.push(['']);
    rows.push([t('exp.avgRt'), `${avgRt} ms`]);
    rows.push([t('exp.correctRate'), `${correctCount}/${results.length}`]);
  } else if (isDriving) {
    rows.push(['']);
    rows.push([t('exp.res.avgRt'), `${results[0]?.average_rt ?? 0} ms`]);
    rows.push([t('exp.res.collisions'), `${results[0]?.collisions ?? 0}`]);
  }

  const csvContent = CreateCsvContent([headers, ...rows]);

  DownloadCsvFile(
    csvContent,
    `${prefix ? prefix + '_' : ''}${userName}_${moduleId}_${dateStr}.csv`,
  );
}
