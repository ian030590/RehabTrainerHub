import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, feedbackMs, fixationMs, rangeSettings, ValidateSettings, type BlinkSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { BlinkTutorial } from './rules/BlinkTutorial';
import { answerDigits, BlinkRun, CreateBlinkTrials, CreateRandom, lags, type BlinkRow, type StreamClock } from './logic/blink';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

const browserClock: StreamClock = {
  now: () => performance.now(),
  set: (callback, ms) => window.setTimeout(callback, ms),
  clear: timer => window.clearTimeout(timer),
};

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Step = 'fixation' | 'stream' | 'answer1' | 'answer2' | 'feedback';

export function AttentionalBlinkGame() {
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
  const [settings, setSettings] = useState<BlinkSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<BlinkRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [step, setStep] = useState<Step>('fixation');
  const [trialIndex, setTrialIndex] = useState(0);
  const [lastRow, setLastRow] = useState<BlinkRow | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stimulusRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<BlinkRun | null>(null);
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

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
  const finish = useCallback((completed: BlinkRow[]) => {
    endingRef.current = true;
    const score = BuildGameScore(completed);
    jsPsychLifecycleRef.current?.finish({ trials: completed.length, t1_accuracy_percent: score.summary.t1AccuracyPercent, t2_given_t1_percent: score.summary.t2GivenT1Percent });
    PlayGameEndSound('Victory');
    setRows(completed);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, score.summary, score.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const fullscreenChanged = () => { if (phaseRef.current === 'running' && !endingRef.current && !document.fullscreenElement) { pause(); setFullscreenInterrupted(true); } };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); if (!event.repeat) { if (pausedRef.current) resume(); else pause(); } return; }
      if (pausedRef.current) return;
      const digit = Number(event.key);
      if (answerDigits.includes(digit)) { event.preventDefault(); if (!event.repeat) runRef.current?.answer(digit); }
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
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:attentional-blink', onStart: () => {
      const run = new BlinkRun(CreateBlinkTrials(settings.trials, CreateRandom(Date.now())), { fixationMs, itemMs: settings.itemMs, feedbackMs }, {
        fixation: index => { setTrialIndex(index); setLastRow(null); setStep('fixation'); if (stimulusRef.current) { stimulusRef.current.textContent = '+'; stimulusRef.current.dataset.kind = 'fixation'; } },
        show: item => { if (stimulusRef.current) { stimulusRef.current.textContent = item; stimulusRef.current.dataset.kind = 'item'; } },
        blank: () => { if (stimulusRef.current) stimulusRef.current.textContent = ''; },
        step: setStep,
        feedback: row => { setLastRow(row); setStep('feedback'); },
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
  }, [phase, settings, finish]);

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

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), rest = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, rest && `${rest} s`] : [minutes && `${minutes} 分`, rest && `${rest} 秒`];
    return `${en ? 'about' : '約'} ${parts.filter(Boolean).join(' ')}`;
  };
  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`;
  const hints: Record<string, string> = en ? {
    trials: 'Each of the six gaps between the two digits comes up equally often.',
    itemMs: 'Shorter times make the stream faster and the digits harder to catch.',
  } : {
    trials: '兩個數字之間的六種間隔，出現次數一樣多。',
    itemMs: '時間越短，字串越快，數字越難抓到。',
  };
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Estimated time' : '預估時間', value: duration(EstimatedSeconds(settings)) },
  ];
  const prompt: Record<Step, string> = en
    ? { fixation: 'Look at the middle.', stream: 'Look at the middle.', answer1: 'What was the first digit?', answer2: 'What was the second digit?', feedback: '' }
    : { fixation: '眼睛看中央。', stream: '眼睛看中央。', answer1: '第一個數字是？', answer2: '第二個數字是？', feedback: '' };
  const mark = (correct: boolean, actual: number) => correct ? '✓' : (en ? `✗ (it was ${actual})` : `✗（是 ${actual}）`);
  const feedbackText = lastRow ? (en
    ? `First ${lastRow.t1Response} ${mark(lastRow.t1Correct, lastRow.t1)}, second ${lastRow.t2Response} ${mark(lastRow.t2Correct, lastRow.t2)}`
    : `第一個 ${lastRow.t1Response} ${mark(lastRow.t1Correct, lastRow.t1)}，第二個 ${lastRow.t2Response} ${mark(lastRow.t2Correct, lastRow.t2)}`) : '';
  const answering = step === 'answer1' || step === 'answer2';
  const score = BuildGameScore(rows);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  const lagValues = lags.map(lag => ({ lag, value: summary[`lag${lag}Percent` as keyof typeof summary] as number | null }));
  return <div ref={rootRef} className="attentional-blink-game-root">
    <div ref={jsPsychHostRef} className="blink-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <BlinkTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog attentional-blink-phase-menu" aria-labelledby="blink-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="blink-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <p className="blink-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><main className="blink-stage blink-running" aria-label={title} inert={paused}>
      <header className="blink-hud">
        <p className="blink-progress-label">{en ? `Round ${trialIndex + 1} of ${settings.trials}` : `第 ${trialIndex + 1} 回，共 ${settings.trials} 回`}</p>
        <div className="blink-progress-track"><div className="blink-progress-fill" style={{ width: `${(trialIndex + 1) / settings.trials * 100}%` }} /></div>
        <button ref={stopRef} type="button" className="btn btn-ghost blink-stop" onClick={pause}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div className="blink-stimulus-area" data-step={step}><p ref={stimulusRef} className="blink-stimulus" aria-hidden="true" /></div>
      <div className="blink-answer">
        <p className="blink-prompt" role="status" data-step={step}>{step === 'feedback' ? feedbackText : prompt[step]}</p>
        <div className="blink-keypad" role="group" aria-label={en ? 'Digits' : '數字'}>
          {answerDigits.map(digit => <button key={digit} type="button" className="blink-key" disabled={!answering}
            onClick={() => runRef.current?.answer(digit)}>{digit}</button>)}
        </div>
      </div>
    </main>{paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="blink-pause-title"
      onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="blink-pause-title">{en ? 'Paused' : '已暫停'}</h2>
      <p>{fullscreenInterrupted ? (en ? 'Fullscreen ended; ending the activity will not save this session.' : '已退出全螢幕，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束後不會保存這次紀錄。')}</p>
      <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume}>{en ? 'Continue' : '繼續'}</button>
      <button className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
    </div></div>}</>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Second digit right (when the first was right)' : '第二個數字答對（第一個答對時）'}</p><strong>{percent(summary.t2GivenT1Percent)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'First digit right' : '第一個數字答對'}</p><strong>{percent(summary.t1AccuracyPercent)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Dip at short gaps' : '短間隔的下降幅度'}</p><strong>{summary.blinkDepthPercent === null ? missing : `${summary.blinkDepthPercent}%`}</strong></div>
      </div></section>
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      <div className="score-actions">
        {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
        <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
      </div>
      <details className="score-details"><summary>{en ? 'View details' : '查看詳細資料'}</summary>
      <section className="score-context blink-lag-section" aria-labelledby="blink-lag-title">
        <h2 id="blink-lag-title">{en ? 'Second digit right, by gap' : '各間隔的第二個數字答對率'}</h2>
        <ul className="blink-lag-list">{lagValues.map(({ lag, value }) => <li key={lag}>
          <span className="blink-lag-label">{en ? `${lag} ${lag === 1 ? 'item' : 'items'} apart` : `間隔 ${lag} 個`}</span>
          <span className="blink-lag-bar" aria-hidden="true"><span style={{ width: `${value ?? 0}%` }} /></span>
          <span className="blink-lag-value">{percent(value)}</span></li>)}</ul>
        <p className="score-note">{en ? 'Only rounds with the first digit right count here. Many people catch the second digit less often when it follows two to four items after the first; the dip is the drop from the longest gap to the lowest of those.'
          : '這裡只計算第一個數字答對的回合。不少人在第二個數字緊跟在第一個之後 2 到 4 個字時，比較容易漏掉；下降幅度就是最長間隔與這幾個間隔中最低者的差距。'}</p>
      </section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Rounds completed' : '完成回數'}</dt><dd>{summary.trials}</dd></div>
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      </details>
    </section></div>}
  </div>;
}
