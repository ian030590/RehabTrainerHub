import { useSearchParams } from 'react-router-dom';
import { useT } from '../../i18n';
import { SaveTrainingRecord } from '../../utils/trainingRecords';
import type { TrialData } from '../training/types';
import { UfovPage, type SubtestId, type UfovRunMode, type UfovTrainingRecord } from './ufov/UfovPage';

export function UfovAssessmentPage() {
  const { lang } = useT();
  const [searchParams] = useSearchParams();
  const initialSubtestId = ParseSubtestId(searchParams.get('subtest'));
  const initialMode = ParseRunMode(searchParams.get('mode'));
  const autoStart = searchParams.get('start') === '1';

  return (
    <UfovPage
      appName="VisionTrainer"
      backPath="/assessment"
      lang={lang}
      moduleId="ufov-assessment"
      initialSubtestId={initialSubtestId}
      initialMode={initialMode}
      autoStart={autoStart}
      onSaveRecord={SaveUfovRecord}
    />
  );
}

function ParseSubtestId(value: string | null): SubtestId {
  if (value === '2') return 2;
  if (value === '3') return 3;
  return 1;
}

function ParseRunMode(value: string | null): UfovRunMode {
  if (value === 'instruction' || value === 'practice' || value === 'formal') return value;
  return 'formal';
}

async function SaveUfovRecord(record: UfovTrainingRecord) {
  await SaveTrainingRecord({
    userName: record.userName,
    moduleId: record.moduleId,
    difficulty: record.difficulty,
    config: {
      ufovDetails: record.details,
      ufovSummary: record.details?.ufovSummary,
    },
    results: ToUfovTrialData(record),
  });
}

function ToUfovTrialData(record: UfovTrainingRecord): TrialData[] {
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
