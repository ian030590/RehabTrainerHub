import { useState } from 'react';
import { CalculateScoreStatistics } from './scoreStatistics';

const metrics = [
  { key: 'object', zh: '物件序號', en: 'Object number' },
  { key: 'elapsed', zh: '生成至物件結局時間（秒）', en: 'Spawn to outcome time (s)' },
  { key: 'damage', zh: '造成傷害', en: 'Damage' },
  { key: 'hp', zh: '結局後耐久', en: 'HP after outcome' },
  { key: 'speedLevel', zh: '物件速度級別', en: 'Speed level' },
] as const;

export function ScoreAnalysis({ rounds, language }: {
  rounds: Record<string, number | null>[];
  language: 'zh' | 'en';
}) {
  const [metricKey, setMetricKey] = useState('elapsed');
  const [page, setPage] = useState(0);
  const metric = metrics.find(item => item.key === metricKey)!;
  const statistics = CalculateScoreStatistics(rounds.map(row => row[metric.key]));
  const format = (value: number | null) => value === null ? '—' : new Intl.NumberFormat(language === 'en' ? 'en' : 'zh-TW', { maximumFractionDigits: 2 }).format(value);
  const pageCount = Math.max(1, Math.ceil(rounds.length / 50));
  const pageRows = rounds.slice(page * 50, (page + 1) * 50);
  const minimum = Math.min(0, statistics.minimum ?? 0);
  const maximum = Math.max(minimum + 1, statistics.maximum ?? 1);
  const y = (value: number) => 184 - (value - minimum) / (maximum - minimum) * 154;
  const x = (index: number) => 56 + index / Math.max(1, pageRows.length - 1) * 480;
  let continueLine = false;
  const line = pageRows.map((row, index) => {
    const value = row[metric.key];
    if (value === null) { continueLine = false; return ''; }
    const command = `${continueLine ? 'L' : 'M'}${x(index)},${y(value)}`;
    continueLine = true;
    return command;
  }).join(' ');
  const en = language === 'en';
  return <section className="score-analysis" aria-labelledby="score-analysis-title">
    <h2 id="score-analysis-title">{en ? 'Selected metric analysis' : '當次指標分析'}</h2>
    <p>{en ? 'These observations describe this session, not a diagnosis or a comparison between people.' : '這些數值描述當次活動，不代表診斷或不同人之間的比較。'}</p>
    <label>{en ? 'Metric' : '分析指標'}
      <select value={metricKey} onChange={event => { setMetricKey(event.target.value); setPage(0); }}>
        {metrics.map(item => <option key={item.key} value={item.key}>{item[language]}</option>)}
      </select>
    </label>
    <dl className="score-statistics">
      <div><dt>{en ? 'Observations' : '有效筆數'}</dt><dd>{statistics.observations}</dd></div>
      <div><dt>{en ? 'Mean' : '平均'}</dt><dd>{format(statistics.mean)}</dd></div>
      <div><dt>{en ? 'Median' : '中位數'}</dt><dd>{format(statistics.median)}</dd></div>
      <div><dt>{en ? 'Sample standard deviation' : '樣本標準差'}</dt><dd>{format(statistics.sampleSd)}</dd></div>
      <div><dt>{en ? 'Range' : '範圍'}</dt><dd>{format(statistics.minimum)}–{format(statistics.maximum)}</dd></div>
    </dl>
    {statistics.observations ? <svg viewBox="0 0 580 220" role="img" aria-label={`${en ? 'Trend' : '趨勢'} · ${metric[language]}`}>
      <path className="chart-axis" d="M56 30V184H536" />
      <text x="48" y="35" textAnchor="end">{format(maximum)}</text>
      <text x="48" y="184" textAnchor="end">{format(minimum)}</text>
      <text x="56" y="210">{page * 50 + 1}</text>
      <text x="536" y="210" textAnchor="end">{page * 50 + pageRows.length}</text>
      {statistics.mean !== null && <line className="chart-mean" x1="56" x2="536" y1={y(statistics.mean)} y2={y(statistics.mean)}><title>{en ? 'Mean' : '平均'}: {format(statistics.mean)}</title></line>}
      <path className="chart-trend" d={line} />
      {pageRows.map((row, index) => row[metric.key] === null ? null : <circle key={index} tabIndex={0} cx={x(index)} cy={y(row[metric.key]!)} r="3.5">
        <title>{en ? 'Object' : '物件'} {page * 50 + index + 1} · {metric[language]}: {format(row[metric.key])}</title>
      </circle>)}
    </svg> : <p>{en ? 'No numeric values are available for this metric.' : '此指標沒有可用數值。'}</p>}
    {pageCount > 1 && <nav aria-label={en ? 'Result chart pages' : '成果趨勢分頁'}>
      <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{en ? 'Previous' : '上一頁'}</button>
      <span>{page + 1} / {pageCount}</span>
      <button type="button" disabled={page + 1 === pageCount} onClick={() => setPage(page + 1)}>{en ? 'Next' : '下一頁'}</button>
    </nav>}
    <p>{en ? 'Missing values' : '缺失筆數'}: {rounds.length - statistics.observations} · {en ? 'Completeness' : '完整率'}: {format(rounds.length ? statistics.observations / rounds.length * 100 : null)}%</p>
  </section>;
}
