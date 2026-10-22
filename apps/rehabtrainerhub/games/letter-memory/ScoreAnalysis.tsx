import { useState } from 'react';
import { CalculateScoreStatistics } from './scoreStatistics';

interface ScoreColumn { key: string; zh: string; en: string; unit?: string; yesNo?: boolean }

const columns: ScoreColumn[] = [
  { key: 'responseMs', zh: '作答時間', en: 'Answer time', unit: 'ms' },
  { key: 'correctItems', zh: '位置正確的字母', en: 'Letters in place' },
  { key: 'load', zh: '這題的字母數', en: 'Letters shown' },
  { key: 'correct', zh: '4 個全對', en: 'All four right', yesNo: true },
  { key: 'practice', zh: '練習題', en: 'Practice item', yesNo: true },
];

export function ScoreAnalysis({ rounds, language }: { rounds: Record<string, number | null>[]; language: 'zh' | 'en' }) {
  const [metricKey, setMetricKey] = useState('responseMs');
  const [page, setPage] = useState(0);
  const metric = columns.find(item => item.key === metricKey)!;
  const statistics = CalculateScoreStatistics(rounds.map(row => row[metric.key] ?? null));
  const en = language === 'en';
  const numberFormat = new Intl.NumberFormat(en ? 'en' : 'zh-TW', { maximumFractionDigits: 2 });
  const missing = en ? 'N/A' : '無';
  const format = (value: number | null) => value === null ? missing : numberFormat.format(value);
  const measure = (value: number | null) => value === null ? missing : `${format(value)} ${metric.unit ?? ''}`.trim();
  const pageCount = Math.max(1, Math.ceil(rounds.length / 50));
  const pageRows = rounds.slice(page * 50, (page + 1) * 50);
  const minimum = Math.min(0, statistics.minimum ?? 0);
  const maximum = Math.max(minimum + 1, statistics.maximum ?? 1);
  const y = (value: number) => 184 - (value - minimum) / (maximum - minimum) * 154;
  const x = (index: number) => 56 + index / Math.max(1, pageRows.length - 1) * 480;
  let continueLine = false;
  const line = pageRows.map((row, index) => {
    const value = row[metric.key] ?? null;
    if (value === null) { continueLine = false; return ''; }
    const command = `${continueLine ? 'L' : 'M'}${x(index)},${y(value)}`;
    continueLine = true;
    return command;
  }).join(' ');
  const cell = (column: ScoreColumn, value: number | null | undefined) => {
    if (value === null || value === undefined) return missing;
    if (column.yesNo) return value ? (en ? 'Yes' : '是') : (en ? 'No' : '否');
    return format(value);
  };
  const detailsTitle = en ? 'Round details' : '逐回合細節';
  return <section className="score-analysis" aria-labelledby="score-analysis-title">
    <header className="score-section-header">
      <div className="score-section-title"><h3 id="score-analysis-title">{en ? 'Selected metric analysis' : '選定指標分析'}</h3>
        <p>{metric[language]}{metric.unit ? ` · ${metric.unit}` : ''}{metric.yesNo ? (en ? ' · 1 = yes' : ' · 1＝是') : ''}</p></div>
      <label>{en ? 'Metric' : '分析指標'}
        <select value={metricKey} onChange={event => { setMetricKey(event.target.value); setPage(0); }}>
          {columns.map(item => <option key={item.key} value={item.key}>{item[language]}{item.unit ? ` ${item.unit}` : ''}</option>)}
        </select>
      </label>
    </header>
    <dl className="score-statistics">
      <div className="score-statistic"><dt>{en ? 'Observations' : '有效筆數'}</dt><dd>{statistics.observations}</dd></div>
      <div className="score-statistic"><dt>{en ? 'Mean' : '平均數'}</dt><dd>{measure(statistics.mean)}</dd></div>
      <div className="score-statistic"><dt>{en ? 'Median' : '中位數'}</dt><dd>{measure(statistics.median)}</dd></div>
      <div className="score-statistic"><dt>{en ? 'Sample standard deviation' : '樣本標準差'}</dt><dd>{measure(statistics.sampleSd)}</dd></div>
      <div className="score-statistic"><dt>{en ? 'Range' : '範圍'}</dt><dd>{statistics.minimum === null ? missing : `${format(statistics.minimum)}–${format(statistics.maximum)} ${metric.unit ?? ''}`.trim()}</dd></div>
    </dl>
    <dl className="score-quality">
      <div className="score-quality-item"><dt>{en ? 'Recorded rounds' : '紀錄回合'}</dt><dd>{rounds.length}</dd></div>
      <div className="score-quality-item"><dt>{en ? 'Missing values' : '缺漏值'}</dt><dd>{rounds.length - statistics.observations}</dd></div>
      <div className="score-quality-item"><dt>{en ? 'Completeness' : '完整率'}</dt><dd>{rounds.length ? `${format(statistics.observations / rounds.length * 100)}%` : missing}</dd></div>
    </dl>
    <div className="score-chart">
      <p>{en ? 'Round-by-round trend' : '逐回合趨勢'} · {en ? 'Page' : '頁次'} {page + 1} / {pageCount}</p>
      {statistics.observations ? <svg viewBox="0 0 580 220" role="img" aria-label={`${en ? 'Trend' : '趨勢'} · ${metric[language]}`}>
        <path className="chart-axis" d="M56 30V184H536" />
        <text x="48" y="35" textAnchor="end">{format(maximum)}</text>
        <text x="48" y="184" textAnchor="end">{format(minimum)}</text>
        <text x="56" y="210">{page * 50 + 1}</text>
        <text x="536" y="210" textAnchor="end">{page * 50 + pageRows.length}</text>
        {statistics.mean !== null && <line className="chart-mean" x1="56" x2="536" y1={y(statistics.mean)} y2={y(statistics.mean)}>
          <title>{`${en ? 'Mean reference' : '平均值參考線'}: ${format(statistics.mean)}`}</title>
        </line>}
        <path className="chart-trend" d={line} />
        {pageRows.map((row, index) => row[metric.key] === null || row[metric.key] === undefined ? null
          : <circle key={index} tabIndex={0} cx={x(index)} cy={y(row[metric.key]!)} r="3.5">
            <title>{`${en ? 'Round' : '回合'} ${page * 50 + index + 1} · ${metric[language]}: ${format(row[metric.key] ?? null)} ${metric.unit ?? ''}`}</title>
          </circle>)}
      </svg> : <p>{en ? 'No numeric values are available for this metric.' : '此指標沒有可用數值。'}</p>}
      <p className="score-chart-legend">{en ? 'Dashed line: session mean. Focus a point to read its value.' : '虛線：當次平均值。可聚焦資料點讀取數值。'}</p>
    </div>
    <header className="score-section-header">
      <div className="score-section-title"><h3 id="score-details-title">{detailsTitle}</h3><p>{en ? 'One row per sequence, practice included.' : '每列是一題，包含練習題。'}</p></div>
      <span className="score-row-range">{pageRows.length ? page * 50 + 1 : 0}–{page * 50 + pageRows.length} / {rounds.length}</span>
    </header>
    <div className="results-scroll" role="region" aria-label={detailsTitle} tabIndex={0}>
      <table className="results-table" aria-label={detailsTitle}>
        <thead><tr><th scope="col">{en ? 'Round' : '回合'}</th>
          {columns.map(column => <th scope="col" key={column.key}>{column[language]}{column.unit ? ` ${column.unit}` : ''}</th>)}</tr></thead>
        <tbody>{pageRows.length ? pageRows.map((row, index) => <tr key={page * 50 + index}>
          <td>{page * 50 + index + 1}</td>
          {columns.map(column => <td key={column.key}>{cell(column, row[column.key])}</td>)}
        </tr>) : <tr><td colSpan={columns.length + 1}>{en ? 'No round records were provided.' : '此遊戲未提供逐回合紀錄。'}</td></tr>}</tbody>
      </table>
    </div>
    {pageCount > 1 && <nav className="score-pagination" aria-label={en ? 'Result pages' : '成績分頁'}>
      <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{en ? 'Previous' : '上一頁'}</button>
      <span>{en ? 'Page' : '頁次'} {page + 1} / {pageCount}</span>
      <button type="button" disabled={page + 1 === pageCount} onClick={() => setPage(page + 1)}>{en ? 'Next' : '下一頁'}</button>
    </nav>}
  </section>;
}
