import { useSearchParams } from 'react-router-dom';
import { useT } from '../i18n';
import { saveTrainingRecord } from '../utils/trainingRecords';
import { UfovPage, type SubtestId, type UfovRunMode, type UfovTargetAxis, type UfovTrainingRecord } from './ufov/UfovPage';

export function UFOVPage() {
  const { lang } = useT();
  const [searchParams] = useSearchParams();
  const initialSubtestId = parseSubtestId(searchParams.get('subtest'));
  const initialMode = parseRunMode(searchParams.get('mode'));
  const trialCount = parseTrialCount(searchParams.get('trials'));
  const targetAxes = parseTargetAxes(searchParams.get('axes'));
  const autoStart = searchParams.get('start') === '1';

  return (
    <UfovPage
      appName="BrainTrainer"
      backPath="/attention-training"
      lang={lang}
      moduleId="attention-training"
      initialSubtestId={initialSubtestId}
      initialMode={initialMode}
      trialCount={trialCount}
      targetAxes={targetAxes}
      autoStart={autoStart}
      onSaveRecord={(record: UfovTrainingRecord) => saveTrainingRecord(record)}
    />
  );
}

function parseSubtestId(value: string | null): SubtestId {
  if (value === '2') return 2;
  if (value === '3') return 3;
  return 1;
}

function parseRunMode(value: string | null): UfovRunMode {
  if (value === 'instruction' || value === 'practice' || value === 'formal') return value;
  return 'formal';
}

function parseTrialCount(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 48;
  return Math.max(1, Math.min(240, Math.round(parsed)));
}

function parseTargetAxes(value: string | null): UfovTargetAxis[] {
  const axes = value
    ?.split(',')
    .map((item) => Number(item))
    .filter((axis): axis is UfovTargetAxis => Number.isInteger(axis) && axis >= 0 && axis <= 7) ?? [];

  return axes.length > 0 ? Array.from(new Set(axes)) : [0, 1, 2, 3, 4, 5, 6, 7];
}
