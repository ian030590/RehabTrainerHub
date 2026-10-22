import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, rangeSettings, ValidateSettings, type SchulteSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { SchulteTutorial } from './rules/SchulteTutorial';
import { CreateRandom, CreateSchulteGrid, SchulteRound, type SchulteRow } from './logic/schulteGrid';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';

export function SchulteGridGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<SchulteSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<SchulteRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [grid, setGrid] = useState<number[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [interlude, setInterlude] = useState<SchulteRow | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const roundRef = useRef<SchulteRound | null>(null);
  const rowsRef = useRef<SchulteRow[]>([]);
  const wrongTimerRef = useRef(0);
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    roundRef.current = null;
    window.clearTimeout(wrongTimerRef.current);
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current === 'running' && event.key === 'Escape') { event.preventDefault(); exit(); }
    };
    const pagehide = () => { stopRuntime(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('keydown', keys, true);
    window.addEventListener('pagehide', pagehide);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('keydown', keys, true);
      window.removeEventListener('pagehide', pagehide);
      pagehide();
    };
  }, [exit, stopRuntime]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);

  const beginRound = useCallback((index: number, random: () => number) => {
    setGrid(CreateSchulteGrid(settings.gridSize, random));
    roundRef.current = new SchulteRound(settings.gridSize, settings.order, performance.now());
    setRoundIndex(index);
    setInterlude(null);
    setWrong(null);
    setVersion(version => version + 1);
  }, [settings]);
  const randomRef = useRef(CreateRandom(Date.now()));
  const finish = useCallback((completed: SchulteRow[]) => {
    roundRef.current = null;
    const score = BuildGameScore(completed, settings.rounds);
    jsPsychLifecycleRef.current?.finish({ rounds: completed.length, total_time_ms: score.summary.totalTimeMs, errors: score.summary.totalErrors });
    PlayGameEndSound('Victory');
    setRows(completed);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, score.summary, score.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:schulte-grid', onStart: () => {
      rowsRef.current = [];
      randomRef.current = CreateRandom(Date.now());
      beginRound(0, randomRef.current);
    } });
    return () => {
      roundRef.current = null;
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, beginRound]);
  // The visible clock reads the round's own start time, so it never drifts from the recorded time.
  useEffect(() => {
    if (phase !== 'running' || interlude) return;
    const timer = window.setInterval(() => {
      const round = roundRef.current;
      if (round && clockRef.current) clockRef.current.textContent = `${((performance.now() - round.startedAt) / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, interlude, en]);

  const tapCell = (value: number) => {
    const round = roundRef.current;
    if (phaseRef.current !== 'running' || !round || interlude) return;
    const outcome = round.tap(value, performance.now());
    if (outcome.ignored) return;
    window.clearTimeout(wrongTimerRef.current);
    if (!outcome.correct) {
      PlayFailureSound();
      setWrong(value);
      wrongTimerRef.current = window.setTimeout(() => setWrong(null), 900);
      return;
    }
    setWrong(null);
    setVersion(version => version + 1);
    if (!outcome.done) return;
    const row = { round: roundIndex + 1, gridSize: settings.gridSize, ...round.result() };
    if (clockRef.current) clockRef.current.textContent = seconds(row.timeMs);
    rowsRef.current = [...rowsRef.current, row];
    if (rowsRef.current.length >= settings.rounds) finish(rowsRef.current);
    else { PlaySuccessSound(); setInterlude(row); }
  };
  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const size = settings.gridSize;
    const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size } as Record<string, number>)[event.key];
    if (!delta) return;
    const cells = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const index = cells.indexOf(document.activeElement as HTMLButtonElement);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= cells.length) return;
    if (Math.abs(delta) === 1 && Math.floor(target / size) !== Math.floor(index / size)) return;
    event.preventDefault();
    cells[target].focus();
  };

  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings(settings);
    setPhase('rules');
  };
  const startTraining = async () => {
    if (phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    const generation = generationRef.current;
    PrepareAudioFeedback();
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* Windowed play remains available. */ }
    if (generation !== generationRef.current || phaseRef.current !== 'rules') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    SendGameEvent('active');
    setPhase('running');
  };

  const cells = settings.gridSize * settings.gridSize;
  const orderLabel = (order: SchulteSettings['order']) => order === 'ascending'
    ? (en ? `Smallest first (1 to ${cells})` : `從小到大（1 到 ${cells}）`)
    : (en ? `Largest first (${cells} to 1)` : `從大到小（${cells} 到 1）`);
  const yesNo = (value: boolean) => value ? (en ? 'Yes' : '是') : (en ? 'No' : '否');
  const summaryItems = [
    { label: en ? 'Grid size' : '方格大小', value: `${settings.gridSize} × ${settings.gridSize}` },
    { label: en ? 'Rounds' : '回合數', value: String(settings.rounds) },
    { label: en ? 'Order' : '點選順序', value: orderLabel(settings.order) },
    { label: en ? 'Fade numbers already found' : '找到的數字變淡', value: yesNo(settings.markFound) },
  ];
  const hints: Record<string, string> = en ? {
    gridSize: 'A bigger grid has more numbers to search.',
    rounds: 'Each round uses a new layout. You can rest between rounds.',
  } : {
    gridSize: '方格越大，要找的數字越多。',
    rounds: '每回合重新排列數字，回合之間可以休息。',
  };
  const seconds = (ms: number | null) => ms === null ? (en ? 'N/A' : '無') : `${(ms / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
  const score = BuildGameScore(rows, settings.rounds);
  const summary = score.summary;
  const round = roundRef.current;
  const missing = en ? 'N/A' : '無';
  return <div ref={rootRef} className="schulte-grid-game-root">
    <div ref={jsPsychHostRef} className="schulte-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <SchulteTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog schulte-grid-phase-menu" aria-labelledby="schulte-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="schulte-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{field.key === 'gridSize'
              ? `${settings.gridSize} × ${settings.gridSize}` : settings[field.key]}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label>{en ? 'Order' : '點選順序'}<select name="order" value={settings.order}
              onChange={event => setSettings({ ...settings, order: event.target.value as SchulteSettings['order'] })}>
              <option value="ascending">{orderLabel('ascending')}</option>
              <option value="descending">{orderLabel('descending')}</option>
            </select></label>
            <label className="schulte-checkbox"><input name="markFound" type="checkbox" checked={settings.markFound}
              onChange={event => setSettings({ ...settings, markFound: event.target.checked })} /> {en ? 'Fade numbers already found' : '找到的數字變淡'}
              <small className="training-setting-description">{en ? 'Turn this off to keep every number looking the same, so you track your own progress.'
                : '關閉後，找過的數字不會有任何標示，要自己記住找到哪裡。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="schulte-stage schulte-running" aria-label={title}>
      <header className="schulte-hud">
        <p className="schulte-round">{en ? `Round ${roundIndex + 1} of ${settings.rounds}` : `第 ${roundIndex + 1} 回合，共 ${settings.rounds} 回合`}</p>
        <p className="schulte-next">{en ? 'Find' : '下一個'} <strong>{round && !round.done ? round.next : ''}</strong></p>
        <p ref={clockRef} className="schulte-clock">0.0 {en ? 's' : '秒'}</p>
        <button type="button" className="btn btn-ghost schulte-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className="schulte-feedback" role="status">{wrong !== null && round
        ? (en ? `${wrong} is not next. Find ${round.next}.` : `${wrong} 不是下一個，請找 ${round.next}。`) : ''}</p>
      <div className="schulte-board">
        <div className="schulte-grid" style={{ '--grid-size': settings.gridSize } as CSSProperties} onKeyDown={moveFocus}
          role="group" aria-label={en ? 'Number grid' : '數字方格'}>
          {grid.map(value => {
            const found = settings.markFound && Boolean(round?.found.has(value));
            return <button type="button" key={`${roundIndex}-${value}`} className="schulte-cell" data-found={found ? 'true' : undefined}
              data-wrong={wrong === value ? 'true' : undefined} aria-label={found ? (en ? `${value}, found` : `${value}，已找到`) : String(value)}
              onClick={() => tapCell(value)}>{value}</button>;
          })}
        </div>
      </div>
      {interlude && <section className="schulte-interlude" aria-labelledby="schulte-interlude-title">
        <div className="schulte-interlude-panel">
          <h2 id="schulte-interlude-title">{en ? `Round ${interlude.round} complete` : `第 ${interlude.round} 回合完成`}</h2>
          <p>{en ? `Time ${seconds(interlude.timeMs)}, wrong taps ${interlude.errors}` : `用時 ${seconds(interlude.timeMs)}，點錯 ${interlude.errors} 次`}</p>
          <button type="button" className="btn btn-primary schulte-next-round" autoFocus
            onClick={() => beginRound(interlude.round, randomRef.current)}>{en ? 'Next round' : '下一回合'}</button>
        </div>
      </section>}
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Mean time per round' : '平均每回合時間'}</p><strong>{seconds(summary.meanRoundMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Fastest round' : '最快回合'}</p><strong>{seconds(summary.bestRoundMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Wrong taps' : '點錯次數'}</p><strong>{summary.totalErrors}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Rounds completed' : '完成回合'}</dt><dd>{summary.roundsCompleted} / {summary.roundsPlanned}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time per number' : '每個數字平均時間'}</dt><dd>{summary.meanStepMs === null ? missing : `${summary.meanStepMs} ms`}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Total time' : '總用時'}</dt><dd>{seconds(summary.totalTimeMs)}</dd></div>
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
