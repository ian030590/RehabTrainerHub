import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, ValidateSettings, type PatternSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { PatternBoard } from './PatternBoard';
import { PatternTutorial } from './rules/PatternTutorial';
import { CreatePatternTrial, CreateRandom, LoadStaircase, ScorePatternTrial, type PatternRow, type PatternTrial } from './logic/patterns';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Step = 'ready' | 'study' | 'blank' | 'test' | 'feedback';

const readyMs = 600, blankMs = 1000, feedbackMs = 1200;

export function PatternMemoryGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<PatternSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<PatternRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [step, setStep] = useState<Step>('ready');
  const [trial, setTrial] = useState<PatternTrial | null>(null);
  const [trialIndex, setTrialIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const rowsRef = useRef<PatternRow[]>([]);
  const randomRef = useRef(CreateRandom(1));
  const staircaseRef = useRef(new LoadStaircase(defaultSettings.startLoad, true));
  const trialRef = useRef<PatternTrial | null>(null);
  const testStartRef = useRef(0);
  const timerRef = useRef(0);
  const stepRef = useRef(step);
  stepRef.current = step;
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const enRef = useRef(en);
  enRef.current = en;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopTimers = useCallback(() => window.clearTimeout(timerRef.current), []);
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    stopTimers();
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, [stopTimers]);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  const later = (callback: () => void, ms: number) => {
    const generation = generationRef.current;
    timerRef.current = window.setTimeout(() => { if (generation === generationRef.current) callback(); }, ms);
  };
  const finish = useCallback((completed: PatternRow[]) => {
    const score = BuildGameScore(completed);
    jsPsychLifecycleRef.current?.finish({ trials: completed.length, accuracy_percent: score.summary.accuracyPercent, cowan_k: score.summary.cowanK });
    PlayGameEndSound('Victory');
    setRows(completed);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, score.summary, score.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  const beginTrialRef = useRef<(index: number) => void>(() => undefined);
  beginTrialRef.current = (index: number) => {
    const next = CreatePatternTrial(staircaseRef.current.load, randomRef.current);
    trialRef.current = next;
    setTrial(next);
    setTrialIndex(index);
    setFeedback('');
    setStep('ready');
    later(() => {
      setStep('study');
      later(() => {
        setStep('blank');
        later(() => { testStartRef.current = performance.now(); setStep('test'); }, blankMs);
      }, settings.studyMs);
    }, readyMs);
  };
  const answerRef = useRef<(saidChanged: boolean) => void>(() => undefined);
  answerRef.current = (saidChanged: boolean) => {
    const current = trialRef.current;
    if (phaseRef.current !== 'running' || stepRef.current !== 'test' || !current) return;
    const row = ScorePatternTrial(trialIndex + 1, current, saidChanged, performance.now() - testStartRef.current);
    rowsRef.current = [...rowsRef.current, row];
    staircaseRef.current.record(row.correct);
    if (row.correct) PlaySuccessSound(); else PlayFailureSound();
    const english = enRef.current;
    const what = english ? ['', 'colour', 'shape', 'place'][current.change] : ['', '顏色', '形狀', '位置'][current.change];
    setFeedback(row.correct ? (english ? '✓ Right' : '✓ 答對')
      : current.change === 0 ? (english ? '✗ Both boards were the same.' : '✗ 兩次完全一樣。')
        : (english ? `✗ One shape changed its ${what}.` : `✗ 有一個圖形換了${what}。`));
    setStep('feedback');
    later(() => {
      if (rowsRef.current.length >= settings.trials) finish(rowsRef.current);
      else beginTrialRef.current(trialIndex + 1);
    }, feedbackMs);
  };
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      const same = event.code === 'KeyF' || event.key === 'ArrowLeft', changed = event.code === 'KeyJ' || event.key === 'ArrowRight';
      if (!same && !changed) return;
      event.preventDefault();
      if (!event.repeat) answerRef.current(changed);
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
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:pattern-memory', onStart: () => {
      randomRef.current = CreateRandom(Date.now());
      staircaseRef.current = new LoadStaircase(settings.startLoad, settings.adaptive);
      rowsRef.current = [];
      beginTrialRef.current(0);
    } });
    return () => {
      stopTimers();
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings, stopTimers]);

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
    setTrial(null);
    setStep('ready');
    setTrialIndex(0);
    setPhase('running');
  };

  const seconds = (ms: number) => en ? `${ms / 1000} s` : `${ms / 1000} 秒`;
  const summaryItems = [
    { label: en ? 'Trials' : '題數', value: en ? String(settings.trials) : `${settings.trials} 題` },
    { label: en ? 'Look time' : '看的時間', value: seconds(settings.studyMs) },
    { label: en ? 'Shapes to start' : '開始的圖形數', value: en ? String(settings.startLoad) : `${settings.startLoad} 個` },
    { label: en ? 'Adjust the number of shapes' : '自動調整圖形數', value: settings.adaptive ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉') },
  ];
  const items = !trial || step === 'ready' || step === 'blank' ? [] : step === 'study' ? trial.study : trial.test;
  const changedIndex = trial && step === 'feedback' ? trial.test.findIndex((item, index) => item.cell !== trial.study[index].cell
    || item.color !== trial.study[index].color || item.shape !== trial.study[index].shape) : -1;
  const prompts: Record<Step, string> = en
    ? { ready: 'Get ready.', study: 'Remember the board.', blank: 'Hold it in mind…', test: 'Did anything change?', feedback }
    : { ready: '準備。', study: '記住這個畫面。', blank: '記在心裡……', test: '有沒有改變？', feedback };
  const score = BuildGameScore(rows);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  return <div ref={rootRef} className="pattern-memory-game-root">
    <div ref={jsPsychHostRef} className="pattern-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <PatternTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog pattern-memory-phase-menu" aria-labelledby="pattern-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="pattern-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Trials' : '題數'}：<output>{settings.trials}</output>
              <input name="trials" type="range" min={20} max={60} step={5} value={settings.trials}
                onChange={event => setSettings({ ...settings, trials: Number(event.target.value) })} />
              <small className="training-setting-description">{en ? 'Each trial takes about 5 seconds plus your answer.' : '每題約 5 秒，加上作答時間。'}</small></label>
            <label>{en ? 'Look time' : '看的時間'}：<output>{seconds(settings.studyMs)}</output>
              <input name="studyMs" type="range" min={500} max={3000} step={250} value={settings.studyMs}
                onChange={event => setSettings({ ...settings, studyMs: Number(event.target.value) })} />
              <small className="training-setting-description">{en ? 'How long the first board stays up.' : '第一個畫面停留多久。'}</small></label>
            <label>{en ? 'Shapes to start' : '開始的圖形數'}：<output>{settings.startLoad}</output>
              <input name="startLoad" type="range" min={2} max={6} step={1} value={settings.startLoad}
                onChange={event => setSettings({ ...settings, startLoad: Number(event.target.value) })} /></label>
            <label className="pattern-checkbox"><input name="adaptive" type="checkbox" checked={settings.adaptive}
              onChange={event => setSettings({ ...settings, adaptive: event.target.checked })} />{en ? 'Adjust the number of shapes' : '自動調整圖形數'}
              <small className="training-setting-description">{en ? 'Two right answers in a row add a shape; a miss removes one (2 to 8 shapes).'
                : '連續答對兩題加一個圖形，答錯減一個（2 到 8 個）。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="pattern-stage pattern-running" aria-label={title}>
      <header className="pattern-hud">
        <p className="pattern-progress-label">{en ? `Trial ${trialIndex + 1} of ${settings.trials}` : `第 ${trialIndex + 1} 題，共 ${settings.trials} 題`}</p>
        <p className="pattern-load">{en ? `${trial?.load ?? settings.startLoad} shapes` : `${trial?.load ?? settings.startLoad} 個圖形`}</p>
        <div className="pattern-progress-track"><div className="pattern-progress-fill" style={{ width: `${(trialIndex + 1) / settings.trials * 100}%` }} /></div>
        <button type="button" className="btn btn-ghost pattern-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div className="pattern-board-area"><PatternBoard items={items} step={step} changedCell={changedIndex >= 0 ? trial!.test[changedIndex].cell : null} en={en} /></div>
      <div className="pattern-controls">
        <p className="pattern-prompt" role="status" data-step={step}>{prompts[step]}</p>
        <div className="pattern-answers">
          <button type="button" className="pattern-answer pattern-same" disabled={step !== 'test'} onClick={() => answerRef.current(false)}>
            {en ? 'Same' : '一樣'}<small>{en ? 'F or ←' : 'F 或 ←'}</small></button>
          <button type="button" className="pattern-answer pattern-changed" disabled={step !== 'test'} onClick={() => answerRef.current(true)}>
            {en ? 'Changed' : '有變'}<small>{en ? 'J or →' : 'J 或 →'}</small></button>
        </div>
      </div>
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Right' : '答對率'}</p><strong>{percent(summary.accuracyPercent)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Estimated shapes held (K)' : '估計記住的圖形數（K）'}</p><strong>{summary.cowanK ?? missing}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Most shapes on a board' : '最多的圖形數'}</p><strong>{summary.maxLoad ?? missing}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Changes spotted' : '有變時答「有變」'}</dt><dd>{percent(summary.hitRatePercent)}</dd></div>
        <div className="score-context-item"><dt>{en ? '"Changed" when nothing changed' : '沒變卻答「有變」'}</dt><dd>{percent(summary.falseAlarmRatePercent)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean shapes on a board' : '平均圖形數'}</dt><dd>{summary.meanLoad ?? missing}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean answer time' : '平均作答時間'}</dt><dd>{summary.meanRtMs === null ? missing : `${summary.meanRtMs} ms`}</dd></div>
      </dl>
        <p className="score-note">{en ? 'K is the mean number of shapes times the share of changes spotted minus the share of false "changed" answers (Cowan\'s K).'
          : 'K＝平均圖形數 ×（有變時答「有變」的比例 − 沒變卻答「有變」的比例），即 Cowan\'s K。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
