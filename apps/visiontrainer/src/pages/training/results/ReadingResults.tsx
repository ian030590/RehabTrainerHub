import { ResultSummary } from '../../../components/ResultSummary';
import { useAppSetting } from '../../../utils/useAppSetting';
import type { TFunction, TrialData } from '../types';

interface ReadingResultsProps {
  results: TrialData[];
  userName: string;
  t: TFunction;
}

export function ReadingResults({ results, userName, t }: ReadingResultsProps) {
  const [readingSpeed] = useAppSetting('readingWPS');
  const [crowdingLevel] = useAppSetting('readingCrowding');
  const questions = results.filter((result) => result.trial_type === 'html-button-response');
  const correct = questions.filter((result) => result.correct).length;
  const readingTime = results.find((result) => result.trial_type === 'pixi-reading-training')?.reading_time || 0;

  return (
    <>
      <div className="results-score">{correct}/{questions.length}</div>
      <ResultSummary items={[
        { label: t('exp.res.user'), value: userName, emphasize: false },
        { label: 'WPS:', value: readingSpeed },
        { label: 'Crowding:', value: crowdingLevel },
        { label: 'Total Time:', value: `${Math.round(readingTime / 100) / 10} s` },
      ]} />

      <table className="results-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('exp.res.thTarget')}</th>
            <th>{t('exp.res.thResp')}</th>
            <th>{t('exp.res.thCorrect')}</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((result, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{result.target}</td>
              <td>{result.response_text}</td>
              <td style={{ color: result.correct ? 'var(--success)' : 'var(--error)' }}>
                {result.correct ? '✓' : '✗'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
