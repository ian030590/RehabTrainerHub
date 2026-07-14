import { UfovPage, type UfovTrainingRecord } from '@rehab-trainer/ui/ufov/UfovPage';
import { useT } from '../../i18n';
import { saveTrainingRecord } from '../../utils/trainingRecords';
import type { TrialData } from '../training/types';

export function UfovAssessmentPage() {
  const { lang } = useT();

  return (
    <UfovPage
      appName="VisionTrainer"
      backPath="/assessment"
      lang={lang}
      moduleId="ufov-assessment"
      onSaveRecord={saveUfovRecord}
    />
  );
}

async function saveUfovRecord(record: UfovTrainingRecord) {
  await saveTrainingRecord({
    userName: record.userName,
    moduleId: record.moduleId,
    difficulty: record.difficulty,
    config: {
      ufovDetails: record.details,
      ufovSummary: record.details?.ufovSummary,
    },
    results: toUfovTrialData(record),
  });
}

function toUfovTrialData(record: UfovTrainingRecord): TrialData[] {
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
