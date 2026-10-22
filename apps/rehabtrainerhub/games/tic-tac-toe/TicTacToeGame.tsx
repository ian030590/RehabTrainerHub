import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, difficulties, ValidateSettings, type Difficulty, type TicTacToeSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { TicTacToeTutorial } from './rules/TicTacToeTutorial';
import { boardSpecs, CreateRandom, TicTacToeMatch, type Outcome } from './logic/ticTacToe';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
const computerDelayMs = 1000;
const outcomeHoldMs = 1600;

export function TicTacToeGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<TicTacToeSettings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [score, setScore] = useState<ReturnType<typeof BuildGameScore> | null>(null);
  const [filledTap, setFilledTap] = useState(false);
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const matchRef = useRef<TicTacToeMatch | null>(null);
  const startedAtRef = useRef(0);
  const endedAtRef = useRef<number | null>(null);
  const timerRef = useRef(0);
  const randomRef = useRef(CreateRandom(Date.now()));
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

  const finish = useCallback((match: TicTacToeMatch) => {
    const result = BuildGameScore(match, (endedAtRef.current ?? performance.now()) - startedAtRef.current);
    jsPsychLifecycleRef.current?.finish({ outcome: match.outcome, moves: result.summary.moves, errors: result.summary.errors });
    matchRef.current = null;
    setScore(result);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, result.summary, result.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  // The final board stays on screen briefly so the player sees the line or the full board before the results.
  const end = useCallback((match: TicTacToeMatch, outcome: Outcome) => {
    endedAtRef.current = performance.now();
    PlayGameEndSound(outcome);
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
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:tic-tac-toe', onStart: () => {
      startedAtRef.current = performance.now();
      endedAtRef.current = null;
      randomRef.current = CreateRandom(Date.now());
      matchRef.current = new TicTacToeMatch(settings.difficulty, startedAtRef.current);
      setFilledTap(false);
      setVersion(version => version + 1);
    } });
    return () => {
      matchRef.current = null;
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings.difficulty]);
  // The visible clock reads the match start time, so it never drifts from the recorded duration.
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => {
      if (clockRef.current && matchRef.current && endedAtRef.current === null) {
        clockRef.current.textContent = `${((performance.now() - startedAtRef.current) / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, en]);

  const tapCell = (index: number) => {
    const match = matchRef.current;
    if (phaseRef.current !== 'running' || !match || match.turn !== 'player') return;
    const outcome = match.play(index, performance.now());
    if (!outcome.accepted) {
      PlayFailureSound();
      setFilledTap(true);
      setVersion(version => version + 1);
      return;
    }
    setFilledTap(false);
    setVersion(version => version + 1);
    if (outcome.outcome) { end(match, outcome.outcome); return; }
    const generation = generationRef.current;
    timerRef.current = window.setTimeout(() => {
      if (generation !== generationRef.current || matchRef.current !== match) return;
      const reply = match.computerTurn(randomRef.current, performance.now());
      setVersion(version => version + 1);
      if (reply.outcome) end(match, reply.outcome);
    }, computerDelayMs);
  };
  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const size = matchRef.current?.size ?? boardSpecs[settings.difficulty].size;
    const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size } as Record<string, number>)[event.key];
    if (!delta) return;
    const cells = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const index = cells.indexOf(document.activeElement as HTMLButtonElement);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= cells.length) return;
    if (Math.abs(delta) === 1 && Math.floor(target / size) !== Math.floor(index / size)) return;
    event.preventDefault();
    cells[target].focus();
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
    const { size, winLength } = boardSpecs[difficulty];
    return en ? `${size} × ${size}, ${winLength} in a row` : `${size} × ${size}，連 ${winLength} 個`;
  };
  const onOff = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Board and line' : '棋盤與連線規則', value: boardLabel(settings.difficulty) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: onOff(settings.soundEnabled) },
  ];
  const seconds = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${value.toFixed(1)} ${en ? 's' : '秒'}`;
  const ms = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${(value / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
  const outcomeLabel = (outcome: Outcome | null) => outcome === 'Victory' ? (en ? 'You made a line' : '你連成一線')
    : outcome === 'Defeat' ? (en ? 'The computer made a line' : '電腦連成一線') : (en ? 'Draw: the board is full' : '平手，棋盤已下滿');
  const match = matchRef.current;
  const cellLabel = (index: number, size: number, mark: string | null) => {
    const position = en ? `Row ${Math.floor(index / size) + 1}, column ${index % size + 1}` : `第 ${Math.floor(index / size) + 1} 列第 ${index % size + 1} 欄`;
    return `${position}${en ? ', ' : '，'}${mark ?? (en ? 'empty' : '空格')}`;
  };
  const summary = score?.summary;
  const outcome: Outcome | null = summary ? (summary.completed ? 'Victory' : summary.draw ? 'Draw' : 'Defeat') : null;
  return <div ref={rootRef} className="tic-tac-toe-game-root">
    <div ref={jsPsychHostRef} className="ttt-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <TicTacToeTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog tic-tac-toe-phase-menu" aria-labelledby="ttt-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="ttt-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Board and line' : '棋盤與連線規則'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(difficulty => <option key={difficulty} value={difficulty}>{boardLabel(difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'A bigger board and a longer line ask you to plan further ahead.' : '棋盤越大、要連的越長，需要想得越遠。'}</small></label>
            <label className="ttt-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{en ? 'A short sound for a tap on a filled cell and at the end of the game.' : '點到已有棋子的格子與棋局結束時播放提示音。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="ttt-stage ttt-running" aria-label={title}>
      <header className="ttt-hud">
        <p className="ttt-goal">{en ? <><strong>{match?.winLength ?? boardSpecs[settings.difficulty].winLength}</strong> in a row wins</>
          : <>連成 <strong>{match?.winLength ?? boardSpecs[settings.difficulty].winLength}</strong> 個獲勝</>}</p>
        <p className="ttt-turn" role="status" data-turn={match?.turn ?? 'player'}>{!match || match.turn === 'player' ? (en ? 'Your turn (X)' : '輪到你（X）')
          : match.turn === 'computer' ? (en ? 'Computer is thinking (O)' : '電腦思考中（O）') : (en ? 'Game over' : '棋局結束')}</p>
        <p ref={clockRef} className="ttt-clock">0.0 {en ? 's' : '秒'}</p>
        <button type="button" className="btn btn-ghost ttt-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className={`ttt-feedback${match?.outcome ? ' ttt-outcome' : ''}`} role="status" data-outcome={match?.outcome ?? undefined}>
        {match?.outcome ? outcomeLabel(match.outcome) : filledTap ? (en ? 'That cell already has a mark. Choose an empty one.' : '這格已經有棋子，請選空格。') : ''}</p>
      {match && <div className="ttt-board-area">
        <div className="ttt-board" style={{ '--board-size': match.size } as CSSProperties} data-turn={match.turn} onKeyDown={moveFocus}
          role="group" aria-label={en ? 'Game board' : '棋盤'}>
          {match.board.map((mark, index) => <button type="button" key={index} className="ttt-cell" data-index={index} data-mark={mark ?? undefined}
            data-line={match.line?.includes(index) ? 'true' : undefined} aria-label={cellLabel(index, match.size, mark)}
            onClick={() => tapCell(index)}>{mark}</button>)}
        </div>
      </div>}
    </main>}
    {phase === 'results' && score && summary && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Result' : '結果'}</p><strong>{outcome === 'Victory' ? (en ? 'You won' : '勝利') : outcome === 'Draw' ? (en ? 'Draw' : '平手') : (en ? 'Computer won' : '電腦獲勝')}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Your moves' : '你下的步數'}</p><strong>{summary.moves}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean time per move' : '平均每步思考時間'}</p><strong>{ms(summary.meanThinkMs)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Taps on filled cells' : '點到已有棋子的次數'}</dt><dd>{summary.errors}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Computer moves' : '電腦步數'}</dt><dd>{summary.opponentMoves}</dd></div>
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
