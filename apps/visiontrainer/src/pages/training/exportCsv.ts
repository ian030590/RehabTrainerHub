import { getSetting } from '../../utils/settings';
import { downloadCsvFile } from '../../utils/downloadFile';
import { mean } from '../../utils/mathUtils';
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

export function downloadTrainingCsv({
  results,
  userName,
  moduleId,
  difficulty,
  oculomotorMode,
  oculomotorPattern,
  t,
}: DownloadTrainingCsvArgs) {
  if (results.length === 0) return;

  const prefix = getSetting('downloadDirectory');
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false }).replace(/:/g, '');
  const isOculomotor = moduleId === 'oculomotor-training';
  const isGabor = moduleId === 'gabor-patching';
  const isReading = moduleId === 'reading-training';
  const isDriving = moduleId === 'driving-rehab';

  let headers: string[];
  if (isOculomotor) {
    headers = [t('exp.csv.user'), t('exp.csv.date'), t('exp.csv.time'), t('exp.csv.module'), t('exp.csv.mode'), t('exp.csv.path'), t('exp.csv.duration'), t('exp.csv.acquired'), t('exp.csv.fps'), t('exp.csv.aoi'), t('exp.csv.status')];
  } else if (isGabor) {
    headers = [t('exp.csv.user'), t('exp.csv.date'), t('exp.csv.time'), t('exp.csv.module'), t('exp.csv.duration'), t('exp.csv.score'), t('exp.csv.acquired')];
  } else if (isReading) {
    headers = [t('exp.csv.user'), t('exp.csv.date'), t('exp.csv.time'), t('exp.csv.module'), 'WPS', 'Crowding', t('exp.csv.target'), t('exp.csv.response'), t('exp.csv.correct'), t('exp.csv.rt')];
  } else if (isDriving) {
    headers = [t('exp.csv.user'), t('exp.csv.date'), t('exp.csv.time'), t('exp.csv.module'), t('exp.csv.event'), t('exp.csv.rt'), t('exp.csv.valid'), t('exp.csv.collision'), t('exp.csv.preBrake'), t('exp.csv.response'), t('exp.csv.laneDeviations'), t('exp.csv.fps')];
  } else {
    headers = [t('exp.csv.user'), t('exp.csv.date'), t('exp.csv.time'), t('exp.csv.module'), t('exp.csv.diff'), t('exp.csv.round'), t('exp.csv.target'), t('exp.csv.response'), t('exp.csv.correct'), t('exp.csv.rt')];
  }

  const rows: (string | number)[][] = isDriving
    ? ((results[0]?.driving_events ?? []).map((event) => [
      userName,
      dateStr,
      timeStr,
      moduleId,
      event.label,
      event.rt_ms ?? '',
      event.valid ? 'true' : 'false',
      event.collision ? 'true' : 'false',
      event.brake_preheld ? 'true' : 'false',
      event.response,
      results[0]?.lane_deviations ?? 0,
      results[0]?.average_fps ?? '',
    ]))
    : results.map((result, i) => {
      const baseRow: (string | number)[] = [userName, dateStr, timeStr, moduleId];
      if (isOculomotor) {
        return [...baseRow, t(`preset.mode.${result.mode || oculomotorMode}` as any), t(`preset.path.${result.pattern || oculomotorPattern}` as any), result.duration_ms ?? result.rt, result.acquired_targets ?? 0, result.average_fps ?? '', result.aoi_score ?? '-', result.response];
      }
      if (isGabor) {
        return [...baseRow, result.duration_ms ?? result.rt, result.score ?? 0, result.acquired_targets ?? 0];
      }
      if (isReading) {
        if (result.trial_type === 'html-button-response') {
          return [...baseRow, getSetting('readingWPS'), getSetting('readingCrowding'), result.target, result.response_text || result.response, result.correct ? '✓' : '✗', result.rt];
        }
        return [...baseRow, getSetting('readingWPS'), getSetting('readingCrowding'), 'Reading Phase', '-', '-', result.reading_time || 0];
      }
      return [...baseRow, difficulty, i + 1, result.target, result.response, result.correct ? '✓' : '✗', result.rt];
    });

  if (!isOculomotor && !isGabor && !isDriving) {
    const avgRt = Math.round(mean(results.map((result) => result.rt)));
    const correctCount = results.filter((result) => result.correct).length;
    rows.push(['']);
    rows.push([t('exp.avgRt'), `${avgRt} ms`]);
    rows.push([t('exp.correctRate'), `${correctCount}/${results.length}`]);
  } else if (isDriving) {
    rows.push(['']);
    rows.push([t('exp.res.avgRt'), `${results[0]?.average_rt ?? 0} ms`]);
    rows.push([t('exp.res.collisions'), `${results[0]?.collisions ?? 0}`]);
  }

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  downloadCsvFile(
    csvContent,
    `${prefix ? prefix + '_' : ''}${userName}_${moduleId}_${dateStr}.csv`,
  );
}
