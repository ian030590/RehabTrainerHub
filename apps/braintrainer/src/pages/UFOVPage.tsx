import { UfovPage, type UfovTrainingRecord } from '@rehab-trainer/ui/ufov/UfovPage';
import { useT } from '../i18n';
import { saveTrainingRecord } from '../utils/trainingRecords';

export function UFOVPage() {
  const { lang } = useT();

  return (
    <UfovPage
      appName="BrainTrainer"
      backPath="/attention-training"
      lang={lang}
      moduleId="attention-training"
      onSaveRecord={(record: UfovTrainingRecord) => saveTrainingRecord(record)}
    />
  );
}
