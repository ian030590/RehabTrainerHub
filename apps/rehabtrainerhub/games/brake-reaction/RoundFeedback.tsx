import { useEffect, useRef } from 'react';
import { useT } from './i18n/useT';
import { BuildGameScore } from './score';
import type { Settings } from './settings';
import { DistanceBars, FeedbackVerdict } from './src/drivePresentation';
import { distractionRoundIndex } from './src/round';
import type { Row } from './src/score';

export function RoundFeedback({ feedback, settings, previous, exitLabel, nextLabel, onExit, onNext }: {
  feedback: Row | 'early'; settings: Settings; previous: Row[]; exitLabel: string; nextLabel: string;
  onExit: () => void; onNext: () => void;
}) {
  const { copy: t } = useT();
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => { primary.current?.focus({ preventScroll: true }); }, []);
  const verdict = FeedbackVerdict(feedback);
  const row = feedback === 'early' ? undefined : feedback;
  const comparison = row && previous.length === distractionRoundIndex
    ? BuildGameScore(settings, [...previous, row]).score.summary : undefined;
  const scale = row ? DistanceBars(row.gap, row.outcome.beforeBraking) : undefined;
  const relative = row?.outcome.rel;
  const meters = (value: number) => value.toFixed(1) + ' m';

  return <section className="training-panel round-feedback" data-verdict={verdict} role="dialog" aria-modal="true"
    aria-labelledby="round-feedback-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('[tabindex="0"], button')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (document.activeElement === (event.shiftKey ? first : last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    }}>
    <header className="training-config-header">
      <h2 id="round-feedback-title">{t[verdict]}</h2>
      <p>{row ? (relative == null ? `${t.remaining} ${meters(row.outcome.remaining)}` :
        `${t.relative} ${relative.toFixed(1)} km/h`) : t.falseStart}</p>
    </header>
    {row && scale && <div className="training-config-body" tabIndex={0} role="region" aria-label={t.feedback}>
      <dl className="metrics">
        <div className="metric"><dt>{t.reaction}</dt><dd>{row.r.toFixed(2)} s{row.timedOut && ' · ' + t.timeout}</dd></div>
        <div className="metric"><dt>{t.beforeBraking}</dt><dd>{meters(row.outcome.beforeBraking)}</dd></div>
      </dl>
      <dl className="round-distance-bars">
        {[{ label: t.gap, distance: row.gap }, { label: t.beforeBraking, distance: row.outcome.beforeBraking }].map((item, index) =>
          <div className="round-distance" key={item.label}>
            <dt>{item.label}</dt>
            <dd>{meters(item.distance)}</dd>
            <span className="round-distance-track" aria-hidden="true"><span style={{ width: `${100 * scale[index]}%` }} /></span>
          </div>)}
      </dl>
      {comparison && <section className="round-distraction">
        <h3>{t.distraction}</h3>
        <p>{comparison.distractionDeltaSeconds === null || comparison.distractionDeltaMeters === null ? t.noDistraction :
          `${t.delta} ${comparison.distractionDeltaSeconds.toFixed(2)} s · ${t.deltaMeters} ${meters(comparison.distractionDeltaMeters)}`}</p>
      </section>}
    </div>}
    <footer className="config-actions">
      <button type="button" className="btn btn-ghost" onClick={onExit}>{exitLabel}</button>
      <button type="button" className="btn btn-primary" id="continue" ref={primary} onClick={onNext}>{nextLabel}</button>
    </footer>
  </section>;
}
