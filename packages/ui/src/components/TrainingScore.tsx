'use client';

import { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { GameScore, GameScoreDefinition } from '../gameScore';
import { Button } from './ui/button';
import { ChartContainer, ChartTooltip } from './ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

export function TrainingScore({ score, definition, title, language, onClose, saveState, onRetry }: {
  score: GameScore;
  definition: GameScoreDefinition;
  title: string;
  language: 'zh' | 'en';
  onClose: () => void;
  saveState: 'guest' | 'saving' | 'saved' | 'error';
  onRetry: () => void;
}) {
  const [metricKey, setMetricKey] = useState(definition.columns[0].key);
  const [page, setPage] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);
  const field = definition.columns.find(column => column.key === metricKey) ?? definition.columns[0];
  const en = language === 'en';
  const format = (value: number | null) => value === null ? '—' : new Intl.NumberFormat(en ? 'en' : 'zh-TW', { maximumFractionDigits: 2 }).format(value);
  const values = score.rounds.map(row => row[field.key]).filter((value): value is number => value !== null);
  const chartData: (Record<string, number | null> & { round: number })[] = score.rounds.slice(page * 50, (page + 1) * 50).map((row, index) => ({ ...row, round: page * 50 + index + 1 }));
  const summary = definition.summary.filter(item => score.summary[item.key] !== null);
  return <section className="training-score mx-auto grid w-full max-w-5xl gap-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-xl sm:p-8" aria-labelledby="training-score-title">
    <header><p className="m-0 text-sm font-semibold text-[var(--primary)]">{en ? 'Session results' : '當次成績'}</p>
      <h2 ref={titleRef} id="training-score-title" tabIndex={-1} className="my-2 text-2xl font-bold text-[var(--heading)]">{title}</h2>
      <p className="m-0 text-sm text-[var(--text-muted)]">{en ? 'Practice records only. Missing values are shown as —.' : '僅為當次練習紀錄。未提供的數值以 — 顯示。'}</p>
    </header>
    <dl className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[{ label: en ? 'Recorded rounds' : '紀錄回合', value: score.rounds.length, unit: '' },
        { label: `${en ? 'Mean' : '平均'} · ${field.label[language]}`, value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, unit: field.unit },
        { label: `${en ? 'Minimum' : '最小值'} · ${field.label[language]}`, value: values.length ? Math.min(...values) : null, unit: field.unit },
        { label: `${en ? 'Maximum' : '最大值'} · ${field.label[language]}`, value: values.length ? Math.max(...values) : null, unit: field.unit },
        ...(field.total ? [{ label: `${en ? 'Total' : '總計'} · ${field.label[language]}`, value: values.length ? field.total === 'last' ? values.at(-1)! : values.reduce((a, b) => a + b, 0) : null, unit: field.unit }] : []),
        ...summary.map(item => ({ label: item.label[language], value: score.summary[item.key], unit: item.unit })),
      ].map((item, index) => <div key={index} className="border-l-2 border-[var(--primary)] pl-4">
        <dt className="text-sm text-[var(--text-muted)]">{item.label}</dt>
        <dd className="m-0 mt-2 text-2xl font-semibold tabular-nums">{format(item.value)} <span className="text-sm font-normal">{item.unit}</span></dd>
      </div>)}
    </dl>
    <label className="grid max-w-xs gap-2 text-sm font-semibold">{en ? 'Chart metric' : '圖表指標'}
      <select className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)]" value={metricKey} onChange={event => setMetricKey(event.target.value)}>
        {definition.columns.map(column => <option key={column.key} value={column.key}>{column.label[language]} {column.unit}</option>)}
      </select>
    </label>
    {values.length > 0 ? <ChartContainer config={{ value: { label: field.label[language], color: 'var(--primary)' } }} aria-label={field.label[language]}>
      <BarChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} /><XAxis dataKey="round" tickLine={false} axisLine={false} /><YAxis width={65} tickLine={false} axisLine={false} />
        <ChartTooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} labelFormatter={value => `${en ? 'Round' : '回合'} ${value}`} />
        <Bar dataKey={field.key} name={field.label[language]} unit={field.unit} fill="var(--color-value)" radius={4} isAnimationActive={false} />
      </BarChart>
    </ChartContainer> : <p>{en ? 'No chart values available.' : '尚無可繪製的數值。'}</p>}
    <Table aria-label={en ? 'Round results' : '逐回合成績'}>
      <TableHeader><TableRow><TableHead>{en ? 'Round' : '回合'}</TableHead>{definition.columns.map(column => <TableHead key={column.key}>{column.label[language]} {column.unit}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{chartData.length ? chartData.map(row => <TableRow key={row.round}><TableCell>{row.round}</TableCell>{definition.columns.map(column => <TableCell key={column.key}>{format(row[column.key])}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={definition.columns.length + 1}>{en ? 'No round records were provided.' : '此遊戲未提供逐回合紀錄。'}</TableCell></TableRow>}</TableBody>
    </Table>
    {score.rounds.length > 50 && <nav aria-label={en ? 'Result pages' : '成績分頁'} className="flex items-center gap-3">
      <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>{en ? 'Previous' : '上一頁'}</Button>
      <span>{page + 1} / {Math.ceil(score.rounds.length / 50)}</span>
      <Button variant="outline" disabled={(page + 1) * 50 >= score.rounds.length} onClick={() => setPage(page + 1)}>{en ? 'Next' : '下一頁'}</Button>
    </nav>}
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
      <p className="m-0 text-sm text-[var(--text-muted)]" role="status">{({ guest: en ? 'Not signed in · this session is not uploaded.' : '未登入，本次紀錄不會上傳。', saving: en ? 'Saving…' : '儲存中…', saved: en ? 'Saved to your account.' : '已儲存至帳號。', error: en ? 'Save failed. Your results remain here; retry before leaving.' : '儲存失敗，成績仍保留於此。離開前可重試。' })[saveState]}</p>
      {saveState === 'error' && <Button onClick={onRetry} variant="outline">{en ? 'Retry save' : '重試儲存'}</Button>}
      <Button onClick={onClose}>{en ? 'Back to lobby' : '返回大廳'}</Button>
    </footer>
  </section>;
}
