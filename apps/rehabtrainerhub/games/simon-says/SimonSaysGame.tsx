import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, difficulties, livesOptions, ValidateSettings, type Difficulty, type SimonSaysSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { SimonTutorial } from './rules/SimonTutorial';
import { CreateRandom, SimonMatch, targetLengths, timing, type Outcome } from './logic/simonSays';
import { Hearts, SimonPads } from './SimonPads';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
const outcomeHoldMs = 1600;
const pressMs = 180;
const shakeMs = 400;

export function SimonSaysGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<SimonSaysSettings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [score, setScore] = useState<ReturnType<typeof BuildGameScore> | null>(null);
  const [lit, setLit] = useState<number | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const matchRef = useRef<SimonMatch | null>(null);
  const startedAtRef = useRef(0);
  const endedAtRef = useRef<number | null>(null);
  const timerRef = useRef(0);
  const playbackRef = useRef<number[]>([]);
  const pressTimerRef = useRef(0);
  const shakeTimerRef = useRef(0);
  const generationRef = useRef(0);
  const tapRef = useRef<(pad: number) => void>(() => undefined);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const clearPlayback = useCallback(() => {
    playbackRef.current.forEach(timer => window.clearTimeout(timer));
    playbackRef.current = [];
  }, []);
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    matchRef.current = null;
    clearPlayback();
    window.clearTimeout(timerRef.current);
    window.clearTimeout(pressTimerRef.current);
    window.clearTimeout(shakeTimerRef.current);
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, [clearPlayback]);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setScore(null); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      const pad = ['1', '2', '3', '4'].indexOf(event.key);
      if (pad >= 0 && !event.repeat) { event.preventDefault(); tapRef.current(pad); }
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

  const finish = useCallback((match: SimonMatch) => {
    const result = BuildGameScore(match, (endedAtRef.current ?? performance.now()) - startedAtRef.current);
    jsPsychLifecycleRef.current?.finish({ outcome: match.outcome, trials: result.summary.trials, longestCorrect: result.summary.longestCorrect });
    matchRef.current = null;
    setScore(result);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, result.summary, result.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  // The final pads stay on screen briefly so the player sees the outcome before the results.
  const end = useCallback((match: SimonMatch, outcome: Outcome) => {
    endedAtRef.current = performance.now();
    clearPlayback();
    PlayGameEndSound(outcome);
    setVersion(version => version + 1);
    const generation = generationRef.current;
    timerRef.current = window.setTimeout(() => { if (generation === generationRef.current) finish(match); }, outcomeHoldMs);
  }, [clearPlayback, finish]);
  // Lights each pad of the sequence in turn, then hands the pads to the player.
  const playSequence = useCallback((match: SimonMatch) => {
    clearPlayback();
    const generation = generationRef.current;
    const at = (delay: number, step: () => void) => playbackRef.current.push(window.setTimeout(() => {
      if (generation === generationRef.current && matchRef.current === match) step();
    }, delay));
    let delay = timing.leadInMs;
    for (const pad of match.sequence) {
      at(delay, () => setLit(pad));
      delay += timing.lightMs;
      at(delay, () => setLit(null));
      delay += timing.gapMs;
    }
    at(delay, () => { match.beginInput(performance.now()); setVersion(version => version + 1); });
  }, [clearPlayback]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:simon-says', onStart: () => {
      startedAtRef.current = performance.now();
      endedAtRef.current = null;
      const match = new SimonMatch(settings.difficulty, settings.lives, CreateRandom(Date.now()));
      matchRef.current = match;
      setLit(null);
      setFeedback('');
      setVersion(version => version + 1);
      playSequence(match);
    } });
    return () => {
      matchRef.current = null;
      clearPlayback();
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings.difficulty, settings.lives, playSequence, clearPlayback]);

  const tapPad = (pad: number) => {
    const match = matchRef.current;
    if (phaseRef.current !== 'running' || !match) return;
    const tap = match.tap(pad, performance.now());
    if (!tap.accepted) return;
    setPressed(pad);
    window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => setPressed(null), pressMs);
    if (tap.result === 'step' || (tap.result === 'sequence' && !tap.outcome)) PlaySuccessSound();
    if (tap.result === 'wrong') PlayFailureSound();
    if (tap.result === 'wrong') {
      setShake(true);
      window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = window.setTimeout(() => setShake(false), shakeMs);
      setFeedback(en ? 'Wrong pad. Watch the same order again.' : '點錯了，再看一次同樣的順序。');
    } else setFeedback(tap.result === 'sequence' && !tap.outcome ? (en ? 'Correct. One more pad.' : '答對了，多加一個。') : '');
    setVersion(version => version + 1);
    if (tap.outcome) end(match, tap.outcome);
    else if (match.status === 'showing') playSequence(match);
  };
  tapRef.current = tapPad;

  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings(settings);
    setPhase('rules');
  };
  const startTraining = async () => {
    if (phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    const generation = generationRef.current;
    SetSoundEnabled(settings.soundEnabled);
    PrepareAudioFeedback();
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* Windowed play remains available. */ }
    if (generation !== generationRef.current || phaseRef.current !== 'rules') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    SendGameEvent('active');
    setPhase('running');
  };

  const lengthLabel = (difficulty: Difficulty) => en ? `${targetLengths[difficulty]} pads` : `${targetLengths[difficulty]} 個`;
  const livesLabel = (value: number) => en ? `${value} ${value === 1 ? 'life' : 'lives'}` : `${value} 條`;
  const onOff = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Target length' : '目標順序長度', value: lengthLabel(settings.difficulty) },
    { label: en ? 'Lives' : '生命', value: livesLabel(settings.lives) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: onOff(settings.soundEnabled) },
  ];
  const seconds = (value: number) => `${value.toFixed(1)} ${en ? 's' : '秒'}`;
  const match = matchRef.current;
  const outcomeLabel = (current: SimonMatch) => current.outcome === 'Victory'
    ? (en ? `You repeated all ${current.targetLength} pads` : `${current.targetLength} 個全部照順序完成`)
    : en ? 'No lives left' : '生命用完了';
  const statusLabel = (current: SimonMatch) => current.status === 'input'
    ? (en ? `Your turn ${current.inputIndex} / ${current.sequence.length}` : `換你 ${current.inputIndex} / ${current.sequence.length}`)
    : current.status === 'showing' ? (en ? 'Watch' : '看順序') : (en ? 'Done' : '結束');
  const summary = score?.summary;
  return <div ref={rootRef} className="simon-says-game-root">
    <div ref={jsPsychHostRef} className="ss-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <SimonTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog simon-says-phase-menu" aria-labelledby="ss-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="ss-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Target length' : '目標順序長度'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(difficulty => <option key={difficulty} value={difficulty}>{lengthLabel(difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'The order starts with one pad and grows by one after each correct repeat. Reaching this length finishes the game.' : '順序從 1 個開始，每答對一次多加一個；達到這個長度就完成。'}</small></label>
            <label>{en ? 'Lives' : '生命'}<select name="lives" value={settings.lives}
              onChange={event => setSettings({ ...settings, lives: Number(event.target.value) })}>
              {livesOptions.map(value => <option key={value} value={value}>{livesLabel(value)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'A wrong pad costs one life and replays the same order.' : '點錯會少一條生命，並重播同一個順序。'}</small></label>
            <label className="ss-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{en ? 'A short sound for each right or wrong pad, and when the game ends.' : '點對、點錯與結束時播放提示音。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="ss-stage ss-running" aria-label={title}>
      <header className="ss-hud">
        <p className="ss-status" role="status" data-turn={match?.status === 'input' ? 'true' : undefined}>{match ? statusLabel(match) : ''}</p>
        <p className="ss-length">{en ? 'Length' : '長度'} {match?.sequence.length ?? 1} / {match?.targetLength ?? targetLengths[settings.difficulty]}</p>
        <Hearts count={match?.lives ?? settings.lives} total={settings.lives} en={en} />
        <button type="button" className="btn btn-ghost ss-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className={`ss-feedback${match?.outcome ? ' ss-outcome' : ''}`} role="status" data-outcome={match?.outcome ?? undefined}>
        {match?.outcome ? outcomeLabel(match) : feedback}</p>
      {match && <div className="ss-board-slot">
        <SimonPads lit={lit} pressed={pressed} state={match.status} shake={shake} en={en} label={en ? 'Pads' : '按鈕'} onPad={tapPad} />
      </div>}
    </main>}
    {phase === 'results' && score && summary && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Result' : '結果'}</p><strong>{summary.completed ? (en ? 'Completed' : '完成') : (en ? 'No lives left' : '生命用完')}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Longest correct order' : '最長正確順序'}</p><strong>{summary.longestCorrect}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Correct repeats' : '答對次數'}</p><strong>{summary.correctTrials} / {summary.trials}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Lives left' : '剩下的生命'}</dt><dd>{summary.remainingLives} / {summary.maxLives}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Total time' : '總用時'}</dt><dd>{seconds(summary.duration)}</dd></div>
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
