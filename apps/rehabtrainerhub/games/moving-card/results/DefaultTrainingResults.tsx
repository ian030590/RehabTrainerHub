// Results view local to the Hub-owned vision modules.
import type { TFunction,TrialData } from '@rehab-trainer/ui';
import { ResultSummary } from '@rehab-trainer/ui/components/ResultSummary';
import { Mean,Median } from '@rehab-trainer/ui/mathUtils';

interface DefaultTrainingResultsProps {
  results: TrialData[];
  userName: string;
  t: TFunction;
}

export function DefaultTrainingResults({ results, userName, t }: DefaultTrainingResultsProps) {
  const responseTimes = results.map((result) => result.rt);
  const averageRt = Math.round(Mean(responseTimes));
  const correctCount = results.filter((result) => result.correct).length;
  const medianRt = Math.round(Median(responseTimes));

  return (
    <>
      <div className="results-score">{correctCount}/{results.length}</div>
      <ResultSummary items={[
        { label: t('exp.res.avgRt'), value: `${averageRt} ms` },
        { label: t('exp.res.medRt'), value: `${medianRt} ms` },
        { label: t('exp.res.user'), value: userName, emphasize: false },
      ]} />

      <table className="results-table">
        <thead>
          <tr>
            <th>{t('exp.res.thRound')}</th>
            <th>{t('exp.res.thTarget')}</th>
            <th>{t('exp.res.thResp')}</th>
            <th>{t('exp.res.thCorrect')}</th>
            <th>{t('exp.res.thRt')}</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, index) => (
            <tr key={index} className={result.correct ? 'row-correct' : 'row-incorrect'}>
              <td>{index + 1}</td>
              <td>{result.targetLetter}</td>
              <td>{result.responseLetter || '-'}</td>
              <td>{result.correct ? t('exp.res.correct') : t('exp.res.incorrect')}</td>
              <td>{Math.round(result.rt)} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
