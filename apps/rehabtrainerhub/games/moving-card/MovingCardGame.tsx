import { initJsPsych, type JsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, numericSettings, ValidateSettings, type MovingCardSettings } from './settings';
import { BuildGameScore, type MovingCardTrial } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { MovingCardTutorial } from './rules/MovingCardTutorial';
import { DestroyPixiTrainingRuntime, WarmUpPixiTrainingRuntime } from './runtime/pixiPool';
import { PrepareAudioFeedback, SetSoundEnabled } from './runtime/soundManager';
import { ExitGame, IsHubGame, RetryGameSave, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { BuildMovingCardTimeline } from './timeline/movingCardTimeline';

export function MovingCardGame() {
  const { lang } = useT();
  const en = lang === 'en';
  const title = en ? 'Moving Card Training' : '移動卡片訓練';
  const [phase, setPhase] = useState<'menu' | 'rules' | 'running' | 'results'>('menu');
  const [settings, setSettings] = useState<MovingCardSettings>({ ...defaultSettings });
  const [results, setResults] = useState<MovingCardTrial[]>([]);
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
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    skipFinishRef.current = true;
    window.dispatchEvent(new Event('game:abort'));
    const experiment = jsPsychRef.current;
    jsPsychRef.current = null;
    experiment?.abortExperiment();
    DestroyPixiTrainingRuntime('moving-card');
    setReady(false);
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { setError(false); setResults([]); setPhase('menu'); };
    const failed = () => { stopRuntime(); setError(true); setPhase('menu'); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phaseRef.current === 'running') { event.preventDefault(); exit(); }
    };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('game:renderer-error', failed);
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('game:renderer-error', failed);
      window.removeEventListener('keydown', escape, true);
      stopRuntime();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [exit, stopRuntime]);
  useEffect(() => {
    if (phase !== 'menu') return;
    let cancelled = false;
    dialogRef.current?.showModal();
    if (!error) void WarmUpPixiTrainingRuntime('moving-card').then(() => {
      if (!cancelled) setReady(true);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; dialogRef.current?.close(); };
  }, [phase, error]);
  useEffect(() => {
    if (phase !== 'running') return;
    skipFinishRef.current = false;
    const jsPsych = initJsPsych({ display_element: 'jspsych-target', on_finish: () => {
      if (skipFinishRef.current) return;
      const data = jsPsych.data.get().values() as MovingCardTrial[];
      const score = BuildGameScore(data);
      window.dispatchEvent(new Event('game:abort'));
      DestroyPixiTrainingRuntime('moving-card');
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
    void jsPsych.run(BuildMovingCardTimeline(settings, lang) as never).catch(() => {
      if (!skipFinishRef.current) window.dispatchEvent(new Event('game:renderer-error'));
    });
    return () => { if (jsPsychRef.current === jsPsych) stopRuntime(); };
  }, [phase, settings, lang, stopRuntime]);
  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings) || !ready || error) return;
    SetSoundEnabled(settings.soundEnabled);
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
  const difficultyLabels = en ? ['Scattered relocation', 'Circular arrangement', 'Circular arrangement with rotation']
    : ['散佈移位', '圓形排列', '圓形排列並旋轉'];
  const summaryItems = [
    { label: en ? 'Visual search arrangement' : '視覺搜尋排列', value: difficultyLabels[['easy', 'medium', 'hard'].indexOf(settings.difficulty)] },
    ...numericSettings.map(field => ({ label: en ? field.en : field.zh, value: String(settings[field.key]) })),
    { label: en ? 'Sound feedback' : '聲音回饋', value: settings.soundEnabled ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉') },
    { label: en ? 'Measured calibration bar' : '校正線段實測長度', value: `${Number((settings.calibrationLengthMm * .4).toFixed(2))} mm` },
  ];
  const score = BuildGameScore(results);
  return <div ref={rootRef} className="moving-card-game-root">
    {(phase === 'menu' || phase === 'rules') && <MovingCardTutorial active={phase === 'rules'} ready={ready} title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog moving-card-phase-menu"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2>{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Card settings' : '卡片設定'}</h3>
            <p>{en ? 'These values apply only to this session.' : '設定值只用於這次活動。'}</p>
            {error && <p className="renderer-error" role="alert">{en ? 'The game could not load. Retry to continue.' : '遊戲無法載入，請重試。'}
              <button type="button" onClick={() => setError(false)}>{en ? 'Retry' : '重試'}</button></p>}
            <label>{en ? 'Visual search arrangement' : '視覺搜尋排列'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as MovingCardSettings['difficulty'] })}>
              {['easy', 'medium', 'hard'].map((difficulty, index) => <option key={difficulty} value={difficulty}>{difficultyLabels[index]}</option>)}
            </select></label>
            {numericSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} /></label>)}
            <label><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} /> {en ? 'Sound feedback' : '聲音回饋'}</label>
          </section>
          <section className="training-setting"><h3>{en ? 'Display calibration' : '螢幕尺寸校正'}</h3>
            <p>{en ? 'Measure this 280px bar with a ruler and enter its length in mm. Calibrate again for this isolated game. Letter sizes are capped to fit the available card.' : '以尺量下方 280px 線段，輸入實際毫米長度。隔離遊戲請重新校正。字母大小會依可用卡片空間縮小。'}</p>
            <div className="moving-card-calibration-bar" aria-hidden="true" />
            <label>{en ? 'Measured bar length (mm)' : '線段實測長度（毫米）'}<input name="calibrationLengthMm" type="number" required
              min="0.4" max="4000" step="any" value={Number((settings.calibrationLengthMm * .4).toFixed(4))}
              onChange={event => setSettings({ ...settings, calibrationLengthMm: Number(event.target.value) / .4 })} /></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" disabled={!ready || error} onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><div id="jspsych-target" className="moving-card-experiment" />
      <button type="button" className="moving-card-stop" onClick={exit}>{en ? 'Stop training' : '停止訓練'}</button></>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title} · {en ? 'Search time includes retries.' : '搜尋完成時間包含重試。'}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Targets found' : '找到目標'}</p><strong>{score.summary.completed} / {settings.rounds}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Selection attempts' : '選擇次數'}</p><strong>{score.rounds.reduce((sum, row) => sum + (row.attempts ?? 0), 0)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Incorrect selections' : '錯誤選擇次數'}</p><strong>{score.rounds.reduce((sum, row) => sum + (row.errors ?? 0), 0)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} trials={results} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
