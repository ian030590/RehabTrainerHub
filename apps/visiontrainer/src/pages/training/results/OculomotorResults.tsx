import { ResultSummary } from '../../../components/ResultSummary';
import type { ResultSummaryItem } from '../../../components/ResultSummary';
import type { TFunction, TrialData } from '../types';

interface OculomotorResultsProps {
  results: TrialData[];
  userName: string;
  t: TFunction;
  oculomotorMode: string;
  oculomotorPattern: string;
}

export function OculomotorResults({
  results,
  userName,
  t,
  oculomotorMode,
  oculomotorPattern,
}: OculomotorResultsProps) {
  const result = results[0];
  const summaryItems: ResultSummaryItem[] = [
    { label: t('exp.res.mode'), value: t(`preset.mode.${result?.mode || oculomotorMode}` as any) },
    { label: t('exp.res.path'), value: t(`preset.path.${result?.pattern || oculomotorPattern}` as any) },
    { label: t('exp.res.acquired'), value: result?.acquired_targets ?? 0 },
    { label: t('exp.res.fps'), value: result?.average_fps ?? '-' },
  ];

  if (result?.aoi_score !== undefined) {
    summaryItems.push({ label: t('exp.res.aoi'), value: result.aoi_score });
  }
  summaryItems.push({ label: t('exp.res.user'), value: userName, emphasize: false });

  return (
    <>
      <div className="results-score">
        {Math.round((result?.duration_ms ?? 0) / 1000)}s
      </div>
      <ResultSummary items={summaryItems} />
    </>
  );
}
