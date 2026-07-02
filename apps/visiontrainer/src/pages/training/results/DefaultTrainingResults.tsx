import { ResultSummary } from '../../../components/ResultSummary';
import { mean, median } from '../../../utils/mathUtils';
import type { TFunction, TrialData } from '../types';

interface DefaultTrainingResultsProps {
  results: TrialData[];
  userName: string;
  t: TFunction;
}

export function DefaultTrainingResults({ results, userName, t }: DefaultTrainingResultsProps) {
  const responseTimes = results.map((result) => result.rt);
  const averageRt = Math.round(mean(responseTimes));
  const correctCount = results.filter((result) => result.correct).length;
  const medianRt = Math.round(median(responseTimes));

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
          {results.map((result, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{result.target}</td>
              <td>{result.response}</td>
              <td style={{ color: result.correct ? 'var(--success)' : 'var(--error)' }}>
                {result.correct ? '✓' : '✗'}
              </td>
              <td className={result.rt < averageRt ? 'rt-fast' : result.rt > averageRt * 1.5 ? 'rt-slow' : ''}>
                {result.rt}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
