// Results view local to the Hub-owned Gabor module.
import type { TFunction,TrialData } from '@rehab-trainer/ui';
import { ResultSummary } from '@rehab-trainer/ui/components/ResultSummary';

interface GaborResultsProps {
  results: TrialData[];
  userName: string;
  t: TFunction;
}

export function GaborResults({ results, userName, t }: GaborResultsProps) {
  const result = results[0];

  return (
    <>
      <div className="results-score">
        {t('exp.res.score')} {result?.score ?? 0}
      </div>
      <ResultSummary items={[
        { label: t('exp.res.acquired'), value: result?.acquired_targets ?? 0 },
        { label: t('home.config.durationLabel'), value: `${Math.round((result?.duration_ms ?? 0) / 1000)}s` },
        { label: t('exp.res.user'), value: userName, emphasize: false },
      ]} />
    </>
  );
}
