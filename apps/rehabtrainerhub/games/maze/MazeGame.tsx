import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, difficulties, timeLimits, ValidateSettings, type Difficulty, type MazeSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { MazeTutorial } from './rules/MazeTutorial';
import { CreateMaze, CreateRandom, MazeMatch, MazeSignature, mazeSizes, OpenDirections, type Direction, type Outcome } from './logic/maze';
import { FormatRemaining, MazeBoard } from './MazeBoard';
import { DirectionPad } from './DirectionPad';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Attempt = (match: MazeMatch, now: number) => { accepted: boolean; reached: boolean };
const outcomeHoldMs = 1600;
const warningMs = 10000;
const arrowDirections: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

export function MazeGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<MazeSettings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [score, setScore] = useState<ReturnType<typeof BuildGameScore> | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const matchRef = useRef<MazeMatch | null>(null);
  const randomRef = useRef(CreateRandom(Date.now()));
  const lastMazeRef = useRef<Partial<Record<Difficulty, string>>>({});
  const attemptRef = useRef<(attempt: Attempt) => void>(() => undefined);
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
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      const direction = arrowDirections[event.key];
      if (direction) { event.preventDefault(); attemptRef.current((match, now) => match.move(direction, now)); }
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

  const finish = useCallback((match: MazeMatch) => {
    const result = BuildGameScore(match, (endedAtRef.current ?? performance.now()) - startedAtRef.current);
    jsPsychLifecycleRef.current?.finish({ outcome: match.outcome, moves: result.summary.moves, errors: result.summary.errors, distanceLeft: result.summary.distanceLeft });
    matchRef.current = null;
    setScore(result);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, result.summary, result.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  // The final board stays on screen briefly so the player sees it before the results.
  const end = useCallback((match: MazeMatch, outcome: Outcome) => {
    endedAtRef.current = performance.now();
    window.clearTimeout(limitTimerRef.current);
    // A run that has not reached the goal at the time limit ends as a loss, as in the original game.
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
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:maze', onStart: () => {
      startedAtRef.current = performance.now();
      endedAtRef.current = null;
      randomRef.current = CreateRandom(Date.now());
      const maze = CreateMaze(mazeSizes[settings.difficulty], randomRef.current, lastMazeRef.current[settings.difficulty]);
      lastMazeRef.current[settings.difficulty] = MazeSignature(maze);
      const match = new MazeMatch(maze, startedAtRef.current);
      matchRef.current = match;
      setBlocked(false);
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

  // Arrow keys, the direction pad and taps all go through here, so each counts and sounds the same way.
  const attempt = (move: Attempt) => {
    const match = matchRef.current;
    if (phaseRef.current !== 'running' || !match || match.outcome) return;
    const errorsBefore = match.errors;
    const result = move(match, performance.now());
    if (!result.accepted) {
      if (match.errors > errorsBefore) {
        PlayFailureSound();
        setBlocked(true);
        setVersion(version => version + 1);
      }
      return;
    }
    setBlocked(false);
    setVersion(version => version + 1);
    if (result.reached) end(match, 'Victory');
    else PlaySuccessSound();
  };
  attemptRef.current = attempt;

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

  const sizeLabel = (difficulty: Difficulty) => `${mazeSizes[difficulty]} × ${mazeSizes[difficulty]}`;
  const limitLabel = (value: number) => value === 0 ? (en ? 'No limit' : '不限時') : en ? `${value / 60} minute${value === 60 ? '' : 's'}` : `${value / 60} 分鐘`;
  const onOff = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Maze size' : '迷宮大小', value: sizeLabel(settings.difficulty) },
    { label: en ? 'Time limit' : '時間限制', value: limitLabel(settings.timeLimitSec) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: onOff(settings.soundEnabled) },
  ];
  const seconds = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${value.toFixed(1)} ${en ? 's' : '秒'}`;
  const ms = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${(value / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
  const stepsText = (count: number) => en ? `${count} step${count === 1 ? '' : 's'}` : `${count} 步`;
  const outcomeLabel = (match: MazeMatch) => match.outcome === 'Victory' ? (en ? 'You reached the goal' : '你走到終點了')
    : en ? `Time is up: ${stepsText(match.distanceLeft)} from the goal` : `時間到，離終點還有 ${stepsText(match.distanceLeft)}`;
  const directionNames: Record<Direction, string> = en ? { up: 'up', down: 'down', left: 'left', right: 'right' } : { up: '上', down: '下', left: '左', right: '右' };
  const match = matchRef.current;
  // Screen readers hear where you are and which ways are open after each move.
  const positionText = (current: MazeMatch) => {
    const [row, col] = [Math.floor(current.current / current.size) + 1, current.current % current.size + 1];
    const open = OpenDirections(current.cells, current.size, current.current).map(direction => directionNames[direction]);
    return en ? `Row ${row}, column ${col}. Open: ${open.join(', ')}.` : `第 ${row} 列第 ${col} 欄，可往：${open.join('、')}。`;
  };
  const summary = score?.summary;
  return <div ref={rootRef} className="maze-game-root">
    <div ref={jsPsychHostRef} className="mz-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <MazeTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog maze-phase-menu" aria-labelledby="mz-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="mz-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Maze size' : '迷宮大小'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(difficulty => <option key={difficulty} value={difficulty}>{sizeLabel(difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'Every game draws a new maze. A bigger maze has a longer route and more dead ends.' : '每局都會產生新的迷宮；迷宮越大，路線越長、死路越多。'}</small></label>
            <label>{en ? 'Time limit' : '時間限制'}<select name="timeLimitSec" value={settings.timeLimitSec}
              onChange={event => setSettings({ ...settings, timeLimitSec: Number(event.target.value) })}>
              {timeLimits.map(value => <option key={value} value={value}>{limitLabel(value)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'If you have not reached the goal when time runs out, the game ends.' : '時間到時還沒走到終點，這局就結束。'}</small></label>
            <label className="mz-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{en ? 'A short sound for each step, for a blocked move and at the end of the game.' : '每走一步、走不通時與結束時播放提示音。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="mz-stage mz-running" aria-label={title}>
      <header className="mz-hud">
        <p className="mz-hint"><span className="mz-goal-icon" />{en ? 'Reach the green goal' : '走到綠色終點'}</p>
        <p className="mz-moves">{en ? 'Moves' : '步數'} {match?.moves ?? 0}</p>
        <p ref={clockRef} className="mz-clock">{settings.timeLimitSec ? FormatRemaining(settings.timeLimitSec * 1000, en) : `0.0 ${en ? 's' : '秒'}`}</p>
        <button type="button" className="btn btn-ghost mz-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className={`mz-feedback${match?.outcome ? ' mz-outcome' : ''}`} role="status" data-outcome={match?.outcome ?? undefined}>
        {match?.outcome ? outcomeLabel(match) : blocked ? (en ? 'You can\'t go that way: a wall is in the way, or that cell does not touch yours.' : '這一步走不通：有牆擋住，或那格不在你旁邊。') : ''}</p>
      {match && <div className="mz-play">
        <MazeBoard maze={match} current={match.current} state={match.outcome ? 'over' : 'running'} label={en ? 'Maze' : '迷宮'}
          onTap={index => attempt((current, now) => current.tap(index, now))} />
        <DirectionPad en={en} onMove={direction => attempt((current, now) => current.move(direction, now))} />
        <p className="mz-sr" role="status">{positionText(match)}</p>
      </div>}
    </main>}
    {phase === 'results' && score && summary && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Result' : '結果'}</p><strong>{summary.completed ? (en ? 'Reached the goal' : '到達終點') : (en ? 'Time is up' : '時間到')}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Moves' : '步數'}</p><strong>{summary.moves}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean time per move' : '平均每步時間'}</p><strong>{ms(summary.meanThinkMs)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Blocked moves' : '走不通的次數'}</dt><dd>{summary.errors}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Shortest route' : '最短路線步數'}</dt><dd>{summary.shortestPath}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Steps from the goal at the end' : '結束時離終點步數'}</dt><dd>{summary.distanceLeft}</dd></div>
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
