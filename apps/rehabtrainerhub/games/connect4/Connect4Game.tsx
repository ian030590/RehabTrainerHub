import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, difficulties, ValidateSettings, type Connect4Settings, type Difficulty } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { Connect4Tutorial } from './rules/Connect4Tutorial';
import { boardCols, boardRows, Connect4Match, CreateRandom, type Outcome, type Slot } from './logic/connect4';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
const computerDelayMs = 1000;
const outcomeHoldMs = 1800;

export function Connect4Game() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<Connect4Settings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [score, setScore] = useState<ReturnType<typeof BuildGameScore> | null>(null);
  const [fullTap, setFullTap] = useState(false);
  const [lastDrop, setLastDrop] = useState<number | null>(null);
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const matchRef = useRef<Connect4Match | null>(null);
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

  const finish = useCallback((match: Connect4Match) => {
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
  const end = useCallback((match: Connect4Match, outcome: Outcome) => {
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
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:connect4', onStart: () => {
      startedAtRef.current = performance.now();
      endedAtRef.current = null;
      randomRef.current = CreateRandom(Date.now());
      matchRef.current = new Connect4Match(settings.difficulty, startedAtRef.current);
      setFullTap(false);
      setLastDrop(null);
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

  const dropInColumn = (col: number) => {
    const match = matchRef.current;
    if (phaseRef.current !== 'running' || !match || match.turn !== 'player') return;
    const move = match.play(col, performance.now());
    if (!move.accepted) {
      PlayFailureSound();
      setFullTap(true);
      setVersion(version => version + 1);
      return;
    }
    setFullTap(false);
    setLastDrop(move.index);
    setVersion(version => version + 1);
    if (move.outcome) { end(match, move.outcome); return; }
    const generation = generationRef.current;
    timerRef.current = window.setTimeout(() => {
      if (generation !== generationRef.current || matchRef.current !== match) return;
      const reply = match.computerTurn(randomRef.current, performance.now());
      setLastDrop(reply.index);
      setVersion(version => version + 1);
      if (reply.outcome) end(match, reply.outcome);
    }, computerDelayMs);
  };
  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const delta = ({ ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>)[event.key];
    if (!delta) return;
    const columns = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const index = columns.indexOf(document.activeElement as HTMLButtonElement);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= columns.length) return;
    event.preventDefault();
    columns[target].focus();
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

  const strategyLabel = (difficulty: Difficulty) => ({
    easy: en ? 'Any open column' : '隨機落子',
    medium: en ? 'Wins when it can, otherwise any column' : '能贏就先贏，否則隨機',
    hard: en ? 'Wins when it can, then blocks you, otherwise any column' : '能贏就先贏，再擋你，否則隨機',
  })[difficulty];
  const onOff = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Computer strategy' : '電腦策略', value: strategyLabel(settings.difficulty) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: onOff(settings.soundEnabled) },
  ];
  const seconds = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${value.toFixed(1)} ${en ? 's' : '秒'}`;
  const ms = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${(value / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
  const outcomeLabel = (outcome: Outcome) => outcome === 'Victory' ? (en ? 'You made four in a row' : '你連成四個')
    : outcome === 'Defeat' ? (en ? 'The computer made four in a row' : '電腦連成四個') : (en ? 'Draw: the board is full' : '平手，棋盤已下滿');
  const match = matchRef.current;
  const columnLabel = (board: Slot[], col: number) => {
    const discs = Array.from({ length: boardRows }, (_, step) => board[(boardRows - 1 - step) * boardCols + col]).filter(Boolean);
    const open = boardRows - discs.length;
    const owners = discs.map(mark => mark === 'P' ? (en ? 'you' : '你') : (en ? 'computer' : '電腦')).join(en ? ', ' : '、');
    const filled = discs.length ? (en ? `, from the bottom: ${owners}` : `，由下往上：${owners}`) : '';
    const space = open ? (en ? `, ${open} open` : `，還有 ${open} 個空位`) : (en ? ', full' : '，已滿');
    return `${en ? `Column ${col + 1}` : `第 ${col + 1} 欄`}${filled}${space}`;
  };
  const summary = score?.summary;
  const outcome: Outcome | null = summary ? (summary.completed ? 'Victory' : summary.draw ? 'Draw' : 'Defeat') : null;
  return <div ref={rootRef} className="connect4-game-root">
    <div ref={jsPsychHostRef} className="c4-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <Connect4Tutorial active={phase === 'rules'} ready title={title}
      summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog connect4-phase-menu" aria-labelledby="c4-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="c4-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Computer strategy' : '電腦策略'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(difficulty => <option key={difficulty} value={difficulty}>{strategyLabel(difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'A computer that blocks asks you to think further ahead.' : '電腦會擋你時，需要想得更遠。'}</small></label>
            <label className="c4-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{en ? 'A short sound for a tap on a full column and at the end of the game.' : '點到已滿的欄位與棋局結束時播放提示音。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="c4-stage c4-running" aria-label={title}>
      <header className="c4-hud">
        <p className="c4-goal">{en ? <><strong>4</strong> in a row wins</> : <>連成 <strong>4</strong> 個獲勝</>}</p>
        <p className="c4-turn" role="status" data-turn={match?.turn ?? 'player'}>
          {match?.turn !== 'over' && <span className="c4-disc-icon" data-mark={match?.turn === 'computer' ? 'A' : 'P'} />}
          {!match || match.turn === 'player' ? (en ? 'Your turn' : '輪到你')
            : match.turn === 'computer' ? (en ? 'Computer is thinking' : '電腦思考中') : (en ? 'Game over' : '棋局結束')}</p>
        <p ref={clockRef} className="c4-clock">0.0 {en ? 's' : '秒'}</p>
        <button type="button" className="btn btn-ghost c4-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className={`c4-feedback${match?.outcome ? ' c4-outcome' : ''}`} role="status" data-outcome={match?.outcome ?? undefined}>
        {match?.outcome ? outcomeLabel(match.outcome) : fullTap ? (en ? 'That column is full. Choose another one.' : '這一欄已滿，請選其他欄。') : ''}</p>
      {match && <div className="c4-board-area">
        <div className="c4-board" data-turn={match.turn} onKeyDown={moveFocus} role="group" aria-label={en ? 'Game board' : '棋盤'}>
          {Array.from({ length: boardCols }, (_, col) => <button type="button" key={col} className="c4-column" data-col={col}
            aria-label={columnLabel(match.board, col)} onClick={() => dropInColumn(col)}>
            {Array.from({ length: boardRows }, (_, row) => {
              const index = row * boardCols + col;
              return <span key={index} className="c4-slot" data-index={index} data-mark={match.board[index] ?? undefined}
                data-line={match.line?.includes(index) ? 'true' : undefined} data-drop={lastDrop === index ? 'true' : undefined}
                style={lastDrop === index ? { '--fall': row + 1 } as CSSProperties : undefined} />;
            })}
          </button>)}
        </div>
      </div>}
    </main>}
    {phase === 'results' && score && summary && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Result' : '結果'}</p><strong>{outcome === 'Victory' ? (en ? 'You won' : '勝利') : outcome === 'Draw' ? (en ? 'Draw' : '平手') : (en ? 'Computer won' : '電腦獲勝')}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Discs you dropped' : '你投入的棋子數'}</p><strong>{summary.moves}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean time per move' : '平均每步思考時間'}</p><strong>{ms(summary.meanThinkMs)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Taps on full columns' : '點到已滿欄位的次數'}</dt><dd>{summary.errors}</dd></div>
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
