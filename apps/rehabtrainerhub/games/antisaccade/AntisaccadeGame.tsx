import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, practiceItems, rangeSettings, ValidateSettings, type AntisaccadeSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { AntisaccadeTutorial } from './rules/AntisaccadeTutorial';
import { CreateAntisaccadeSteps, CreateRandom, type AntisaccadeTrial, type Direction } from './logic/antisaccadeTrials';
import { TrialRun, type RunClock, type TrialOutcome } from './logic/trialRun';
import type { AntisaccadeRow } from './logic/antisaccadeScore';
import { DirectionName, directionKeys, Slot } from './Stimulus';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

const browserClock: RunClock = {
  now: () => performance.now(),
  set: (callback, ms) => window.setTimeout(callback, ms),
  clear: timer => window.clearTimeout(timer),
};

const keyDirections: Record<string, Direction> = { ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right' };
const directionCodes: Record<Direction, number> = { left: 0, up: 1, right: 2 };
const directions: Direction[] = ['left', 'up', 'right'];

function ToRow(outcome: TrialOutcome<AntisaccadeTrial>): AntisaccadeRow {
  const { trial } = outcome;
  const response = outcome.response as Direction | null;
  return { trial: outcome.index + 1, practice: trial.practice, side: trial.side === 'left' ? 0 : 1, arrow: directionCodes[trial.arrow],
    response: response === null ? null : directionCodes[response], correct: response === trial.arrow, rtMs: outcome.rtMs };
}

type Phase = 'menu' | 'rules' | 'running' | 'results';

export function AntisaccadeGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<AntisaccadeSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<AntisaccadeRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const progressLabelRef = useRef<HTMLParagraphElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<TrialRun<AntisaccadeTrial> | null>(null);
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
    runRef.current?.stop();
    runRef.current = null;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      const direction = keyDirections[event.key];
      if (direction) { event.preventDefault(); if (!event.repeat) runRef.current?.respond(direction); }
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
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const steps = CreateAntisaccadeSteps(settings, CreateRandom(Date.now()));
    const practiceCount = steps.filter(step => step.trial.practice).length;
    const finish = (outcomes: TrialOutcome<AntisaccadeTrial>[]) => {
      runRef.current = null;
      const completed = outcomes.map(ToRow);
      const score = BuildGameScore(completed, settings);
      jsPsychLifecycleRef.current?.finish({ trials: score.summary.trials, accuracy_percent: score.summary.accuracy, mean_rt_ms: score.summary.meanResponseMs });
      PlayGameEndSound('Victory');
      setRows(completed);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    // The field and its two sides change outside React, so each screen appears on the frame it is due.
    const slot = (side: 'left' | 'right') => fieldRef.current?.querySelector<HTMLElement>(`.as-slot-${side}`);
    const showIn = (side: 'left' | 'right' | null, show?: string) => {
      for (const each of ['left', 'right'] as const) { const element = slot(each); if (element) element.dataset.show = each === side && show ? show : ''; }
    };
    const setState = (state: string) => { if (fieldRef.current) fieldRef.current.dataset.state = state; };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:antisaccade', onStart: () => {
      const run = new TrialRun<AntisaccadeTrial>(steps.length, index => steps[index], {
        lead: (state, step, index) => {
          setState(state);
          showIn(state === 'cue' ? step.trial.cue : null, 'cue');
          const practice = index < practiceCount;
          const number = practice ? index + 1 : index - practiceCount + 1;
          const total = practice ? practiceCount : steps.length - practiceCount;
          if (progressLabelRef.current) progressLabelRef.current.textContent = practice
            ? (enRef.current ? `Practice ${number} of ${total}` : `練習 ${number}／${total}`)
            : (enRef.current ? `Item ${number} of ${total}` : `第 ${number} 題，共 ${total} 題`);
          if (progressFillRef.current) progressFillRef.current.style.width = `${number / total * 100}%`;
        },
        show: step => {
          const arrow = slot(step.trial.side)?.querySelector<SVGElement>('.as-arrow');
          if (arrow) arrow.dataset.dir = step.trial.arrow;
          if (fieldRef.current) fieldRef.current.dataset.side = step.trial.side;
          setState('target');
          showIn(step.trial.side, 'arrow');
        },
        hide: () => { setState('mask'); showIn((fieldRef.current?.dataset.side as 'left' | 'right') ?? null, 'mask'); },
        signal: () => undefined,
        end: (outcome, feedback) => {
          showIn(null);
          if (!feedback || !feedbackRef.current) { setState('blank'); return; }
          setState('feedback');
          const correct = outcome.response === outcome.trial.arrow;
          feedbackRef.current.dataset.result = correct ? 'correct' : 'wrong';
          feedbackRef.current.textContent = correct ? (enRef.current ? 'Correct' : '答對了')
            : outcome.response === null ? (enRef.current ? 'Too slow. Answer before the pattern goes away.' : '太慢了，請在花紋消失前作答。')
              : (enRef.current ? `Wrong. The arrow pointed ${DirectionName(outcome.trial.arrow, true).toLowerCase()}.` : `答錯了，箭頭指向${DirectionName(outcome.trial.arrow, false)}。`);
        },
        clear: () => setState('blank'),
      }, browserClock, finish, leadInMs);
      runRef.current = run;
      run.start();
    } });
    return () => {
      runRef.current?.stop();
      runRef.current = null;
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
    setPhase('running');
  };
  // Touch answers use the moment the finger lands; a keyboard press on a focused button still answers.
  const press = (direction: Direction) => (event: ReactPointerEvent) => { event.preventDefault(); runRef.current?.respond(direction); };
  const click = (direction: Direction) => (event: ReactMouseEvent) => { if (event.detail === 0) runRef.current?.respond(direction); };

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), rest = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, rest && `${rest} s`] : [minutes && `${minutes} 分`, rest && `${rest} 秒`];
    return `${en ? 'about' : '約'} ${parts.filter(Boolean).join(' ')}`;
  };
  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`;
  const hints: Record<string, string> = en ? {
    exposureMs: 'How long the arrow shows before the pattern covers it. Shorter is harder.',
    rounds: 'Items that count toward the results. The square appears on each side equally often.',
    practice: `${practiceItems} practice items with right-or-wrong feedback come first. They are saved but left out of the results.`,
  } : {
    exposureMs: '箭頭被花紋蓋住前停留的時間，越短越難。',
    rounds: '計入成果的題數，方塊出現在左右兩側的次數相同。',
    practice: `正式開始前先做 ${practiceItems} 題練習，會提示對錯。練習題會保存，但不列入成果統計。`,
  };
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? `Yes, ${practiceItems} items` : `是，${practiceItems} 題`) : (en ? 'No' : '否') },
    { label: en ? 'Estimated time' : '預估時間', value: duration(EstimatedSeconds(settings)) },
  ];
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  return <div ref={rootRef} className="antisaccade-game-root">
    <div ref={jsPsychHostRef} className="as-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <AntisaccadeTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog antisaccade-phase-menu" aria-labelledby="as-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="as-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="as-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <p className="as-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="as-stage as-running" aria-label={title}>
      <header className="as-hud">
        <p ref={progressLabelRef} className="as-progress-label" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <div className="as-progress-track"><div ref={progressFillRef} className="as-progress-fill" /></div>
        <button type="button" className="btn btn-ghost as-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={fieldRef} className="as-field" data-state="ready" aria-hidden="true">
        <Slot side="left" />
        <p className="as-fixation">+</p>
        <Slot side="right" />
        <p className="as-break">{en ? 'Practice done. The counted items start now, without feedback.' : '練習結束，正式題目馬上開始，不再提示對錯。'}</p>
        <p ref={feedbackRef} className="as-feedback" />
      </div>
      <div className="as-pads">
        {directions.map(direction => <button key={direction} type="button" className={`as-pad as-pad-${direction}`}
          onPointerDown={press(direction)} onClick={click(direction)}>{DirectionName(direction, en)}<small>{directionKeys[direction]}</small></button>)}
      </div>
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Correct answers' : '正確率'}</p><strong>{percent(summary.accuracy)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean answer time' : '平均作答時間'}</p><strong>{ms(summary.meanResponseMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Missed (no answer)' : '漏答'}</p><strong>{summary.misses}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Counted items answered correctly' : '正式題答對'}</dt><dd>{summary.correct} / {summary.trials}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Wrong direction' : '方向答錯'}</dt><dd>{summary.wrong}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time, correct answers' : '答對題平均時間'}</dt><dd>{ms(summary.correctResponseMs)}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Practice items are listed below but not counted here. Answer times run from when the arrow appears; the mean answer time includes wrong answers.'
          : '練習題列在下方明細，但不計入這些統計。作答時間從箭頭出現開始計算；平均作答時間包含答錯的題目。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
