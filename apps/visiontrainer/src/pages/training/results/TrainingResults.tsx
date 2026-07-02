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

        <div className="results-actions">
          <button className="btn btn-primary btn-lg" onClick={onDownloadCsv}>
            {t('exp.downloadCsv')}
          </button>
          <button className="btn btn-secondary btn-lg" onClick={onBackHome}>
            {t('exp.backHome')}
          </button>
        </div>
      </div>
    </div>
  );
}
