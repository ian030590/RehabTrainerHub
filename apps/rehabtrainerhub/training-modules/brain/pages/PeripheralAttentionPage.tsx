// Canonical Hub-owned BrainTrainer Peripheral Attention entry.
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { IsTrainingFlowLaunchState } from '@rehab-trainer/ui/trainingFlow';
import { useT } from '../i18n';
import { SaveTrainingRecord } from '../utils/trainingRecords';
import {
  PeripheralAttentionPage as BasePeripheralAttentionPage,
  type SubtestId,
  type PeripheralAttentionRunMode,
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
