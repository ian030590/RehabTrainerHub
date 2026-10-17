import { useState } from 'react';
import { BuildGameScore, scoreMetrics, type ExperimentResult } from './score';
import { IsHubGame, SendGameEvent } from './runtime/hubBridge';

export function OculomotorResults({ result, summaryItems, language, saveState, onRetry, onExit }: {
  result: ExperimentResult; summaryItems: { label: string; value: string }[]; language: 'zh' | 'en'; saveState: string; onRetry: () => void; onExit: () => void;
}) {
  const en = language === 'en';
  const [metricKey, setMetricKey] = useState('accuracy');
  const score = BuildGameScore(result);
  const metric = scoreMetrics.find(field => field.key === metricKey)!;
  const metricValue = score.summary[metricKey];
  const axisStep = Math.pow(10, Math.floor(Math.log10(Math.max(1, metricValue ?? 0))));
  const axisMax = metricKey === 'accuracy' ? 100 : Math.max(1, Math.ceil((metricValue ?? 0) / axisStep) * axisStep);
  const barHeight = metricValue == null ? 0 : 105 * metricValue / axisMax;
  const missing = en ? 'Missing' : '缺測';
  const valueText = (value: number | null | undefined, unit = '') => value == null ? missing : `${value}${unit ? ' ' + unit : ''}`;
  const directionLabels: Record<string, string> = { center: en ? 'Center' : '中央',
    leftUp: en ? 'Top left' : '左上', middleUp: en ? 'Up' : '上', rightUp: en ? 'Top right' : '右上',
    leftMiddle: en ? 'Left' : '左', rightMiddle: en ? 'Right' : '右',
    leftDown: en ? 'Bottom left' : '左下', middleDown: en ? 'Down' : '下', rightDown: en ? 'Bottom right' : '右下' };
  const fixationStatuses: Record<string, string> = { detected: en ? 'Detected' : '已偵測',
    no_valid_samples: en ? 'No valid samples' : '無有效樣本', no_movement_detected: en ? 'No movement detected' : '未偵測到移動',
    no_confirmed_fixation: en ? 'No stable fixation detected' : '未偵測到穩定注視' };
  return <div className={`experiment-container results-container${IsHubGame() ? '' : ' results-standalone'}`}><section className="experiment-results">
    <header className="score-header"><h1>{en ? 'Session results' : '當次成果'}</h1><p>{en ? 'These are session activity records, not diagnosis or treatment effects.' : '這些數值為當次活動紀錄，不代表診斷或療效。'}</p></header>
    <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
      <div className="score-key-metric"><p>{en ? 'Accuracy' : '在標比例 Accuracy'}</p><strong>{valueText(result.accuracy_rate, '%')}</strong>
        <p>{en ? 'On target duration / valid gaze duration' : '在標時間／有效眼動時間'}</p>
        <p>{valueText(result.in_threshold_sec, 's')} / {valueText(result.valid_sec, 's')}</p></div>
      <div className="score-key-metric"><p>{en ? 'Mean time to first fixation (TFF)' : '首次注視平均時間 TFF'}</p>
        <strong>{result.module === 'saccade' ? valueText(result.tff_mean_ms, 'ms') : (en ? 'Not applicable' : '不適用')}</strong>
        <p>{result.module === 'saccade' ? `${valueText(result.tff_detected_targets)} / ${valueText(result.tff_total_targets)} ${en ? 'targets detected' : '個目標偵測到首次注視'}` : (en ? 'Available for saccade practice' : '僅適用於跳視練習')}</p></div>
    </div><p className="score-accuracy-definition">{en ? 'Accuracy uses the original activity scoring phases and hit threshold. Invalid gaze is excluded from valid duration; missing data is not zero.' : 'Accuracy 沿用原程式各活動的計分階段與在標門檻。無效眼動不計入有效時間；缺測不當作零分。'}</p></section>
    {result.module === 'saccade' && <section className="score-tff"><h2>{en ? 'Time to first fixation (TFF)' : '首次注視時間統計（TFF）'}</h2>
      <p>{en ? 'Measured from target onset to the first stable fixation after eye movement; a target hit is not required. The mean includes detected targets only.' : '從目標出現到眼動後首次穩定注視的時間，不要求注視落在目標範圍。平均值只計入已偵測的目標。'}</p>
      {result.tff_analysis?.targets.length ? <div className="results-scroll" tabIndex={0} role="region" aria-label={en ? 'TFF target details' : 'TFF 逐目標明細'}><table className="tff-table"><thead><tr><th scope="col">{en ? 'Target' : '目標'}</th><th scope="col">{en ? 'Direction' : '方向'}</th><th scope="col">TFF (ms)</th><th scope="col">{en ? 'Status' : '狀態'}</th></tr></thead>
        <tbody>{result.tff_analysis.targets.map(target => <tr key={target.target_number}><td>{target.target_number}</td><td>{directionLabels[target.direction] ?? (en ? 'Unknown' : '未知')}</td><td>{valueText(target.tff_ms)}</td><td>{fixationStatuses[target.status] ?? missing}</td></tr>)}</tbody></table></div>
        : <p>{en ? 'No TFF observations. Enable gaze tracking and complete saccade practice to collect them.' : '沒有 TFF 觀測資料；需啟用眼動追蹤並完成跳視練習。'}</p>}
    </section>}
    <section className="score-analysis"><div className="score-section-header"><div className="score-analysis-heading"><h2 className="score-section-title">{en ? 'Session analysis' : '活動數值分析'}</h2><p>{en ? 'One row represents one complete stimulus activity.' : '一筆資料代表完整的一次刺激活動。'}</p></div>
      <label>{en ? 'Metric' : '指標'}<select value={metricKey} onChange={event => setMetricKey(event.target.value)}>{scoreMetrics.map(field => <option key={field.key} value={field.key}>{field.label[language]}</option>)}</select></label></div>
      <dl className="score-statistics">
        {[{ label: en ? 'Valid observations' : '有效筆數', value: metricValue == null ? '0 / 1' : '1 / 1' },
          { label: en ? 'Mean' : '平均', value: valueText(metricValue, metric.unit) }, { label: en ? 'Median' : '中位數', value: valueText(metricValue, metric.unit) },
          { label: en ? 'Sample SD' : '樣本標準差', value: missing }, { label: en ? 'Range' : '範圍', value: metricValue == null ? missing : `${metricValue}–${metricValue} ${metric.unit}` }]
          .map(item => <div className="score-statistic" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl>
      <div className="score-chart"><p>{metric.label[language]}</p><svg role="img" aria-label={metric.label[language]} viewBox="0 0 600 200">
        <path className="chart-axis" d="M100 45V150H540" />
        <text x="90" y="50" textAnchor="end">{axisMax}</text><text x="90" y="155" textAnchor="end">0</text>
        {metricValue == null ? <text x="300" y="90" textAnchor="middle">{missing}</text> : <><rect className="chart-bar" x="230" y={150 - barHeight} width="140" height={Math.max(1, barHeight)} /><text x="300" y="30" textAnchor="middle">{valueText(metricValue, metric.unit)}</text><text x="300" y="180" textAnchor="middle">{en ? 'Activity 1' : '活動 1'}</text></>}
      </svg><p className="score-chart-legend">{en ? 'Single activity value; missing gaze is not replaced with zero. Sample SD requires at least two observations.' : '顯示單次活動值；缺測眼動不補零。樣本標準差至少需要兩筆有效資料。'}</p></div>
      <div className="results-scroll" tabIndex={0} role="region" aria-label={en ? 'Complete numeric activity record' : '完整數值活動紀錄'}><table className="results-table"><caption>{en ? 'Activity details' : '活動明細'}</caption>
        <thead><tr>{scoreMetrics.map(field => <th key={field.key} scope="col">{field.label[language]} {field.unit}</th>)}</tr></thead>
        <tbody><tr>{scoreMetrics.map(field => <td key={field.key}>{valueText(score.summary[field.key])}</td>)}</tr></tbody>
      </table></div>
    </section>
    <section className="score-context"><h2>{en ? 'Session metadata and settings' : '當次設定與中繼資料'}</h2><dl className="score-context-list">
      {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      <div className="score-context-item"><dt>{en ? 'Actual gaze source' : '實際眼動來源'}</dt><dd>{result.eye_tracking_source === 'webgazer' ? 'WebGazer' : (en ? 'Off' : '不記錄')}</dd></div>
      <div className="score-context-item"><dt>{en ? 'End reason' : '結束原因'}</dt><dd>{result.end_reason === 'duration_complete' ? (en ? 'Configured duration completed' : '已完成設定時間') : result.end_reason === 'escape' ? (en ? 'Ended with Escape' : '按 Esc 結束') : (en ? 'Session interrupted' : '練習中斷')}</dd></div>
    </dl></section>
    <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local practice. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
      : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'CSV or result save failed. Retry with the same session.' : 'CSV 或成果保存失敗，請使用同一工作階段重試。') : (en ? 'Saving…' : '保存中…')}</p>
    {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={onRetry}>{en ? 'Retry save' : '重試保存'}</button>}
    <button className="btn btn-ghost score-download-button" type="button" onClick={() => SendGameEvent('csv-download')}>{en ? 'Download CSV' : '下載 CSV'}</button>
    <button className="btn btn-primary score-return-button" type="button" onClick={onExit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
  </section></div>;
}
