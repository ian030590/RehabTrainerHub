// Results view local to the Hub-owned driving module.
import { ResultSummary } from '@rehab-trainer/ui/components/ResultSummary';
import type { TFunction, TrialData } from '../types';

interface DrivingResultsProps {
  results: TrialData[];
  userName: string;
  t: TFunction;
}

export function DrivingResults({ results, userName, t }: DrivingResultsProps) {
  const result = results[0];
  const events = result?.driving_events ?? [];

  return (
    <>
      <div className="results-score">
        {result?.average_rt ?? 0} ms
      </div>
      <ResultSummary items={[
        { label: t('exp.res.validEvents'), value: result?.valid_event_count ?? 0 },
        { label: t('exp.res.collisions'), value: result?.collisions ?? 0 },
        { label: t('exp.res.laneDeviations'), value: result?.lane_deviations ?? 0 },
        { label: t('exp.res.fps'), value: result?.average_fps ?? '-' },
        {
          label: t('exp.res.refreshHz'),
          value: result?.refresh_measurement_valid && result.display_refresh_hz
            ? `${result.display_refresh_hz} Hz`
            : t('exp.res.refreshUnknown'),
        },
        { label: 'Route:', value: result?.route_label ?? result?.route_id ?? '-', emphasize: false },
        { label: t('exp.res.user'), value: userName, emphasize: false },
      ]} />

      <table className="results-table" style={{ maxWidth: 920 }}>
        <thead>
          <tr>
            <th>{t('exp.res.thEvent')}</th>
            <th>{t('exp.res.thRt')}</th>
            <th>{t('exp.res.thRawRt')}</th>
            <th>{t('exp.res.thFrames')}</th>
            <th>{t('exp.res.thValid')}</th>
            <th>{t('exp.res.thCollision')}</th>
            <th>{t('exp.res.thResp')}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, i) => (
            <tr key={`${event.event_id}-${i}`}>
              <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{event.label}</td>
              <td>{event.rt_ms ?? '-'}</td>
              <td>{event.raw_rt_ms !== null && event.raw_rt_ms !== undefined
                ? Math.round(event.raw_rt_ms * 10) / 10
                : '-'}</td>
              <td>{result?.refresh_measurement_valid ? event.reaction_frames ?? '-' : '-'}</td>
              <td style={{ color: event.valid ? 'var(--success)' : 'var(--warning)' }}>
                {event.valid ? '✓' : '✗'}
              </td>
              <td style={{ color: event.collision ? 'var(--error)' : 'var(--success)' }}>
                {event.collision ? '✓' : '✗'}
              </td>
              <td>{event.response}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
