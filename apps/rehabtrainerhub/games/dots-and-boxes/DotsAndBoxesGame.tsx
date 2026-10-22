import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, difficulties, ValidateSettings, type DotsAndBoxesSettings, type Difficulty } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { DotsTutorial } from './rules/DotsTutorial';
import { boardDots, CreateRandom, DotsMatch, type Outcome, type Owner } from './logic/dotsAndBoxes';
import { DotsBoard, LinePosition, MoveLineFocus } from './DotsBoard';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Feedback = { kind: 'drawn' } | { kind: 'claimed'; boxes: number } | null;
const computerDelayMs = 1000;
const outcomeHoldMs = 1600;

export function DotsAndBoxesGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<DotsAndBoxesSettings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [score, setScore] = useState<ReturnType<typeof BuildGameScore> | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [focusLine, setFocusLine] = useState('h0');
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const matchRef = useRef<DotsMatch | null>(null);
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

  const finish = useCallback((match: DotsMatch) => {
    const result = BuildGameScore(match, (endedAtRef.current ?? performance.now()) - startedAtRef.current);
    jsPsychLifecycleRef.current?.finish({ outcome: match.outcome, moves: result.summary.moves, errors: result.summary.errors });
    matchRef.current = null;
    setScore(result);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, result.summary, result.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  // The final board stays on screen briefly so the player sees the last boxes before the results.
  const end = useCallback((match: DotsMatch, outcome: Outcome) => {
    endedAtRef.current = performance.now();
    PlayGameEndSound(outcome);
    setVersion(version => version + 1);
    const generation = generationRef.current;
    timerRef.current = window.setTimeout(() => { if (generation === generationRef.current) finish(match); }, outcomeHoldMs);
  }, [finish]);
  // The computer keeps drawing, one line per second, for as long as each line closes a box.
  const scheduleComputer = (match: DotsMatch) => {
    const generation = generationRef.current;
    timerRef.current = window.setTimeout(() => {
      if (generation !== generationRef.current || matchRef.current !== match) return;
      const reply = match.computerTurn(randomRef.current, performance.now());
      setVersion(version => version + 1);
      if (reply.outcome) end(match, reply.outcome);
      else if (match.turn === 'computer') scheduleComputer(match);
    }, computerDelayMs);
  };
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:dots-and-boxes', onStart: () => {
      startedAtRef.current = performance.now();
      endedAtRef.current = null;
      randomRef.current = CreateRandom(Date.now());
      matchRef.current = new DotsMatch(settings.difficulty, startedAtRef.current);
      setFeedback(null);
      setFocusLine('h0');
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

  const drawLine = (line: string) => {
    const match = matchRef.current;
    if (phaseRef.current !== 'running' || !match || match.turn !== 'player') return;
    const move = match.play(line, performance.now());
    if (!move.accepted) {
      PlayFailureSound();
      setFeedback({ kind: 'drawn' });
      setVersion(version => version + 1);
      return;
    }
    setFeedback(move.claimed ? { kind: 'claimed', boxes: move.claimed } : null);
    setVersion(version => version + 1);
    if (move.outcome) end(match, move.outcome);
    else if (!move.claimed) scheduleComputer(match);
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

  const sizeLabel = (difficulty: Difficulty) => {
    const dots = boardDots[difficulty];
    return en ? `${dots} × ${dots} dots (${(dots - 1) ** 2} boxes)` : `${dots} × ${dots} 點（${(dots - 1) ** 2} 格）`;
  };
  const onOff = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Board size' : '棋盤大小', value: sizeLabel(settings.difficulty) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: onOff(settings.soundEnabled) },
  ];
  const seconds = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${value.toFixed(1)} ${en ? 's' : '秒'}`;
  const ms = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${(value / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
  const outcomeLabel = (outcome: Outcome) => outcome === 'Victory' ? (en ? 'Every line is drawn: you have more boxes' : '線都畫完了，你的方格比較多')
    : outcome === 'Defeat' ? (en ? 'Every line is drawn: the computer has more boxes' : '線都畫完了，電腦的方格比較多') : (en ? 'Every line is drawn: a tie' : '線都畫完了，雙方方格一樣多');
  const match = matchRef.current;
  const lineLabel = (size: number) => (line: string, owner: Owner | null) => {
    const { row, col } = LinePosition(size, line);
    const where = line[0] === 'h'
      ? (en ? `Across, row ${row + 1}, between dots ${col + 1} and ${col + 2}` : `橫線，第 ${row + 1} 排，第 ${col + 1} 與第 ${col + 2} 點之間`)
      : (en ? `Down, column ${col + 1}, between dots ${row + 1} and ${row + 2}` : `直線，第 ${col + 1} 行，第 ${row + 1} 與第 ${row + 2} 點之間`);
    const state = owner === 'P' ? (en ? 'drawn by you' : '你畫的') : owner === 'A' ? (en ? 'drawn by the computer' : '電腦畫的') : (en ? 'open' : '未畫');
    return `${where}${en ? ', ' : '，'}${state}`;
  };
  const feedbackText = match?.outcome ? outcomeLabel(match.outcome)
    : feedback?.kind === 'drawn' ? (en ? 'That line is already drawn. Choose another one.' : '這條線已經畫過，請選其他線。')
      : feedback?.kind === 'claimed' && match?.turn === 'player' ? (en ? `You closed ${feedback.boxes === 1 ? 'a box' : `${feedback.boxes} boxes`}. Draw another line.` : `你完成了 ${feedback.boxes} 個方格，請再畫一條線。`) : '';
  const summary = score?.summary;
  return <div ref={rootRef} className="dots-and-boxes-game-root">
    <div ref={jsPsychHostRef} className="db-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <DotsTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog dots-and-boxes-phase-menu" aria-labelledby="db-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="db-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Board size' : '棋盤大小'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(difficulty => <option key={difficulty} value={difficulty}>{sizeLabel(difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'More boxes make a longer game with more lines to plan.' : '方格越多，棋局越長，要考慮的線也越多。'}</small></label>
            <label className="db-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{en ? 'A short sound for a tap on a drawn line and at the end of the game.' : '點到已畫的線與棋局結束時播放提示音。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="db-stage db-running" aria-label={title}>
      <header className="db-hud">
        <p className="db-score"><span className="db-score-side"><span className="db-mark-icon" data-owner="P" />{en ? 'You' : '你'} <strong>{match?.playerBoxes ?? 0}</strong></span>
          <span className="db-score-side"><span className="db-mark-icon" data-owner="A" />{en ? 'Computer' : '電腦'} <strong>{match?.opponentBoxes ?? 0}</strong></span></p>
        <p className="db-turn" role="status" data-turn={match?.turn ?? 'player'}>{!match || match.turn === 'player' ? (en ? 'Your turn' : '輪到你')
          : match.turn === 'computer' ? (en ? 'Computer is drawing' : '電腦畫線中') : (en ? 'Game over' : '棋局結束')}</p>
        <p ref={clockRef} className="db-clock">0.0 {en ? 's' : '秒'}</p>
        <button type="button" className="btn btn-ghost db-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className={`db-feedback${match?.outcome ? ' db-outcome' : feedback?.kind === 'claimed' ? ' db-claimed' : ''}`} role="status"
        data-outcome={match?.outcome ?? undefined}>{feedbackText}</p>
      {match && <div className="db-board-slot">
        <DotsBoard size={match.size} hLines={match.hLines} vLines={match.vLines} boxes={match.boxes} turn={match.turn}
          label={en ? 'Game board' : '棋盤'} focusLine={focusLine} ownerLabel={lineLabel(match.size)}
          onLine={drawLine} onFocusLine={setFocusLine} onKeyDown={event => MoveLineFocus(event, match.size)} />
      </div>}
    </main>}
    {phase === 'results' && score && summary && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Result' : '結果'}</p><strong>{summary.completed ? (en ? 'You won' : '勝利') : summary.draw ? (en ? 'Draw' : '平手') : (en ? 'Computer won' : '電腦獲勝')}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Boxes (you : computer)' : '方格（你：電腦）'}</p><strong>{summary.playerBoxes} : {summary.opponentBoxes}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean time per line' : '平均每條線思考時間'}</p><strong>{ms(summary.meanThinkMs)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Lines you drew' : '你畫的線'}</dt><dd>{summary.moves}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Lines the computer drew' : '電腦畫的線'}</dt><dd>{summary.opponentMoves}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Taps on drawn lines' : '點到已畫線的次數'}</dt><dd>{summary.errors}</dd></div>
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
