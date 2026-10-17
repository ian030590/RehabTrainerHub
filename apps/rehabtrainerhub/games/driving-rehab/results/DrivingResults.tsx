import { ScoreAnalysis } from '../ScoreAnalysis';
import type { BuildGameScore, DrivingTrial } from '../score';

export function DrivingResults({ results, score, settings, language }: {
  results: DrivingTrial[]; score: ReturnType<typeof BuildGameScore>;
  settings: { label: string; value: string }[]; language: 'zh' | 'en';
}) {
  const en = language === 'en';
  const result = results.find(row => row.trial_type === 'three-driving-rehab');
  const labels = {
    durationMs: en ? 'Driving duration (ms)' : '模擬經過時間（ms）', meanRt: en ? 'Mean reaction time (ms)' : '平均反應時間（ms）',
    medianRt: en ? 'Median reaction time (ms)' : '反應時間中位數（ms）', events: en ? 'Valid events' : '有效事件數',
    responses: en ? 'Events with responses' : '有反應事件數', collisions: en ? 'Collisions' : '碰撞事件數',
    deviations: en ? 'Lane departures' : '偏離車道次數', fps: en ? 'Mean frame rate (Hz)' : '平均畫面更新率（Hz）',
    avoided: en ? 'Successful avoidance rounds' : '成功閃避回合數', rounds: en ? 'Event rounds' : '事件回合數',
  };
  const primary = ['meanRt', 'avoided', 'rounds', 'collisions'];
  return <>
    <section className="score-priority" aria-label={en ? 'Key results' : '主要成果'}><dl className="score-key-metrics">
      {primary.map(key => <div className="score-key-metric" key={key}><dt>{labels[key as keyof typeof labels]}</dt><dd>{score.summary[key as keyof typeof score.summary] ?? '—'}</dd></div>)}
    </dl></section>
    <section className="score-context"><h3>{en ? 'Session context' : '當次概況'}</h3><dl className="score-context-list">
      {Object.entries(score.summary).filter(([key]) => !primary.includes(key)).map(([key, value]) => <div className="score-context-item" key={key}><dt>{labels[key as keyof typeof labels]}</dt><dd>{value ?? '—'}</dd></div>)}
      {settings.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      <div className="score-context-item"><dt>{en ? 'Route' : '路線'}</dt><dd>{String(result?.route_label ?? result?.route_id ?? '—')}</dd></div>
      <div className="score-context-item"><dt>{en ? 'Completion' : '完成狀態'}</dt><dd>{result?.response === 'completed' ? (en ? 'Route completed' : '路線完成') : (en ? 'Time ended' : '時間結束')}</dd></div>
      <div className="score-context-item"><dt>{en ? 'Measured display refresh rate' : '實測螢幕更新率'}</dt><dd>{result?.refresh_measurement_valid ? `${result.display_refresh_hz} Hz` : (en ? 'Unknown' : '未知')}</dd></div>
    </dl></section>
    <ScoreAnalysis rounds={score.rounds} language={language} details={(result?.driving_events ?? []).map(event => ({ ...event, reaction_frames: result?.refresh_measurement_valid ? event.reaction_frames : null }))} />
  </>;
}
