import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import type { TFunction, TrialData } from '../types';
import { DefaultTrainingResults } from './DefaultTrainingResults';
import { DrivingResults } from './DrivingResults';
import { GaborResults } from './GaborResults';
import { OculomotorResults } from './OculomotorResults';
import { ReadingResults } from './ReadingResults';

interface TrainingResultsProps {
  moduleId: string;
  results: TrialData[];
  userName: string;
  t: TFunction;
  oculomotorMode: string;
  oculomotorPattern: string;
  onDownloadCsv: () => void;
  onRestart: () => void;
  onBackHome: () => void;
}

export function TrainingResults({
  moduleId,
  results,
  userName,
  t,
  oculomotorMode,
  oculomotorPattern,
  onDownloadCsv,
  onRestart,
  onBackHome,
}: TrainingResultsProps) {
  return (
    <div key="results" className="experiment-container" style={{ overflowY: 'auto' }}>
      <div className="experiment-results">
        <h1 style={{ fontSize: 32 }}>{t('exp.done')}</h1>
        {moduleId === 'oculomotor-training' ? (
          <OculomotorResults
            results={results}
            userName={userName}
            t={t}
            oculomotorMode={oculomotorMode}
            oculomotorPattern={oculomotorPattern}
          />
        ) : moduleId === 'gabor-patching' ? (
          <GaborResults results={results} userName={userName} t={t} />
        ) : moduleId === 'driving-rehab' ? (
          <DrivingResults results={results} userName={userName} t={t} />
        ) : moduleId === 'reading-training' ? (
          <ReadingResults results={results} userName={userName} t={t} />
        ) : (
          <DefaultTrainingResults results={results} userName={userName} t={t} />
        )}

        <TrainingResultActions
          downloadLabel={t('exp.downloadCsv')}
          restartLabel={t('exp.restart')}
          backLabel={t('exp.backHome')}
          onDownloadCsv={onDownloadCsv}
          onRestart={onRestart}
          onBackHome={onBackHome}
        />
      </div>
    </div>
  );
}
