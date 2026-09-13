'use client';

import './TrainingScore.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import type { GameScore, GameScoreDefinition, ScoreField } from '../gameScore';
import { Button } from './ui/button';
import { ChartContainer, ChartTooltip } from './ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

type SaveState = 'guest' | 'saving' | 'saved' | 'error';

interface TrainingScoreProps {
  score: GameScore;
  definition: GameScoreDefinition;
  title: string;
  language: 'zh' | 'en';
  onClose: () => void;
  saveState: SaveState;
  onRetry: () => void;
}

interface SummaryMetric {
  field: ScoreField;
  value: number;
}

const qualityFieldPattern = /(invalid|dropped|fps|sync|aborted|interrupted)/i;
const primaryFieldPattern = /(accuracy|score|threshold|mean|median|best|response|latency|aoi|tracking|correct|completed|success|hit|caught|blocked|distance|fixation|hold|collision|deviation|error|miss|hp|lives)/i;
const contextFieldPattern = /(duration|trial|attempt|event|sample|target|question|spawn|tap|move|board|level|setting|word|presented|language|passage|load|strictness|speed|angle|contrast)/i;
const identifierFieldPattern = /^(trial|object|question|cast|event|targetIndex|tappedIndex|condition|setting|location|key|problem|subtest|axis|level|load|boardSize|puzzleKind|choice|expectedChoice|options|language)$/i;

function GetSummaryPriority(field: ScoreField) {
  if (primaryFieldPattern.test(field.key)) return 0;
  if (contextFieldPattern.test(field.key)) return 2;
  return 1;
}

function GetMetricPriority(field: ScoreField) {
  if (identifierFieldPattern.test(field.key)) return -100;
  if (/(accuracy|score|threshold|aoi)/i.test(field.key)) return 60;
  if (/(response|latency|mean|median|fixation|search|problemMs)/i.test(field.key)) return 55;
  if (/(correct|completed|success|similarity|tracking|distance|hold|hit|caught|blocked|error|collision|deviation)/i.test(field.key)) return 50;
  if (/(duration|elapsed|exposure)/i.test(field.key)) return 30;
  return (field.unit ? 5 : 0) + (field.total ? 5 : 0);
}

function GetDefaultMetricKey(columns: ScoreField[]) {
  return columns.reduce((best, field) => (
    GetMetricPriority(field) > GetMetricPriority(best) ? field : best
  ), columns[0]).key;
}

function CalculateStatistics(values: number[]) {
  if (!values.length) return { mean: null, median: null, sampleSd: null, minimum: null, maximum: null };
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const sampleSd = values.length > 1
    ? Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1))
    : null;
  return { mean, median, sampleSd, minimum: sorted[0], maximum: sorted.at(-1) ?? null };
}

export function TrainingScore({ score, definition, title, language, onClose, saveState, onRetry }: TrainingScoreProps) {
  const [metricKey, setMetricKey] = useState(() => GetDefaultMetricKey(definition.columns));
  const [page, setPage] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const en = language === 'en';
  const copy = en ? {
    eyebrow: 'Session results',
    note: 'Practice records only. Values shown here are descriptive and are not a diagnosis or treatment outcome.',
    keyTitle: 'Key outcomes',
    keyDescription: 'Session-level results supplied by this activity, prioritizing outcome, accuracy, and speed fields.',
    noSummary: 'No session-level result was provided.',
    contextTitle: 'Record context',
    qualityTitle: 'Data quality',
    recordedRounds: 'Recorded rounds',
    usableValues: 'Usable values',
    missingValues: 'Missing values',
    completeness: 'Completeness',
    analysisTitle: 'Selected metric analysis',
    chartMetric: 'Metric',
    observations: 'n observations',
    mean: 'Mean',
    median: 'Median',
    sampleSd: 'Sample SD',
    range: 'Range',
    total: 'Total',
    trend: 'Round-by-round trend',
    meanReference: 'Mean reference',
    noChart: 'No numeric values are available for this metric.',
    detailsTitle: 'Round details',
    detailsDescription: 'Raw numeric fields retained for verification and further analysis.',
    round: 'Round',
    noRows: 'No round records were provided.',
    page: 'Page',
    previous: 'Previous',
    next: 'Next',
    back: 'Back to lobby',
    retry: 'Retry save',
  } : {
    eyebrow: '當次成績',
    note: '僅呈現本次練習的描述統計，不代表診斷、治療結果或療效。',
    keyTitle: '重點指標',
    keyDescription: '優先顯示活動提供的結果、正確性與速度相關彙總值。',
    noSummary: '此活動未提供當次彙總值。',
    contextTitle: '紀錄概況',
    qualityTitle: '資料品質',
    recordedRounds: '紀錄回合',
    usableValues: '有效數值',
    missingValues: '缺漏值',
    completeness: '完整率',
    analysisTitle: '選定指標分析',
    chartMetric: '分析指標',
    observations: '觀測值 n',
    mean: '平均數',
    median: '中位數',
    sampleSd: '樣本標準差',
    range: '範圍',
    total: '總計',
    trend: '逐回合趨勢',
    meanReference: '平均值參考線',
    noChart: '此指標沒有可分析的數值。',
    detailsTitle: '逐回合細節',
    detailsDescription: '保留原始數值欄位，供核對與後續分析使用。',
    round: '回合',
    noRows: '此遊戲未提供逐回合紀錄。',
    page: '頁次',
    previous: '上一頁',
    next: '下一頁',
    back: '返回大廳',
    retry: '重試儲存',
  };

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    setMetricKey(GetDefaultMetricKey(definition.columns));
    setPage(0);
  }, [definition]);

  const numberFormat = useMemo(() => new Intl.NumberFormat(en ? 'en' : 'zh-TW', {
    maximumFractionDigits: 2,
  }), [en]);
  const format = (value: number | null) => value === null ? '—' : numberFormat.format(value);
  const field = definition.columns.find(column => column.key === metricKey) ?? definition.columns[0];
  const values = useMemo(() => score.rounds
    .map(row => row[field.key])
    .filter((value): value is number => value !== null), [field.key, score.rounds]);
  const statistics = useMemo(() => CalculateStatistics(values), [values]);
  const pageCount = Math.max(1, Math.ceil(score.rounds.length / 50));
  const chartData: (Record<string, number | null> & { round: number })[] = score.rounds
    .slice(page * 50, (page + 1) * 50)
    .map((row, index) => ({ ...row, round: page * 50 + index + 1 }));
  const pageStart = chartData.length ? page * 50 + 1 : 0;
  const pageEnd = page * 50 + chartData.length;
  const missingCount = score.rounds.length - values.length;
  const completeness = score.rounds.length ? values.length / score.rounds.length * 100 : null;
  const total = field.total && values.length
    ? field.total === 'last' ? values.at(-1) ?? null : values.reduce((sum, value) => sum + value, 0)
    : null;

  const summaryMetrics: SummaryMetric[] = definition.summary.flatMap(summaryField => {
    const value = score.summary[summaryField.key];
    return value === null ? [] : [{ field: summaryField, value }];
  });
  const nonQualityMetrics = summaryMetrics.filter(metric => !qualityFieldPattern.test(metric.field.key));
  const primaryPool = nonQualityMetrics.length ? nonQualityMetrics : summaryMetrics;
  const primaryMetrics = [...primaryPool]
    .sort((a, b) => GetSummaryPriority(a.field) - GetSummaryPriority(b.field))
    .slice(0, 4);
  const primaryKeys = new Set(primaryMetrics.map(metric => metric.field.key));
  const qualityMetrics = summaryMetrics.filter(metric => qualityFieldPattern.test(metric.field.key) && !primaryKeys.has(metric.field.key));
  const contextMetrics = summaryMetrics.filter(metric => !primaryKeys.has(metric.field.key) && !qualityFieldPattern.test(metric.field.key));

  const saveMessage = ({
    guest: en ? 'Not signed in · this session is not uploaded.' : '未登入，本次紀錄不會上傳。',
    saving: en ? 'Saving…' : '儲存中…',
    saved: en ? 'Saved to your account.' : '已儲存至帳號。',
    error: en ? 'Save failed. Your results remain here; retry before leaving.' : '儲存失敗，成績仍保留於此。離開前可重試。',
  } satisfies Record<SaveState, string>)[saveState];

  return <section className="training-score" aria-labelledby="training-score-title">
    <div className="training-score-toolbar">
      <p role="status" aria-live="polite">{saveMessage}</p>
      <div>
        {saveState === 'error' && <Button onClick={onRetry} variant="outline">{copy.retry}</Button>}
        <Button className="training-score-return" onClick={onClose}>{copy.back}</Button>
      </div>
    </div>
    <header className="training-score-header">
      <div>
        <p className="training-score-eyebrow">{copy.eyebrow}</p>
        <h2 ref={titleRef} id="training-score-title" tabIndex={-1}>{title}</h2>
        <p className="training-score-note">{copy.note}</p>
      </div>
      <dl className="training-score-record-count">
        <div><dt>{copy.recordedRounds}</dt><dd>{numberFormat.format(score.rounds.length)}</dd></div>
      </dl>
    </header>

    <section className="training-score-section training-score-priority" aria-labelledby="training-score-priority-title">
      <header className="training-score-section-header">
        <div><h3 id="training-score-priority-title">{copy.keyTitle}</h3><p>{copy.keyDescription}</p></div>
      </header>
      {primaryMetrics.length ? <dl className="training-score-key-grid">
        {primaryMetrics.map((metric, index) => <div className={index === 0 ? 'training-score-key-metric is-leading' : 'training-score-key-metric'} key={metric.field.key}>
          <dt>{metric.field.label[language]}</dt>
          <dd>{format(metric.value)} {metric.field.unit && <small>{metric.field.unit}</small>}</dd>
        </div>)}
      </dl> : <p className="training-score-empty">{copy.noSummary}</p>}
    </section>

    <div className="training-score-secondary-grid">
      <section className="training-score-section" aria-labelledby="training-score-context-title">
        <header className="training-score-section-header is-compact"><h3 id="training-score-context-title">{copy.contextTitle}</h3></header>
        <dl className="training-score-compact-list">
          {contextMetrics.map(metric => <div key={metric.field.key}>
            <dt>{metric.field.label[language]}</dt><dd>{format(metric.value)} {metric.field.unit && <small>{metric.field.unit}</small>}</dd>
          </div>)}
          {!contextMetrics.length && <div><dt>{copy.recordedRounds}</dt><dd>{numberFormat.format(score.rounds.length)}</dd></div>}
        </dl>
      </section>
      <section className="training-score-section training-score-quality" aria-labelledby="training-score-quality-title">
        <header className="training-score-section-header is-compact"><h3 id="training-score-quality-title">{copy.qualityTitle}</h3></header>
        <dl className="training-score-compact-list">
          <div><dt>{copy.usableValues}</dt><dd>{numberFormat.format(values.length)}</dd></div>
          <div><dt>{copy.missingValues}</dt><dd>{numberFormat.format(missingCount)}</dd></div>
          <div><dt>{copy.completeness}</dt><dd>{format(completeness)} <small>%</small></dd></div>
          {qualityMetrics.map(metric => <div key={metric.field.key}>
            <dt>{metric.field.label[language]}</dt><dd>{format(metric.value)} {metric.field.unit && <small>{metric.field.unit}</small>}</dd>
          </div>)}
        </dl>
      </section>
    </div>

    <section className="training-score-section training-score-analysis" aria-labelledby="training-score-analysis-title">
      <header className="training-score-section-header training-score-analysis-header">
        <div><h3 id="training-score-analysis-title">{copy.analysisTitle}</h3><p>{field.label[language]}{field.unit ? ` · ${field.unit}` : ''}</p></div>
        <label className="training-score-metric-select">{copy.chartMetric}
          <select value={metricKey} onChange={event => { setMetricKey(event.target.value); setPage(0); }}>
            {definition.columns.map(column => <option key={column.key} value={column.key}>{column.label[language]} {column.unit}</option>)}
          </select>
        </label>
      </header>
      <dl className="training-score-stat-strip">
        <div><dt>{copy.observations}</dt><dd>{numberFormat.format(values.length)}</dd></div>
        <div><dt>{copy.mean}</dt><dd>{format(statistics.mean)} {field.unit && <small>{field.unit}</small>}</dd></div>
        <div><dt>{copy.median}</dt><dd>{format(statistics.median)} {field.unit && <small>{field.unit}</small>}</dd></div>
        <div><dt>{copy.sampleSd}</dt><dd>{format(statistics.sampleSd)} {field.unit && <small>{field.unit}</small>}</dd></div>
        <div><dt>{copy.range}</dt><dd>{format(statistics.minimum)}–{format(statistics.maximum)} {field.unit && <small>{field.unit}</small>}</dd></div>
        {field.total && <div><dt>{copy.total}</dt><dd>{format(total)} {field.unit && <small>{field.unit}</small>}</dd></div>}
      </dl>
      {values.length > 0 ? <div className="training-score-chart-wrap">
        <p>{copy.trend}<span>{copy.page} {page + 1} / {pageCount}</span></p>
        <ChartContainer config={{ value: { label: field.label[language], color: 'var(--primary)' } }} className="training-score-chart" role="img" aria-label={`${copy.trend} · ${field.label[language]}`}>
          <LineChart accessibilityLayer data={chartData} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="round" tickLine={false} axisLine={false} />
            <YAxis width={65} tickLine={false} axisLine={false} />
            <ChartTooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} labelFormatter={value => `${copy.round} ${value}`} />
            {statistics.mean !== null && <ReferenceLine y={statistics.mean} stroke="var(--border-strong)" strokeDasharray="5 5" label={{ value: copy.meanReference, fill: 'var(--text-muted)', fontSize: 11, position: 'insideTopRight' }} />}
            <Line dataKey={field.key} name={field.label[language]} unit={field.unit} stroke="var(--color-value)" strokeWidth={2.5} type="linear" dot={chartData.length <= 20 ? { r: 3, fill: 'var(--surface)', strokeWidth: 2 } : false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ChartContainer>
      </div> : <p className="training-score-empty">{copy.noChart}</p>}
    </section>

    <section className="training-score-section training-score-details" aria-labelledby="training-score-details-title">
      <header className="training-score-section-header">
        <div><h3 id="training-score-details-title">{copy.detailsTitle}</h3><p>{copy.detailsDescription}</p></div>
        <span className="training-score-row-range">{pageStart}–{pageEnd} / {score.rounds.length}</span>
      </header>
      <Table aria-label={copy.detailsTitle}>
        <TableHeader><TableRow><TableHead>{copy.round}</TableHead>{definition.columns.map(column => <TableHead key={column.key}>{column.label[language]} {column.unit}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{chartData.length ? chartData.map(row => <TableRow key={row.round}><TableCell>{row.round}</TableCell>{definition.columns.map(column => <TableCell key={column.key}>{format(row[column.key])}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={definition.columns.length + 1}>{copy.noRows}</TableCell></TableRow>}</TableBody>
      </Table>
      {score.rounds.length > 50 && <nav aria-label={en ? 'Result pages' : '成績分頁'} className="training-score-pagination">
        <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>{copy.previous}</Button>
        <span>{copy.page} {page + 1} / {pageCount}</span>
        <Button variant="outline" disabled={(page + 1) * 50 >= score.rounds.length} onClick={() => setPage(page + 1)}>{copy.next}</Button>
      </nav>}
    </section>

  </section>;
}
