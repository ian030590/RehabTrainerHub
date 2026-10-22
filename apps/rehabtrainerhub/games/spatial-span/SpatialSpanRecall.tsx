import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from './i18n/useT';
import { boardSizes, defaultSettings, EstimatedSeconds, practiceItems, rangeSettings, ValidateSettings, type SpatialSpanSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { SpatialSpanTutorial } from './rules/SpatialSpanTutorial';
import { CreateCells, CreateRandom, CreateSpatialSpanPlan, CreateSquareSchedule, IsRecallCorrect, NextLevel, startLoad, type Level, type SpatialSpanSegment } from './logic/spatialSpanTrials';
import { SummarizeSpatialSpan, type SpatialSpanRow } from './logic/spatialSpanScore';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Kind = SpatialSpanSegment['kind'];
interface IntroState { next: number; kind: Kind; count: number; afterPractice: boolean; previousAccuracy: number | null }
interface AnswerControls { tap(cell: number): void; back(): void; clear(): void; submit(): void }

const maxEntry = 30;
const readyMs = 1000;
const pauseMs = 500;
const tapFlashMs = 250;
export const DirectionLabel = (reverse: boolean, en: boolean) => reverse ? (en ? 'Reverse' : '逆向：倒過來') : (en ? 'Forward' : '順向：照順序');
export const BoardCells = (size: number) => Array.from({ length: size ** 2 }, (_, index) => index + 1);

export function SpatialSpanRecall() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<SpatialSpanSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<SpatialSpanRow[]>([]);
  const [intro, setIntro] = useState<IntroState | null>(null);
  const [reverse, setReverse] = useState(false);
  const [entryCount, setEntryCount] = useState(0);
  const [answering, setAnswering] = useState(false);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const progressLabelRef = useRef<HTMLParagraphElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const answerRef = useRef<AnswerControls | null>(null);
  const stopRunRef = useRef<(() => void) | null>(null);
  const runSegmentRef = useRef<((index: number) => void) | null>(null);
  const introRef = useRef(intro);
  introRef.current = intro;
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const enRef = useRef(en);
  enRef.current = en;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    stopRunRef.current?.();
    stopRunRef.current = null;
    answerRef.current = null;
    runSegmentRef.current = null;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  const startNextPart = useCallback(() => {
    const current = introRef.current;
    if (current) runSegmentRef.current?.(current.next);
  }, []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setIntro(null); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      if (introRef.current) {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); startNextPart(); }
        return;
      }
      const controls = answerRef.current;
      if (!controls || event.repeat) return;
      const target = event.target as HTMLElement;
      if (event.key === 'Backspace') { event.preventDefault(); controls.back(); }
      else if (event.key === 'Delete') { event.preventDefault(); controls.clear(); }
      // Enter on a square submits, so clicking squares and pressing Enter does not add a tap; Space still picks a focused square.
      else if (event.key === 'Enter' && (target.tagName !== 'BUTTON' || target.classList.contains('spatial-span-cell'))) { event.preventDefault(); controls.submit(); }
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
  }, [exit, stopRuntime, startNextPart]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);
  useEffect(() => { if (intro) continueButtonRef.current?.focus(); }, [intro]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const random = CreateRandom(Date.now());
    const plan = CreateSpatialSpanPlan(settings);
    const allRows: SpatialSpanRow[] = [];
    const timers = new Set<number>();
    let stopped = false;
    const later = (callback: () => void, ms: number) => {
      const timer = window.setTimeout(() => { timers.delete(timer); if (!stopped) callback(); }, ms);
      timers.add(timer);
    };
    const stop = () => { stopped = true; for (const timer of timers) window.clearTimeout(timer); timers.clear(); answerRef.current = null; };
    stopRunRef.current = stop;
    const setState = (state: string) => { if (stageRef.current) stageRef.current.dataset.state = state; };
    const say = (text: string, result?: string) => {
      const message = messageRef.current;
      if (!message) return;
      message.textContent = text;
      if (result) message.dataset.result = result; else delete message.dataset.result;
    };
    const cellButton = (cell: number) => boardRef.current?.querySelector<HTMLElement>(`[data-cell="${cell}"]`);
    const resetBoard = () => boardRef.current?.querySelectorAll<HTMLElement>('.spatial-span-cell').forEach(item => {
      item.classList.remove('spatial-span-lit', 'spatial-span-tapped');
      item.textContent = '';
    });
    const light = (cell: number | null) => {
      boardRef.current?.querySelectorAll('.spatial-span-lit').forEach(item => item.classList.remove('spatial-span-lit'));
      if (cell !== null) cellButton(cell)?.classList.add('spatial-span-lit');
    };
    const finish = () => {
      stop();
      runSegmentRef.current = null;
      const score = BuildGameScore(allRows, settings);
      jsPsychLifecycleRef.current?.finish({ trials: score.summary.trials, accuracy: score.summary.accuracy });
      PlayGameEndSound('Victory');
      setRows([...allRows]);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    const showIntro = (index: number, previous: SpatialSpanRow[] | null, afterPractice: boolean) => {
      const segment = plan[index];
      setIntro({ next: index, kind: segment.kind, count: segment.count, afterPractice,
        previousAccuracy: previous ? SummarizeSpatialSpan(previous.map(row => ({ ...row, practice: false }))).accuracy : null });
    };
    const runSegment = (index: number) => {
      const segment = plan[index];
      const segmentRows: SpatialSpanRow[] = [];
      let level: Level = { load: startLoad, errors: 0 };
      setIntro(null);
      setReverse(segment.reverse);
      setEntryCount(0);
      setAnswering(false);
      setState('ready');
      resetBoard();
      say(enRef.current ? 'Get ready' : '準備開始');
      if (progressLabelRef.current) progressLabelRef.current.textContent = enRef.current ? 'Get ready' : '準備開始';
      if (progressFillRef.current) progressFillRef.current.style.width = '0%';
      const runTrial = (item: number) => {
        const english = enRef.current;
        const load = segment.kind === 'practice' ? startLoad : level.load;
        const cells = CreateCells(load, settings.boardSize, random);
        if (progressLabelRef.current) progressLabelRef.current.textContent = segment.kind === 'practice'
          ? (english ? `Practice ${item + 1} of ${segment.count}` : `練習 ${item + 1}／${segment.count}`)
          : `${DirectionLabel(segment.reverse, english).split('：')[0]} ${english ? `${item + 1} of ${segment.count}` : `${item + 1}／${segment.count}`}`;
        if (progressFillRef.current) progressFillRef.current.style.width = `${(item + 1) / segment.count * 100}%`;
        resetBoard();
        const schedule = CreateSquareSchedule(cells, settings.itemExposureMs);
        for (const event of schedule.events) later(() => {
          setState(event.state);
          const now = enRef.current;
          if (event.state === 'count') say(now ? `${load} squares` : `${load} 個方格`);
          else if (event.state === 'grid') say(now ? 'Watch the order' : '記住亮起的順序');
          light(event.state === 'square' ? event.cell! : null);
        }, event.at);
        later(() => {
          let typed: number[] = [];
          const onset = performance.now();
          light(null);
          setState('answer');
          setEntryCount(0);
          setAnswering(true);
          say(segment.reverse ? (enRef.current ? 'Tap from the last square back to the first' : '從最後亮起的方格開始點') : (enRef.current ? 'Tap the squares in the same order' : '依亮起順序點方格'));
          const update = (next: number[]) => { typed = next; setEntryCount(next.length); };
          answerRef.current = {
            tap: cell => {
              if (typed.length >= maxEntry) return;
              update([...typed, cell]);
              const button = cellButton(cell);
              button?.classList.add('spatial-span-tapped');
              later(() => button?.classList.remove('spatial-span-tapped'), tapFlashMs);
            },
            back: () => update(typed.slice(0, -1)),
            clear: () => update([]),
            submit: () => {
              if (!typed.length) return;
              answerRef.current = null;
              setAnswering(false);
              const row: SpatialSpanRow = { trial: allRows.length + 1, practice: segment.kind === 'practice', reverse: segment.reverse, load, sequence: cells,
                response: typed, rtMs: Math.round(performance.now() - onset) };
              allRows.push(row);
              segmentRows.push(row);
              const correct = IsRecallCorrect(cells, typed, segment.reverse);
              if (segment.kind !== 'practice') level = NextLevel(level, correct);
              setState('feedback');
              const now = enRef.current;
              if (correct) say(now ? 'Correct' : '答對了', 'correct');
              else {
                // Numbers on the board show the order that was expected; a square used twice shows both numbers.
                const expected = segment.reverse ? [...cells].reverse() : cells;
                const orders = new Map<number, number[]>();
                expected.forEach((cell, order) => orders.set(cell, [...(orders.get(cell) ?? []), order + 1]));
                orders.forEach((order, cell) => { const button = cellButton(cell); if (button) button.textContent = order.join('·'); });
                say(now ? 'Not quite. The numbers show the right order.' : '不對，方格上的數字是正確的點選順序。', 'wrong');
              }
              later(() => {
                setState('blank');
                setEntryCount(0);
                resetBoard();
                say('');
                later(() => {
                  if (item + 1 < segment.count) runTrial(item + 1);
                  else if (index === plan.length - 1) finish();
                  else showIntro(index + 1, segmentRows, segment.kind === 'practice');
                }, pauseMs);
              }, correct ? 1000 : 2500);
            },
          };
        }, schedule.answerAt);
      };
      later(() => runTrial(0), readyMs);
    };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:spatial-span', onStart: () => {
      runSegmentRef.current = runSegment;
      if (plan[0].kind === 'practice') runSegment(0);
      else showIntro(0, null, false);
    } });
    return () => {
      stop();
      runSegmentRef.current = null;
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings]);

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
    setIntro(null);
    setReverse(false);
    setEntryCount(0);
    setAnswering(false);
    setPhase('running');
  };

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), extra = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, extra && `${extra} s`] : [minutes && `${minutes} 分`, extra && `${extra} 秒`];
    return `${en ? 'about' : '約'} ${parts.filter(Boolean).join(' ')}`;
  };
  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`;
  const boardLabel = (size: number) => `${size} × ${size}${size === 5 ? (en ? ' (original)' : '（原作業）') : ''}`;
  const hints: Record<string, string> = en ? {
    itemExposureMs: 'How long each square stays lit. The next square lights right after.',
    rounds: 'Counted sequences: the first half forward, the second half in reverse. Each half starts at 3 squares.',
    boardSize: 'The original board is 5 by 5. A smaller board has fewer places to remember; squares can light again later in the same sequence.',
    practice: `${practiceItems} forward practice sequences of 3 squares come first. Every sequence, practice or counted, shows right or wrong.`,
  } : {
    itemExposureMs: '每個方格亮多久；下一格會緊接著亮起。',
    rounds: '計入成果的題數：前一半順向、後一半逆向，兩段都從 3 個方格開始。',
    boardSize: '原作業是 5 × 5。方格較少時位置較好記；同一題中方格之後可能再亮一次。',
    practice: `正式開始前先做 ${practiceItems} 題 3 個方格的順向練習。練習與正式題目都會提示對錯。`,
  };
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Board' : '方格大小', value: boardLabel(settings.boardSize) },
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? `Yes, ${practiceItems} sequences` : `是，${practiceItems} 題`) : (en ? 'No' : '否') },
    { label: en ? 'Estimated time' : '預估時間', value: `${duration(EstimatedSeconds(settings))}${en ? ', plus rests' : '，另加休息時間'}` },
  ];
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  const squaresText = (value: number | null) => value === null ? missing : en ? `${value} squares` : `${value} 個`;
  const boardStyle = { '--spatial-span-size': settings.boardSize } as CSSProperties;
  return <div ref={rootRef} className="spatial-span-game-root">
    <div ref={jsPsychHostRef} className="spatial-span-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <SpatialSpanTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog spatial-span-phase-menu" aria-labelledby="spatial-span-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="spatial-span-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label>{en ? 'Board' : '方格大小'}<select name="boardSize" value={settings.boardSize}
              onChange={event => setSettings({ ...settings, boardSize: Number(event.target.value) })}>
              {boardSizes.map(size => <option key={size} value={size}>{boardLabel(size)}</option>)}
            </select>
              <small className="training-setting-description">{hints.boardSize}</small></label>
            <label className="spatial-span-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <p className="spatial-span-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}{en ? '; it depends on how many squares you reach and how fast you tap' : '（依記住的方格數與作答速度而定）'}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main ref={stageRef} className="spatial-span-stage spatial-span-running" data-state="ready" aria-label={title}>
      <header className="spatial-span-hud">
        <p ref={progressLabelRef} className="spatial-span-progress-label" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <p className="spatial-span-direction">{DirectionLabel(reverse, en)}</p>
        <div className="spatial-span-progress-track"><div ref={progressFillRef} className="spatial-span-progress-fill" /></div>
        <button type="button" className="btn btn-ghost spatial-span-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p ref={messageRef} className="spatial-span-message" role="status" />
      <div className="spatial-span-board-wrap">
        <div ref={boardRef} className="spatial-span-board" style={boardStyle}>
          {BoardCells(settings.boardSize).map(cell => <button key={cell} type="button" className="spatial-span-cell" data-cell={cell} disabled={!answering}
            aria-label={en ? `Square ${cell}` : `第 ${cell} 格`} onClick={() => answerRef.current?.tap(cell)} />)}
        </div>
      </div>
      <div className="spatial-span-answer">
        <p className="spatial-span-entry" aria-live="polite">{en ? `Tapped: ${entryCount}` : `已點：${entryCount} 個`}</p>
        <div className="spatial-span-actions">
          <button type="button" className="spatial-span-action spatial-span-back" disabled={!answering || !entryCount} onClick={() => answerRef.current?.back()}>{en ? 'Undo' : '刪除'}</button>
          <button type="button" className="spatial-span-action spatial-span-clear" disabled={!answering || !entryCount} onClick={() => answerRef.current?.clear()}>{en ? 'Clear' : '清除'}</button>
          <button type="button" className="spatial-span-action spatial-span-submit" disabled={!answering || !entryCount} onClick={() => answerRef.current?.submit()}>{en ? 'Submit' : '送出'}</button>
        </div>
      </div>
      {intro && <section className="training-panel spatial-span-intro" role="dialog" aria-modal="true" aria-labelledby="spatial-span-intro-title">
        <div className="training-config training-confirmation">
          <header className="training-config-header"><h2 id="spatial-span-intro-title">{intro.afterPractice ? (en ? 'Practice done' : '練習結束')
            : intro.kind === 'reverse' ? (en ? 'Forward part done' : '順向完成') : (en ? 'Counted sequences' : '正式題目')}</h2></header>
          <div className="training-config-body"><section className="training-setting">
            {intro.previousAccuracy !== null && <p className="training-config-summary-item"><strong>{en ? 'Correct in the last part' : '上一段正確率'}：</strong>{percent(intro.previousAccuracy)}</p>}
            <h3>{en ? `Next: ${DirectionLabel(intro.kind === 'reverse', true)}, ${intro.count} sequences` : `下一段：${DirectionLabel(intro.kind === 'reverse', false)}，共 ${intro.count} 題`}</h3>
            <p className="spatial-span-intro-rule">{intro.kind === 'reverse'
              ? (en ? 'Tap the squares in reverse: the last square that lit comes first.' : '請倒過來點：最後亮起的方格先點。')
              : (en ? 'Tap the squares in the order they lit.' : '請依方格亮起的順序點選。')}</p>
            <p>{en ? 'Each part starts at 3 squares. A correct answer adds a square; every second mistake takes one away. Take a short rest and start when you are ready.'
              : '每段從 3 個方格開始，答對就多一個，每答錯兩次就少一個。休息一下，準備好再開始。'}</p>
          </section></div>
          <footer className="config-actions"><div className="training-config-navigation-buttons">
            <button ref={continueButtonRef} type="button" className="btn btn-primary spatial-span-continue" onClick={startNextPart}>{en ? 'Start this part' : '開始這一段'}</button>
          </div></footer>
        </div>
      </section>}
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Longest correct, forward' : '順向最長答對'}</p><strong>{squaresText(summary.forwardSpan)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Longest correct, reverse' : '逆向最長答對'}</p><strong>{squaresText(summary.reverseSpan)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Correct' : '正確率'}</p><strong>{percent(summary.accuracy)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Correct, forward' : '順向正確率'}</dt><dd>{percent(summary.forwardAccuracy)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Correct, reverse' : '逆向正確率'}</dt><dd>{percent(summary.reverseAccuracy)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Correct sequences' : '答對題數'}</dt><dd>{summary.correct} / {summary.trials}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time to tap an answer' : '平均作答時間'}</dt><dd>{ms(summary.meanResponseMs)}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Answer time runs from when the board opens for tapping to Submit. Practice sequences are listed below but not counted here.'
          : '作答時間從方格可點選開始算到按下送出。練習題列在下方明細，但不計入這些統計。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
