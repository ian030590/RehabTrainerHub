// Canonical Hub-owned BrainTrainer Peripheral Attention entry.
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { IsTrainingFlowLaunchState } from '@rehab-trainer/ui/trainingFlow';
import { useT } from '../i18n';
import { SaveTrainingRecord } from '../utils/trainingRecords';
import {
  PeripheralAttentionPage as BasePeripheralAttentionPage,
  type SubtestId,
  type PeripheralAttentionRunMode,
  type PeripheralAttentionStopCondition,
  type PeripheralAttentionTargetAxis,
  type PeripheralAttentionTrainingRecord,
} from './peripheral-attention/PeripheralAttentionPage';

export function PeripheralAttentionPage() {
  const { lang } = useT();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialSubtestId = ParseSubtestId(searchParams.get('subtest'));
  const initialMode = ParseRunMode(searchParams.get('mode'));
  const trialCount = ParseTrialCount(searchParams.get('trials'));
  const targetAxes = ParseTargetAxes(searchParams.get('axes'));
  const stopCondition = ParseStopCondition(searchParams.get('stop'));
  const contrastPercent = ParseRange(searchParams.get('contrast'), 100, 5, 100, 1);
  const targetVisualAngleDeg = ParseRange(searchParams.get('angle'), 15, 5, 35, .5);
  const vehicleVisualAngleDeg = ParseRange(searchParams.get('vehicleAngle'), 2.5, .8, 5, .1);
  const autoStart = searchParams.get('start') === '1';

  if (!IsTrainingFlowLaunchState(location.state)) {
    return <Navigate to="/attention-training?game=ufov" replace />;
  }

  return (
    <BasePeripheralAttentionPage
      appName="BrainTrainer"
      backPath="/attention-training"
      lang={lang}
      moduleId="attention-training"
      initialSubtestId={initialSubtestId}
      initialMode={initialMode}
      trialCount={trialCount}
      targetAxes={targetAxes}
      stopCondition={stopCondition}
      contrastPercent={contrastPercent}
      targetVisualAngleDeg={targetVisualAngleDeg}
      vehicleVisualAngleDeg={vehicleVisualAngleDeg}
      autoStart={autoStart}
      onSaveRecord={(record: PeripheralAttentionTrainingRecord) => SaveTrainingRecord(record)}
    />
  );
}

function ParseSubtestId(value: string | null): SubtestId {
  if (value === '2') return 2;
  if (value === '3') return 3;
  return 1;
}

function ParseRunMode(value: string | null): PeripheralAttentionRunMode {
  if (value === 'instruction' || value === 'practice' || value === 'formal') return value;
  return 'formal';
}

function ParseTrialCount(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 48;
  return Math.max(1, Math.min(240, Math.round(parsed)));
}

function ParseTargetAxes(value: string | null): PeripheralAttentionTargetAxis[] {
  const axes = value
    ?.split(',')
    .map((item) => Number(item))
    .filter((axis): axis is PeripheralAttentionTargetAxis => Number.isInteger(axis) && axis >= 0 && axis <= 7) ?? [];

  return axes.length > 0 ? Array.from(new Set(axes)) : [0, 1, 2, 3, 4, 5, 6, 7];
}

function ParseStopCondition(value: string | null): PeripheralAttentionStopCondition {
  return value === 'fixed_trials' ? 'fixed_trials' : 'adaptive_80';
}

function ParseRange(value: string | null, fallback: number, min: number, max: number, step: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(Math.min(max, Math.max(min, parsed)) / step) * step;
}
