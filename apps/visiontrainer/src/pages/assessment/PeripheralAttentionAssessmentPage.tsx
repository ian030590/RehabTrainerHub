import { useSearchParams } from 'react-router-dom';
import { useT } from '../../i18n';
import { SaveTrainingRecord } from '../../utils/trainingRecords';
import type { TrialData } from '@rehab-trainer/hub-modules/vision/pages/training/types';
import {
  PeripheralAttentionPage,
  type SubtestId,
  type PeripheralAttentionRunMode,
  type PeripheralAttentionTrainingRecord,
} from './peripheral-attention/PeripheralAttentionPage';

export function PeripheralAttentionAssessmentPage() {
  const { lang } = useT();
  const [searchParams] = useSearchParams();
  const initialSubtestId = ParseSubtestId(searchParams.get('subtest'));
  const initialMode = ParseRunMode(searchParams.get('mode'));
  const autoStart = searchParams.get('start') === '1';

  return (
    <PeripheralAttentionPage
      appName="VisionTrainer"
      backPath="/assessment"
      lang={lang}
      moduleId="ufov-assessment"
      initialSubtestId={initialSubtestId}
      initialMode={initialMode}
      autoStart={autoStart}
      onSaveRecord={SavePeripheralAttentionRecord}
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

async function SavePeripheralAttentionRecord(record: PeripheralAttentionTrainingRecord) {
  await SaveTrainingRecord({
    userName: record.userName,
    moduleId: record.moduleId,
    difficulty: record.difficulty,
    config: {
      ufovDetails: record.details,
      ufovSummary: record.details?.ufovSummary,
    },
    results: ToPeripheralAttentionTrialData(record),
  });
}

function ToPeripheralAttentionTrialData(record: PeripheralAttentionTrainingRecord): TrialData[] {
  return (record.detailRows ?? []).map((row, index) => ({
    ...row,
    trial_index: index,
    rt: Number(row.Response_Time_ms ?? 0),
    correct: row.Correct === true,
    target: String(row.Target_Vehicle ?? ''),
    response: String(row.Central_Response ?? ''),
    duration_ms: Number(row.Actual_Duration_ms ?? row.Processing_Speed_ms ?? 0),
    trial_type: String(row.Phase ?? ''),
    score: Number(record.details?.processingSpeedMs ?? 0),
  }));
}
