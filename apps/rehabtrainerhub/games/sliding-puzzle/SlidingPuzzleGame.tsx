import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, difficulties, timeLimits, ValidateSettings, type Difficulty, type SlidingPuzzleSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { SlidingTutorial } from './rules/SlidingTutorial';
import { CreateRandom, slidingConfig, SlidingMatch, type Outcome } from './logic/slidingPuzzle';
import { FormatRemaining, MoveSlidingFocus, SlidingBoard, TileStyle } from './SlidingBoard';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
const outcomeHoldMs = 1600;
const warningMs = 10000;

export function SlidingPuzzleGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<SlidingPuzzleSettings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [score, setScore] = useState<ReturnType<typeof BuildGameScore> | null>(null);
  const [focusTile, setFocusTile] = useState(1);
  const [stuckTap, setStuckTap] = useState(false);
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const matchRef = useRef<SlidingMatch | null>(null);
  const randomRef = useRef(CreateRandom(Date.now()));
  const startedAtRef = useRef(0);
  const endedAtRef = useRef<number | null>(null);
  const timerRef = useRef(0);
  const limitTimerRef = useRef(0);
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    matchRef.current = null;
    window.clearTimeout(timerRef.current);
    window.clearTimeout(limitTimerRef.current);
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setScore(null); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current === 'running' && event.key === 'Escape') { event.preventDefault(); exit(); }
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

  const finish = useCallback((match: SlidingMatch) => {
    const result = BuildGameScore(match, (endedAtRef.current ?? performance.now()) - startedAtRef.current);
    jsPsychLifecycleRef.current?.finish({ outcome: match.outcome, moves: result.summary.moves, errors: result.summary.errors, misplaced: result.summary.misplaced });
    matchRef.current = null;
    setScore(result);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, result.summary, result.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  // The final board stays on screen briefly so the player sees it before the results.
  const end = useCallback((match: SlidingMatch, outcome: Outcome) => {
    endedAtRef.current = performance.now();
    window.clearTimeout(limitTimerRef.current);
    // A board still out of order at the time limit ends as a loss, as in the original game.
    PlayGameEndSound(outcome === 'Victory' ? 'Victory' : 'Defeat');
    setVersion(version => version + 1);
    const generation = generationRef.current;
    timerRef.current = window.setTimeout(() => { if (generation === generationRef.current) finish(match); }, outcomeHoldMs);
  }, [finish]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:sliding-puzzle', onStart: () => {
      startedAtRef.current = performance.now();
      endedAtRef.current = null;
      randomRef.current = CreateRandom(Date.now());
      const match = new SlidingMatch(settings.difficulty, startedAtRef.current, randomRef.current);
      matchRef.current = match;
      setFocusTile(match.tiles.find(tile => tile !== 0) ?? 1);
      setStuckTap(false);
      setVersion(version => version + 1);
      if (settings.timeLimitSec) {
        const generation = generationRef.current;
        limitTimerRef.current = window.setTimeout(() => {
          if (generation !== generationRef.current || matchRef.current !== match) return;
          if (match.expire()) end(match, 'TimeUp');
        }, settings.timeLimitSec * 1000);
      }
    } });
    return () => {
      matchRef.current = null;
      window.clearTimeout(limitTimerRef.current);
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings.difficulty, settings.timeLimitSec, end]);
  // The visible clock reads the match start time, so it never drifts from the recorded duration.
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => {
      const clock = clockRef.current;
      if (!clock || !matchRef.current || endedAtRef.current !== null) return;
      const elapsed = performance.now() - startedAtRef.current;
      if (!settings.timeLimitSec) { clock.textContent = `${(elapsed / 1000).toFixed(1)} ${en ? 's' : '秒'}`; return; }
      const remaining = settings.timeLimitSec * 1000 - elapsed;
      clock.textContent = FormatRemaining(remaining, en);
      clock.toggleAttribute('data-warning', remaining <= warningMs);
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, en, settings.timeLimitSec]);

  const slideTile = (tile: number) => {
    const match = matchRef.current;
    if (phaseRef.current !== 'running' || !match || match.outcome) return;
    const errorsBefore = match.errors;
    const slide = match.slide(match.tiles.indexOf(tile), performance.now());
    if (!slide.accepted) {
      if (match.errors > errorsBefore) {
        PlayFailureSound();
        setStuckTap(true);
        setVersion(version => version + 1);
      }
      return;
    }
    setStuckTap(false);
    setVersion(version => version + 1);
    if (slide.solved) end(match, 'Victory');
    else PlaySuccessSound();
  };

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

  const boardLabel = (difficulty: Difficulty) => {
    const { size, shuffles } = slidingConfig[difficulty];
    return en ? `${size} × ${size} / ${shuffles} steps` : `${size} × ${size}／${shuffles} 步`;
  };
  const limitLabel = (value: number) => value === 0 ? (en ? 'No limit' : '不限時') : en ? `${value / 60} minute${value === 60 ? '' : 's'}` : `${value / 60} 分鐘`;
  const onOff = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Board and scramble' : '棋盤與打亂步數', value: boardLabel(settings.difficulty) },
    { label: en ? 'Time limit' : '時間限制', value: limitLabel(settings.timeLimitSec) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: onOff(settings.soundEnabled) },
  ];
  const seconds = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${value.toFixed(1)} ${en ? 's' : '秒'}`;
  const ms = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${(value / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
  const outcomeLabel = (match: SlidingMatch) => match.outcome === 'Victory' ? (en ? 'Every tile is in order' : '數字都排好了')
    : en ? `Time is up: ${match.misplaced} tile${match.misplaced === 1 ? ' is' : 's are'} out of place` : `時間到，還有 ${match.misplaced} 塊不在位置上`;
  const match = matchRef.current;
  const tileLabel = (tile: number, index: number, size: number) => {
    const position = en ? `row ${Math.floor(index / size) + 1}, column ${index % size + 1}` : `在第 ${Math.floor(index / size) + 1} 列第 ${index % size + 1} 欄`;
    return en ? `Tile ${tile}, ${position}` : `方塊 ${tile}，${position}`;
  };
  const last = match ? match.size * match.size - 1 : 0;
  const summary = score?.summary;
  return <div ref={rootRef} className="sliding-puzzle-game-root">
    <div ref={jsPsychHostRef} className="sp-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <SlidingTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog sliding-puzzle-phase-menu" aria-labelledby="sp-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="sp-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Board and scramble' : '棋盤與打亂步數'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(difficulty => <option key={difficulty} value={difficulty}>{boardLabel(difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'The tiles start in order and the gap takes this many random steps to scramble them. That is not the fewest moves needed.' : '方塊從排好的狀態開始，空格隨機走這麼多步打亂；這不等於最少解題步數。'}</small></label>
            <label>{en ? 'Time limit' : '時間限制'}<select name="timeLimitSec" value={settings.timeLimitSec}
              onChange={event => setSettings({ ...settings, timeLimitSec: Number(event.target.value) })}>
              {timeLimits.map(value => <option key={value} value={value}>{limitLabel(value)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'If the tiles are not in order when time runs out, the game ends.' : '時間到時還沒排好，這局就結束。'}</small></label>
            <label className="sp-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{en ? 'A short sound for each slide, for a tap on a tile that cannot move and at the end of the game.' : '每次滑動、點到不能移動的方塊與結束時播放提示音。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="sp-stage sp-running" aria-label={title}>
      <header className="sp-hud">
        <p className="sp-goal">{en ? `Order 1 to ${last}` : `排成 1 到 ${last}`}</p>
        <p className="sp-moves" role="status">{en ? 'Moves' : '步數'} {match?.moves ?? 0}</p>
        <p ref={clockRef} className="sp-clock">{settings.timeLimitSec ? FormatRemaining(settings.timeLimitSec * 1000, en) : `0.0 ${en ? 's' : '秒'}`}</p>
        <button type="button" className="btn btn-ghost sp-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className={`sp-feedback${match?.outcome ? ' sp-outcome' : ''}`} role="status" data-outcome={match?.outcome ?? undefined}>
        {match?.outcome ? outcomeLabel(match) : stuckTap ? (en ? 'That tile is not beside the gap. Tap a tile directly above, below, left or right of it.' : '這塊不在空格旁邊，請點空格上下左右的方塊。') : ''}</p>
      {match && <div className="sp-board-slot">
        <SlidingBoard size={match.size} state={match.outcome ? 'over' : 'running'} label={en ? 'Game board' : '棋盤'}
          onKeyDown={event => MoveSlidingFocus(event, match.tiles, match.size)}>
          {/* Buttons stay in tile-number order, so moving one never reorders the DOM or drops keyboard focus. */}
          {Array.from({ length: last }, (_, offset) => offset + 1).map(tile => {
            const index = match.tiles.indexOf(tile);
            return <button type="button" key={tile} className="sp-tile" style={TileStyle(index, match.size)} data-tile={tile}
              data-index={index}
              tabIndex={tile === focusTile ? 0 : -1} onFocus={() => setFocusTile(tile)}
              aria-label={tileLabel(tile, index, match.size)} onClick={() => slideTile(tile)}>{tile}</button>;
          })}
        </SlidingBoard>
      </div>}
    </main>}
    {phase === 'results' && score && summary && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Result' : '結果'}</p><strong>{summary.completed ? (en ? 'Solved' : '排好了') : (en ? 'Time is up' : '時間到')}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Moves' : '步數'}</p><strong>{summary.moves}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean time per move' : '平均每步時間'}</p><strong>{ms(summary.meanThinkMs)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Taps on tiles that could not move' : '點到不能移動方塊的次數'}</dt><dd>{summary.errors}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Tiles out of place at the end' : '結束時不在位置上的方塊'}</dt><dd>{summary.misplaced}</dd></div>
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
