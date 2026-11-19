import type { dictionary } from './i18n';
import { ModelFor, Severity, Simulate } from './src/physics';
import type { Row } from './src/score';
import type { Settings } from './settings';
import { BuildGameScore } from './score';
import { CalculateScoreStatistics } from './scoreStatistics';

type Copy = typeof dictionary.en;
const seconds = (value: number) => value.toFixed(2) + ' s';
const meters = (value: number) => value.toFixed(1) + ' m';

function OutcomeText(row: Row, t: Copy) {
  const relative = row.outcome.rel;
  if (relative === null) return t.stopped + ' · ' + t.remaining + ' ' + meters(row.outcome.remaining);
  const grade = Severity(relative);
  return [grade === 'light' ? t.lightContact : t[grade], t.relative + ' ' + relative.toFixed(1) + ' km/h',
    t.drop + ' ' + ((relative / 3.6) ** 2 / (2 * 9.81)).toFixed(2) + ' m'].join(' · ');
}

export function SessionSummary({ settings, rows, copy: t, summaryItems }: {
  settings: Settings; rows: Row[]; copy: Copy; summaryItems: { label: string; value: string }[];
}) {
  const { score: { summary } } = BuildGameScore(settings, rows);
  const scored = rows.slice(0, 5);
  const recorded = CalculateScoreStatistics(scored.map(row => row.timedOut ? null : row.r));
  const sample = (value: number | null) => value === null ? t.missing : seconds(value);
  const model = ModelFor(settings);
  const gaps = [...new Set(scored.map(row => row.gap))].sort((a, b) => a - b);
  return <>
    <section className="score-context">
      <dl className="metrics">
        <div className="score-context-item"><dt>{t.falseStarts}</dt><dd>{summary.falseStarts}</dd></div>
        <div className="score-context-item"><dt>{t.answered}</dt><dd>{summary.distractionAnswered}</dd></div>
      </dl>
      <dl className="training-config-summary metrics">
        {summaryItems.map(item => <div className="training-config-summary-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl>
    </section>
    <section className="score-context">
      <h3>{t.distraction}</h3>
      {summary.distractionDeltaSeconds === null || summary.distractionDeltaMeters === null ? <p>{t.noDistraction}</p> :
        <dl className="metrics">
          <div className="metric"><dt>{t.delta}</dt><dd>{seconds(summary.distractionDeltaSeconds)}</dd></div>
          <div className="metric"><dt>{t.deltaMeters}</dt><dd>{meters(summary.distractionDeltaMeters)}</dd></div>
        </dl>}
    </section>
    <section className="score-context">
      <h3>{t.statistics}</h3>
      <dl className="metrics">
        <div className="metric"><dt>{t.sample}</dt><dd>{recorded.observations} / 5</dd></div>
        <div className="metric"><dt>{t.average}</dt><dd>{sample(recorded.mean)}</dd></div>
        <div className="metric"><dt>{t.median}</dt><dd>{sample(recorded.median)}</dd></div>
        <div className="metric"><dt>{t.deviation}</dt><dd>{sample(recorded.sampleSd)}</dd></div>
        <div className="metric"><dt>{t.range}</dt><dd>{recorded.minimum === null ? t.missing : sample(recorded.minimum) + ' ~ ' + sample(recorded.maximum)}</dd></div>
      </dl>
    </section>
    <section className="score-context">
      <h3>{t.simulation}</h3>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={t.simulation}>
        <table><thead><tr><th scope="col">{t.distance}</th><th scope="col">{t.result}</th></tr></thead>
          <tbody>{gaps.map(gap => <tr key={gap}><td>{meters(gap)}</td>
            <td>{Simulate(model, gap, summary.avg + .2).contact ? t.contact : t.stopped}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
    <section className="score-context">
      <h3>{t.details}</h3>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={t.details}>
        <table><thead><tr>{[t.round, t.scenario, t.result].map(text => <th key={text} scope="col">{text}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index}><th scope="row">{index === 5 ? t.distraction : index + 1}</th>
            <td>{t[row.scenario]}</td><td>{OutcomeText(row, t)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  </>;
}

export function SessionMetrics({ settings, rows, copy: t }: { settings: Settings; rows: Row[]; copy: Copy }) {
  const { score: { summary } } = BuildGameScore(settings, rows);
  return <>
      <dl className="metrics score-key-grid">
        <div className="score-key-metric"><dt>{t.average}</dt><dd>{seconds(summary.avg)}</dd></div>
        <div className="metric"><dt>{t.best}</dt><dd>{seconds(summary.best)}</dd></div>
        <div className="metric"><dt>{t.late}</dt><dd>{summary.lateCount}</dd></div>
      </dl>
      {rows.slice(0, 5).every(row => row.timedOut) && <p>{t.noPress}</p>}
    </>;
}
