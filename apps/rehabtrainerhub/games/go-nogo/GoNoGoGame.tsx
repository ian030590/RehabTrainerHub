import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, practiceItems, rangeSettings, ValidateSettings, type GoNoGoSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { GoNoGoTutorial } from './rules/GoNoGoTutorial';
import { CreateGoNoGoSteps, CreateRandom, PickGoColor, type GoNoGoTrial, type SquareColor } from './logic/goNoGoTrials';
import { TrialRun, type RunClock, type TrialOutcome } from './logic/trialRun';
import type { GoNoGoRow } from './logic/goNoGoScore';
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

const otherColor = (color: SquareColor): SquareColor => color === 'orange' ? 'blue' : 'orange';
const colorNames: Record<SquareColor, { zh: string; en: string }> = { orange: { zh: '橘色', en: 'orange' }, blue: { zh: '藍色', en: 'blue' } };

type Phase = 'menu' | 'rules' | 'running' | 'results';

export function GoNoGoGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<GoNoGoSettings>({ ...defaultSettings });
  const [goColor] = useState<SquareColor>(() => PickGoColor(CreateRandom(Date.now())));
  const [rows, setRows] = useState<GoNoGoRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLSpanElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const progressLabelRef = useRef<HTMLParagraphElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<TrialRun<GoNoGoTrial> | null>(null);
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
      if (event.key === ' ' || event.code === 'Space') { event.preventDefault(); if (!event.repeat) runRef.current?.respond('press'); }
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
    const steps = CreateGoNoGoSteps(settings, CreateRandom(Date.now()));
    const practiceCount = steps.filter(step => step.trial.practice).length;
    const colorOf = (trial: GoNoGoTrial) => trial.noGo ? otherColor(goColor) : goColor;
    const finish = (outcomes: TrialOutcome<GoNoGoTrial>[]) => {
      runRef.current = null;
      const completed = outcomes.map(outcome => ({ trial: outcome.index + 1, practice: outcome.trial.practice, noGo: outcome.trial.noGo,
        color: colorOf(outcome.trial) === 'orange' ? 0 : 1, responded: outcome.response !== null, rtMs: outcome.rtMs }));
      const score = BuildGameScore(completed, settings);
      jsPsychLifecycleRef.current?.finish({ trials: score.summary.trials, commission_errors: score.summary.commissionErrors, omission_errors: score.summary.omissionErrors });
      PlayGameEndSound('Victory');
      setRows(completed);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    const setState = (state: string) => { if (areaRef.current) areaRef.current.dataset.state = state; };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:go-nogo', onStart: () => {
      const run = new TrialRun<GoNoGoTrial>(steps.length, index => steps[index], {
        lead: state => setState(state),
        show: (step, index) => {
          if (feedbackRef.current) feedbackRef.current.textContent = '';
          if (squareRef.current) Object.assign(squareRef.current.dataset, { color: colorOf(step.trial), kind: step.trial.noGo ? 'nogo' : 'go' });
          const practice = index < practiceCount;
          const number = practice ? index + 1 : index - practiceCount + 1;
          const total = practice ? practiceCount : steps.length - practiceCount;
          if (progressLabelRef.current) progressLabelRef.current.textContent = practice
            ? (enRef.current ? `Practice ${number} of ${total}` : `練習 ${number}／${total}`)
            : (enRef.current ? `Square ${number} of ${total}` : `第 ${number} 個，共 ${total} 個`);
          if (progressFillRef.current) progressFillRef.current.style.width = `${number / total * 100}%`;
          setState('target');
        },
        hide: () => setState('blank'),
        signal: () => undefined,
        end: (outcome, feedback) => {
          if (!feedback) return;
          setState('feedback');
          if (!feedbackRef.current) return;
          const pressed = outcome.response !== null;
          const correct = outcome.trial.noGo ? !pressed : pressed;
          const english = enRef.current;
          feedbackRef.current.dataset.result = correct ? 'correct' : 'wrong';
          feedbackRef.current.textContent = correct ? (outcome.trial.noGo ? (english ? 'Correct. You held back.' : '答對了，有忍住。') : (english ? 'Correct' : '答對了'))
            : outcome.trial.noGo ? (english ? `Do not press for ${colorNames[otherColor(goColor)].en}.` : `${colorNames[otherColor(goColor)].zh}不要按。`)
              : (english ? `Missed. Press for ${colorNames[goColor].en}.` : `漏按了，${colorNames[goColor].zh}要按。`);
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
  }, [phase, settings, goColor]);

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

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), rest = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, rest && `${rest} s`] : [minutes && `${minutes} 分`, rest && `${rest} 秒`];
    return `${en ? 'about' : '約'} ${parts.filter(Boolean).join(' ')}`;
  };
  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`;
  const hints: Record<string, string> = en ? {
    exposureMs: 'How long each square stays on screen. A press still counts for a short while after it disappears.',
    rounds: 'Squares that count toward the results. One in every ten is the color to hold back on.',
    practice: `${practiceItems} practice squares with feedback come first. The counted squares give no feedback.`,
  } : {
    exposureMs: '每個色塊顯示多久。色塊消失後的短暫時間內按下也算數。',
    rounds: '計入成果的色塊數，每 10 個中有 1 個是不能按的顏色。',
    practice: `正式開始前先做 ${practiceItems} 個練習，會提示對錯；正式色塊不再提示。`,
  };
  const summaryItems = [
    { label: en ? 'Press for' : '要按的顏色', value: colorNames[goColor][lang] },
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? `Yes, ${practiceItems} squares` : `是，${practiceItems} 個`) : (en ? 'No' : '否') },
    { label: en ? 'Estimated time' : '預估時間', value: duration(EstimatedSeconds(settings)) },
  ];
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  return <div ref={rootRef} className="go-nogo-game-root">
    <div ref={jsPsychHostRef} className="go-nogo-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <GoNoGoTutorial active={phase === 'rules'} ready title={title} goColor={goColor}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog go-nogo-phase-menu" aria-labelledby="go-nogo-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="go-nogo-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="go-nogo-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <p className="go-nogo-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="go-nogo-stage go-nogo-running" aria-label={title}>
      <header className="go-nogo-hud">
        <p ref={progressLabelRef} className="go-nogo-progress-label" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <div className="go-nogo-progress-track"><div ref={progressFillRef} className="go-nogo-progress-fill" /></div>
        <button type="button" className="btn btn-ghost go-nogo-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={areaRef} className="go-nogo-stimulus-area" data-state="ready">
        <p className="go-nogo-legend">
          <span className="go-nogo-legend-item"><span className="go-nogo-swatch" data-color={goColor} aria-hidden="true" />{en ? 'Press' : '要按'}</span>
          <span className="go-nogo-legend-item"><span className="go-nogo-swatch" data-color={otherColor(goColor)} aria-hidden="true" />{en ? 'Hold back' : '不要按'}</span>
        </p>
        <span ref={squareRef} className="go-nogo-stimulus" aria-hidden="true" />
        <p className="go-nogo-break">{en ? 'Practice done. The counted squares start now and give no feedback.' : '練習結束，正式色塊馬上開始，不再提示對錯。'}</p>
        <p ref={feedbackRef} className="go-nogo-feedback" aria-live="off" />
      </div>
      <button type="button" className="go-nogo-pad" onPointerDown={event => { event.preventDefault(); runRef.current?.respond('press'); }}>
        {en ? 'Press' : '按'}<small>{en ? 'or Space bar' : '或空白鍵'}</small></button>
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Correct responses' : '正確率'}</p><strong>{summary.accuracy === null ? missing : `${summary.accuracy}%`}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Pressed on the hold-back color' : '不該按卻按了'}</p><strong>{summary.commissionErrors} / {summary.noGoTrials}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Missed presses' : '該按卻沒按'}</p><strong>{summary.omissionErrors} / {summary.goTrials}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Mean time on correct presses' : '正確按下的平均時間'}</dt><dd>{ms(summary.meanGoRtMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Spread of press times (SD)' : '按下時間的標準差'}</dt><dd>{ms(summary.goRtSdMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time over every press' : '所有按下的平均時間'}</dt><dd>{ms(summary.meanResponseMs)}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Practice squares are listed below but not counted here. The last line includes presses on the hold-back color.'
          : '練習色塊列在下方明細，但不計入這些統計。最後一項包含不該按卻按下的時間。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
