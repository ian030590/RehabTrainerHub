import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, rangeSettings, ValidateSettings, type SimonSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { SimonTutorial } from './rules/SimonTutorial';
import { CreateRandom, CreateSimonTrials, type Side } from './logic/simonTrials';
import { SimonRun, type SimonClock, type SimonRow } from './logic/simonRun';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

const browserClock: SimonClock = {
  now: () => performance.now(),
  set: (callback, ms) => window.setTimeout(callback, ms),
  clear: timer => window.clearTimeout(timer),
};

const keySides: Record<string, Side> = { f: 'left', arrowleft: 'left', j: 'right', arrowright: 'right' };

type Phase = 'menu' | 'rules' | 'running' | 'results';

export function SimonTaskGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  const [paused, setPaused] = useState(false);
  const [fullscreenInterrupted, setFullscreenInterrupted] = useState(false);
  const endingRef = useRef(false);
  const pausedRef = useRef(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const restoreStopRef = useRef(false);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (phase === 'running' && !paused && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase, paused]);
  useEffect(() => { if (paused) continueRef.current?.focus(); else if (restoreStopRef.current) { restoreStopRef.current = false; stopRef.current?.focus(); } }, [paused]);
  useEffect(() => { if (phase === 'results') resultHeadingRef.current?.focus(); }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<SimonSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<SimonRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const stimulusRef = useRef<HTMLSpanElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const progressLabelRef = useRef<HTMLParagraphElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<SimonRun | null>(null);
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
    endingRef.current = true;
    pausedRef.current = false;
    setPaused(false);
    generationRef.current++;
    runRef.current?.stop();
    runRef.current = null;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const pause = useCallback(() => {
    if (pausedRef.current) return;
    setFullscreenInterrupted(false);
    pausedRef.current = true;
    runRef.current?.pause();
    StopMidiMusic();
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    restoreStopRef.current = true;
    setPaused(false);
    runRef.current?.resume();
  }, []);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const fullscreenChanged = () => { if (phaseRef.current === 'running' && !endingRef.current && !document.fullscreenElement) { pause(); setFullscreenInterrupted(true); } };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); if (!event.repeat) { if (pausedRef.current) resume(); else pause(); } return; }
      if (pausedRef.current) return;
      const side = keySides[event.key.toLowerCase()];
      if (side) { event.preventDefault(); if (!event.repeat) runRef.current?.respond(side); }
    };
    const pagehide = () => { stopRuntime(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('keydown', keys, true);
    window.addEventListener('pagehide', pagehide);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('keydown', keys, true);
      window.removeEventListener('pagehide', pagehide);
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      pagehide();
    };
  }, [pause, resume, stopRuntime]);
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
    const trials = CreateSimonTrials(settings.trials, CreateRandom(Date.now()));
    const finish = (completed: SimonRow[]) => {
      endingRef.current = true;
      runRef.current = null;
      const score = BuildGameScore(completed);
      jsPsychLifecycleRef.current?.finish({ trials: completed.length, accuracy_percent: score.summary.accuracyPercent, simon_effect_ms: score.summary.simonEffectMs });
      PlayGameEndSound('Victory');
      setRows(completed);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:simon-task', onStart: () => {
      const run = new SimonRun(trials, { responseMs: settings.responseMs, itiMs: settings.itiMs, leadInMs }, {
        show: (trial, index) => {
          if (stimulusRef.current) Object.assign(stimulusRef.current.dataset, { shape: trial.shape, side: trial.side });
          if (feedbackRef.current) feedbackRef.current.textContent = '';
          if (areaRef.current) areaRef.current.dataset.state = 'shape';
          if (progressLabelRef.current) progressLabelRef.current.textContent = enRef.current ? `Shape ${index + 1} of ${trials.length}` : `第 ${index + 1} 個，共 ${trials.length} 個`;
          if (progressFillRef.current) progressFillRef.current.style.width = `${(index + 1) / trials.length * 100}%`;
        },
        clear: row => {
          if (areaRef.current) areaRef.current.dataset.state = 'gap';
          if (feedbackRef.current) feedbackRef.current.textContent = row.correct ? '' : row.response === null
            ? (enRef.current ? 'Too slow. Answer a little faster.' : '太慢了，請快一點。') : (enRef.current ? 'Wrong side.' : '按錯邊了。');
        },
        pause: () => { if (areaRef.current) areaRef.current.dataset.state = 'gap'; if (feedbackRef.current) feedbackRef.current.textContent = ''; },
      }, browserClock, finish);
      runRef.current = run;
      run.start();
      if (pausedRef.current) run.pause();
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
    endingRef.current = false;
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
  const respond = (side: Side) => (event: ReactPointerEvent) => { event.preventDefault(); runRef.current?.respond(side); };

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), rest = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, rest && `${rest} s`] : [minutes && `${minutes} 分`, rest && `${rest} 秒`];
    return `${en ? 'about' : '約'} ${parts.filter(Boolean).join(' ')}`;
  };
  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`;
  const hints: Record<string, string> = en ? {
    trials: 'Each block of four shows both shapes on both sides once.',
    responseMs: 'A shape with no answer by this time counts as missed.',
    itiMs: 'The pause between your answer and the next shape.',
  } : {
    trials: '每 4 個為一組，兩種圖形各在左右出現一次。',
    responseMs: '超過這個時間還沒按，就算漏按。',
    itiMs: '作答後到下一個圖形出現前的停頓。',
  };
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Estimated time' : '預估時間', value: duration(EstimatedSeconds(settings)) },
  ];
  const score = BuildGameScore(rows);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  return <div ref={rootRef} className="simon-task-game-root">
    <div ref={jsPsychHostRef} className="simon-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <SimonTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog simon-task-phase-menu" aria-labelledby="simon-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="simon-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <p className="simon-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><main className="simon-stage simon-running" aria-label={title} inert={paused}>
      <header className="simon-hud">
        <p ref={progressLabelRef} className="simon-progress-label" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <div className="simon-progress-track"><div ref={progressFillRef} className="simon-progress-fill" /></div>
        <button ref={stopRef} type="button" className="btn btn-ghost simon-stop" onClick={pause}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={areaRef} className="simon-stimulus-area" data-state="ready">
        <p className="simon-fixation" aria-hidden="true">+</p>
        <span ref={stimulusRef} className="simon-stimulus" aria-hidden="true" />
        <p ref={feedbackRef} className="simon-feedback" aria-live="off" />
      </div>
      <div className="simon-pads">
        <button type="button" className="simon-pad simon-pad-left" onPointerDown={respond('left')}>
          <span className="simon-pad-mark" data-shape="circle" aria-hidden="true" />{en ? 'Left' : '左'}<small>F / ←</small></button>
        <button type="button" className="simon-pad simon-pad-right" onPointerDown={respond('right')}>
          <span className="simon-pad-mark" data-shape="square" aria-hidden="true" />{en ? 'Right' : '右'}<small>J / →</small></button>
      </div>
    </main>{paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="simon-pause-title"
      onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="simon-pause-title">{en ? 'Paused' : '已暫停'}</h2>
      <p>{fullscreenInterrupted ? (en ? 'Fullscreen ended; ending the activity will not save this session.' : '已退出全螢幕，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束後不會保存這次紀錄。')}</p>
      <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume}>{en ? 'Continue' : '繼續'}</button>
      <button className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
    </div></div>}</>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Correct answers' : '正確率'}</p><strong>{percent(summary.accuracyPercent)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Side effect (opposite minus same side)' : '位置干擾（異側減同側）'}</p><strong>{ms(summary.simonEffectMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean response time' : '平均反應時間'}</p><strong>{ms(summary.meanRtMs)}</strong></div>
      </div></section>
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      <div className="score-actions">
        {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
        <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
      </div>
      <details className="score-details"><summary>{en ? 'View details' : '查看詳細資料'}</summary>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Same side: mean time' : '同側：平均反應時間'}</dt><dd>{ms(summary.congruentRtMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Opposite side: mean time' : '異側：平均反應時間'}</dt><dd>{ms(summary.incongruentRtMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Same side: correct' : '同側：正確率'}</dt><dd>{percent(summary.congruentAccuracyPercent)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Opposite side: correct' : '異側：正確率'}</dt><dd>{percent(summary.incongruentAccuracyPercent)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Missed (too slow)' : '漏按（太慢）'}</dt><dd>{summary.misses}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Response time spread (SD)' : '反應時間標準差'}</dt><dd>{ms(summary.rtSdMs)}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Same side means the shape appeared on the side of its answer button. Times use correct answers only.'
          : '同側指圖形出現在它對應按鈕的那一邊。反應時間只計算答對的題目。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      </details>
    </section></div>}
  </div>;
}
