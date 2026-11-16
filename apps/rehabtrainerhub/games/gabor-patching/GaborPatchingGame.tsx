import { initJsPsych, type JsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, numericSettings, ValidateSettings, type GaborSettings } from './settings';
import { BuildGameScore, type GaborTrial } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { GaborTutorial } from './rules/GaborTutorial';
import { DestroyPixiTrainingRuntime, WarmUpPixiTrainingRuntime } from './runtime/pixiPool';
import { PrepareAudioFeedback, SetSoundEnabled, PlayMidiMusic, StopMidiMusic, DisposeAudioFeedback } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';
import { DisposeGaborTextures } from './gaborTexture';
import { BuildGaborPatchingTimeline } from './timeline/gaborPatchingTimeline';
import { SetGaborPaused } from './runtime/pauseState';

export function GaborPatchingGame() {
  const { lang } = useT();
  const en = lang === 'en';
  const title = en ? 'Gabor Patching' : '蓋伯斑塊練習';
  const [phase, setPhase] = useState<'menu' | 'rules' | 'running' | 'results'>('menu');
  const [paused, setPaused] = useState(false);
  const [fullscreenInterrupted, setFullscreenInterrupted] = useState(false);
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
  const [settings, setSettings] = useState<GaborSettings>({ ...defaultSettings });
  const [results, setResults] = useState<GaborTrial[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const jsPsychRef = useRef<JsPsych | null>(null);
  const generationRef = useRef(0);
  const skipFinishRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopRuntime = useCallback(() => {
    pausedRef.current = false;
    SetGaborPaused(false);
    setPaused(false);
    generationRef.current++;
    skipFinishRef.current = true;
    window.dispatchEvent(new Event('game:abort'));
    const experiment = jsPsychRef.current;
    jsPsychRef.current = null;
    experiment?.abortExperiment();
    DestroyPixiTrainingRuntime('gabor-patching');
    DisposeGaborTextures();
    setReady(false);
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const pause = useCallback(() => {
    if (pausedRef.current) return;
    setFullscreenInterrupted(false);
    pausedRef.current = true;
    SetGaborPaused(true);
    window.dispatchEvent(new Event('game:pause'));
    DisposeAudioFeedback();
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    SetGaborPaused(false);
    restoreStopRef.current = true;
    window.dispatchEvent(new Event('game:resume'));
    setPaused(false);
  }, []);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { setError(false); setResults([]); setPhase('menu'); };
    const failed = () => { stopRuntime(); setError(true); setPhase('menu'); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phaseRef.current === 'running') { event.preventDefault(); if (!event.repeat) { if (pausedRef.current) resume(); else pause(); } }
    };
    const fullscreenChanged = () => {
      if (phaseRef.current === 'running' && !skipFinishRef.current && !document.fullscreenElement) {
        pause();
        setFullscreenInterrupted(true);
      }
    };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('game:renderer-error', failed);
    window.addEventListener('keydown', escape, true);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('game:renderer-error', failed);
      window.removeEventListener('keydown', escape, true);
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      stopRuntime();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [pause, resume, stopRuntime]);
  useEffect(() => {
    if (phase !== 'menu') return;
    let cancelled = false;
    dialogRef.current?.showModal();
    if (!error) void WarmUpPixiTrainingRuntime('gabor-patching').then(() => {
      if (!cancelled) setReady(true);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; dialogRef.current?.close(); };
  }, [phase, error]);
  useEffect(() => {
    if (phase !== 'running') return;
    skipFinishRef.current = false;
    const jsPsych = initJsPsych({ display_element: 'jspsych-target', on_finish: () => {
      if (skipFinishRef.current) return;
      skipFinishRef.current = true;
      const data = jsPsych.data.get().values() as GaborTrial[];
      const score = BuildGameScore(data);
      window.dispatchEvent(new Event('game:abort'));
      DestroyPixiTrainingRuntime('gabor-patching');
      DisposeGaborTextures();
      jsPsychRef.current = null;
      setReady(false);
      setResults(data);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    } });
    jsPsychRef.current = jsPsych;
    SendGameEvent('active');
    void jsPsych.run(BuildGaborPatchingTimeline(settings, lang) as never).catch(() => {
      if (!skipFinishRef.current) window.dispatchEvent(new Event('game:renderer-error'));
    });
    if (pausedRef.current) window.dispatchEvent(new Event('game:pause'));
    return () => { if (jsPsychRef.current === jsPsych) stopRuntime(); };
  }, [phase, settings, lang, stopRuntime]);
  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings) || !ready || error) return;
    SetSoundEnabled(settings.soundEnabled);
    SaveGameSettings(settings);
    setPhase('rules');
  };
  const startTraining = async () => {
    if (!ready || phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    const generation = generationRef.current;
    PrepareAudioFeedback();
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* Windowed play remains available. */ }
    if (generation !== generationRef.current || phaseRef.current !== 'rules') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    setPhase('running');
  };
  const difficultyLabels = en ? ['Easy (4 s / 2% per frame)', 'Medium (3 s / 5% per frame)', 'Hard (2 s / 8% per frame)']
    : ['簡單（4 秒／每幀 2%）', '中等（3 秒／每幀 5%）', '困難（2 秒／每幀 8%）'];
  const summaryItems = [
    { label: en ? 'Target lifetime and spawn probability' : '目標存續與生成機率', value: difficultyLabels[['easy', 'medium', 'hard'].indexOf(settings.difficulty)] },
    ...numericSettings.map(field => ({ label: en ? field.en : field.zh, value: String(settings[field.key]) })),
    { label: en ? 'Sound feedback' : '聲音回饋', value: settings.soundEnabled ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉') },
  ];
  const score = BuildGameScore(results);
  const missing = en ? 'N/A' : '無';
  return <div ref={rootRef} className="gabor-patching-game-root">
    {(phase === 'menu' || phase === 'rules') && <GaborTutorial active={phase === 'rules'} ready={ready} title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog gabor-patching-phase-menu"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2>{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Stimulus settings' : '刺激設定'}</h3>
            {error && <p className="renderer-error" role="alert">{en ? 'The game could not load. Retry to continue.' : '遊戲無法載入，請重試。'}
              <button type="button" onClick={() => setError(false)}>{en ? 'Retry' : '重試'}</button></p>}
            <label>{en ? 'Target lifetime and spawn probability' : '目標存續與生成機率'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as GaborSettings['difficulty'] })}>
              {['easy', 'medium', 'hard'].map((difficulty, index) => <option key={difficulty} value={difficulty}>{difficultyLabels[index]}</option>)}
            </select></label>
            {numericSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} /></label>)}
            <label><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} /> {en ? 'Sound feedback' : '聲音回饋'}</label>
          </section>

        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings} disabled={!ready || error}>{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><div inert={paused}><div id="jspsych-target" className="gabor-patching-experiment" />
      <button ref={stopRef} type="button" className="btn btn-ghost gabor-patching-stop" onClick={pause}>{en ? 'Stop' : '停止'}</button></div>
      {paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="gabor-pause-title"
        onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
        <h2 id="gabor-pause-title">{en ? 'Paused' : '已暫停'}</h2>
        <p>{fullscreenInterrupted ? (en ? 'Fullscreen ended; ending the activity will not save this session.' : '已退出全螢幕，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束後不會保存這次紀錄。')}</p>
        <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume}>{en ? 'Continue' : '繼續'}</button>
        <button className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
      </div></div>}</>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title} · {en ? 'Earlier clicks earn more points.' : '越早點擊得分越高。'}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Weighted points' : '加權積分'}</p><strong>{score.summary.score ?? missing}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Targets clicked' : '點擊目標數'}</p><strong>{score.summary.hits ?? missing}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Configured activity duration' : '設定活動時間'}</p><strong>{score.summary.durationMs === null ? missing : `${score.summary.durationMs / 1000} s`}</strong></div>
      </div></section>
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      <div className="score-actions">
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
      </div>
      <details className="score-details"><summary>{en ? 'View details' : '查看詳細資料'}</summary>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      </details>
    </section></div>}
  </div>;
}
