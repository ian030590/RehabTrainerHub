import { useSearchParams } from 'react-router-dom';
import { useT } from '../i18n';
import { saveTrainingRecord } from '../utils/trainingRecords';
import { UfovPage, type SubtestId, type UfovRunMode, type UfovTrainingRecord } from './ufov/UfovPage';

export function UFOVPage() {
  const { lang } = useT();
  const [searchParams] = useSearchParams();
  const initialSubtestId = parseSubtestId(searchParams.get('subtest'));
  const initialMode = parseRunMode(searchParams.get('mode'));
  const autoStart = searchParams.get('start') === '1';

  return (
    <UfovPage
      appName="BrainTrainer"
      backPath="/attention-training"
      lang={lang}
      moduleId="attention-training"
      initialSubtestId={initialSubtestId}
      initialMode={initialMode}
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
