import { initJsPsych, type JsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, numericSettings, passageOptions, rangeSettings, segmentsPerDisplay, crowdingFromSegments, ValidateSettings, type ReadingSettings } from './settings';
import { BuildGameScore, type ReadingTrial } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { ReadingTutorial } from './rules/ReadingTutorial';
import { DestroyPixiTrainingRuntime, WarmUpPixiTrainingRuntime } from './runtime/pixiPool';
import { PrepareAudioFeedback, PlayMidiMusic, StopMidiMusic, DisposeAudioFeedback } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';
import { GetStory } from './reading/stories';
import { BuildReadingTimeline } from './timeline/readingTimeline';

export function ReadingTrainingGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<'menu' | 'rules' | 'running' | 'results'>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<ReadingSettings>({ ...defaultSettings });
  const [results, setResults] = useState<ReadingTrial[]>([]);
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
    generationRef.current++;
    skipFinishRef.current = true;
    window.dispatchEvent(new Event('game:abort'));
    const experiment = jsPsychRef.current;
    jsPsychRef.current = null;
    experiment?.abortExperiment();
    DestroyPixiTrainingRuntime('reading-training');
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
    if (!error) void WarmUpPixiTrainingRuntime('reading-training').then(() => {
      if (!cancelled) setReady(true);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; dialogRef.current?.close(); };
  }, [phase, error]);
  useEffect(() => {
    if (phase !== 'running') return;
    skipFinishRef.current = false;
    const jsPsych = initJsPsych({ display_element: 'jspsych-target', on_finish: () => {
      if (skipFinishRef.current) return;
      const data = jsPsych.data.get().values() as ReadingTrial[];
      const score = BuildGameScore(data, settings);
      window.dispatchEvent(new Event('game:abort'));
      DestroyPixiTrainingRuntime('reading-training');
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
    void jsPsych.run(BuildReadingTimeline(settings, GetStory(lang, settings.passage)) as never).catch(() => {
      if (!skipFinishRef.current) window.dispatchEvent(new Event('game:renderer-error'));
    });
    return () => { if (jsPsychRef.current === jsPsych) stopRuntime(); };
  }, [phase, settings, lang, stopRuntime]);
  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings) || !ready || error) return;
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
  const passageLabel = (passage: number) => passage === 0 ? (en ? 'Random' : '隨機') : (en ? `Passage ${passage}` : `第 ${passage} 篇`);
  const settingValue = (key: keyof ReadingSettings, value: number) => {
    if (key === 'passage') return passageLabel(value);
    const field = numericSettings.find(item => item.key === key)!;
    const text = `${value}${field.unitZh === '%' ? '%' : ` ${en ? field.unitEn : field.unitZh}`}`;
    if (key === 'crowding') return en ? `${segmentsPerDisplay(value)} per display` : `每批 ${segmentsPerDisplay(value)} 段`;
    return text;
  };
  const hints: Partial<Record<keyof ReadingSettings, string>> = en ? {
    passage: 'Random picks one of the three passages; a numbered passage is always the same story.',
    crowding: 'How many story segments appear together each time.',
    contrast: 'Higher values make the text darker.',
  } : {
    passage: '隨機會從三篇中挑一篇；指定篇號則固定使用同一篇故事。',
    crowding: '每次同時出現幾段故事文字。',
    contrast: '數值越大，文字越深。',
  };
  const summaryItems = numericSettings.map(field => ({ label: en ? field.en : field.zh, value: settingValue(field.key, settings[field.key]) }));
  const score = BuildGameScore(results, settings);
  const details = results.filter(row => typeof row.correct === 'boolean')
    .map(row => ({ question: row.target ?? '', response: row.response_text ?? null, answer: row.correct_text ?? null }));
  const missing = en ? 'N/A' : '無';
  const seconds = (value: number | null) => value === null ? missing : `${new Intl.NumberFormat(en ? 'en' : 'zh-TW', { maximumFractionDigits: 1 }).format(value / 1000)} s`;
  return <div ref={rootRef} className="reading-training-game-root">
    {(phase === 'menu' || phase === 'rules') && <ReadingTutorial active={phase === 'rules'} ready={ready} title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog reading-training-phase-menu"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2>{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Reading settings' : '閱讀設定'}</h3>
            {error && <p className="renderer-error" role="alert">{en ? 'The game could not load. Retry to continue.' : '遊戲無法載入，請重試。'}
              <button type="button" onClick={() => setError(false)}>{en ? 'Retry' : '重試'}</button></p>}
            <label>{en ? 'Passage material' : '文章材料'}<select name="passage" value={settings.passage}
              onChange={event => setSettings({ ...settings, passage: Number(event.target.value) })}>
              {passageOptions.map(passage => <option key={passage} value={passage}>{passageLabel(passage)}</option>)}
            </select>
              <small className="training-setting-description">{hints.passage}</small></label>
            <label>{en ? 'Segments per display' : '每批呈現文字片段數'}：<output>{settingValue('crowding', settings.crowding)}</output>
              <input name="crowding" type="range" min={1} max={5} step={1} value={segmentsPerDisplay(settings.crowding)}
                onChange={event => setSettings({ ...settings, crowding: crowdingFromSegments(Number(event.target.value)) })} />
              <small className="training-setting-description">{hints.crowding}</small></label>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settingValue(field.key, settings[field.key])}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              {hints[field.key] && <small className="training-setting-description">{hints[field.key]}</small>}</label>)}
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" disabled={!ready || error} onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><div id="jspsych-target" className="reading-training-experiment" />
      <button type="button" className="reading-training-stop" onClick={exit}>{en ? 'Stop training' : '停止訓練'}</button></>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Correct answers' : '理解題答對'}</p><strong>{score.summary.correct} / {score.summary.questions}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Presentation time (incl. countdown)' : '文字呈現時間（含倒數）'}</p><strong>{seconds(score.summary.presentationMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Segments shown' : '已呈現片段'}</p><strong>{score.summary.presented ?? missing} / {score.summary.wordCount ?? missing}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Passage used' : '本次文章'}</dt><dd>{score.summary.passage === null ? missing : passageLabel(score.summary.passage)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Passage shown in full' : '文章完整呈現'}</dt><dd>{score.summary.finished === null ? missing : score.summary.finished ? (en ? 'Yes' : '是') : (en ? 'No' : '否')}</dd></div>
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} details={details} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
