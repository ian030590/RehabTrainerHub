import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, difficulties, timeLimits, ValidateSettings, type Difficulty, type MemoryMatchSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { MemoryTutorial } from './rules/MemoryTutorial';
import { CreateRandom, memoryConfig, mismatchHoldMs, PairsMatch, type Card, type Outcome } from './logic/memoryMatch';
import { CardBoard, CardFaces, FormatRemaining, MoveCardFocus } from './CardBoard';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Feedback = { kind: 'match' | 'mismatch'; text: string } | null;
const outcomeHoldMs = 1600;
const warningMs = 10000;

export function MemoryMatchGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<MemoryMatchSettings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [score, setScore] = useState<ReturnType<typeof BuildGameScore> | null>(null);
  const [focusCard, setFocusCard] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const matchRef = useRef<PairsMatch | null>(null);
  const startedAtRef = useRef(0);
  const endedAtRef = useRef<number | null>(null);
  const timerRef = useRef(0);
  const limitTimerRef = useRef(0);
  const hideTimerRef = useRef(0);
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
    window.clearTimeout(hideTimerRef.current);
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

  const finish = useCallback((match: PairsMatch) => {
    const result = BuildGameScore(match, (endedAtRef.current ?? performance.now()) - startedAtRef.current);
    jsPsychLifecycleRef.current?.finish({ outcome: match.outcome, moves: result.summary.moves, matchedPairs: result.summary.matchedPairs });
    matchRef.current = null;
    setScore(result);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, result.summary, result.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  // The final board stays on screen briefly so the player sees it before the results.
  const end = useCallback((match: PairsMatch, outcome: Outcome) => {
    endedAtRef.current = performance.now();
    window.clearTimeout(limitTimerRef.current);
    window.clearTimeout(hideTimerRef.current);
    // Pairs still hidden at the time limit end as a loss, as in the original game.
    PlayGameEndSound(outcome === 'Victory' ? 'Victory' : 'Defeat');
    setFeedback(null);
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
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:memory-match', onStart: () => {
      startedAtRef.current = performance.now();
      endedAtRef.current = null;
      const match = new PairsMatch(settings.difficulty, startedAtRef.current, CreateRandom(Date.now()));
      matchRef.current = match;
      setFocusCard(0);
      setFeedback(null);
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
      window.clearTimeout(hideTimerRef.current);
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

  const flipCard = (index: number) => {
    const match = matchRef.current;
    if (phaseRef.current !== 'running' || !match) return;
    const flip = match.flip(index, performance.now());
    if (!flip.accepted) return;
    const value = match.cards[index].value;
    if (flip.result === 'first') setFeedback(null);
    if (flip.result === 'match') setFeedback({ kind: 'match', text: en ? `Pair found: ${value}` : `配對成功：${value}` });
    // The final pair plays only the end sound.
    if (flip.result === 'match' && !flip.solved) PlaySuccessSound();
    if (flip.result === 'mismatch') PlayFailureSound();
    if (flip.result === 'mismatch') {
      const other = match.cards[match.open[0]].value;
      setFeedback({ kind: 'mismatch', text: en ? `Not a pair: ${other} and ${value}` : `不是一對：${other} 和 ${value}` });
      const generation = generationRef.current;
      hideTimerRef.current = window.setTimeout(() => {
        if (generation !== generationRef.current || matchRef.current !== match || match.outcome) return;
        if (match.hideMismatch(performance.now())) setVersion(version => version + 1);
      }, mismatchHoldMs);
    }
    setVersion(version => version + 1);
    if (flip.solved) end(match, 'Victory');
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
    const { rows, cols, pairs } = memoryConfig[difficulty];
    return en ? `${rows} × ${cols} / ${pairs} pairs` : `${rows} × ${cols}／${pairs} 對`;
  };
  const limitLabel = (value: number) => value === 0 ? (en ? 'No limit' : '不限時') : en ? `${value / 60} minute${value === 60 ? '' : 's'}` : `${value / 60} 分鐘`;
  const onOff = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Cards and pairs' : '卡片與配對數', value: boardLabel(settings.difficulty) },
    { label: en ? 'Time limit' : '時間限制', value: limitLabel(settings.timeLimitSec) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: onOff(settings.soundEnabled) },
  ];
  const seconds = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${value.toFixed(1)} ${en ? 's' : '秒'}`;
  const ms = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${(value / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
  const outcomeLabel = (match: PairsMatch) => match.outcome === 'Victory' ? (en ? 'Every pair is found' : '全部配對完成')
    : en ? `Time is up: ${match.matchedPairs} of ${match.pairs} pairs found` : `時間到，找到 ${match.matchedPairs} / ${match.pairs} 對`;
  const match = matchRef.current;
  const cardLabel = (index: number, card: Card, cols: number) => {
    const position = en ? `Row ${Math.floor(index / cols) + 1}, column ${index % cols + 1}` : `第 ${Math.floor(index / cols) + 1} 列第 ${index % cols + 1} 欄`;
    const face = !card.faceUp ? (en ? 'face down' : '背面') : card.matched ? (en ? `${card.value}, matched` : `${card.value}，已配對`) : card.value;
    return `${position}${en ? ', ' : '，'}${face}`;
  };
  const summary = score?.summary;
  return <div ref={rootRef} className="memory-match-game-root">
    <div ref={jsPsychHostRef} className="mm-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <MemoryTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog memory-match-phase-menu" aria-labelledby="mm-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="mm-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Cards and pairs' : '卡片與配對數'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(difficulty => <option key={difficulty} value={difficulty}>{boardLabel(difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'More cards mean more places to remember.' : '卡片越多，要記住的位置越多。'}</small></label>
            <label>{en ? 'Time limit' : '時間限制'}<select name="timeLimitSec" value={settings.timeLimitSec}
              onChange={event => setSettings({ ...settings, timeLimitSec: Number(event.target.value) })}>
              {timeLimits.map(value => <option key={value} value={value}>{limitLabel(value)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'If pairs are still hidden when time runs out, the game ends.' : '時間到時還有卡片沒配對，這局就結束。'}</small></label>
            <label className="mm-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{en ? 'A short sound for each pair found or missed, and when the game ends.' : '配對成功、配錯與結束時播放提示音。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="mm-stage mm-running" aria-label={title}>
      <header className="mm-hud">
        <p className="mm-pairs">{en ? 'Pairs' : '配對'} <strong>{match?.matchedPairs ?? 0} / {match?.pairs ?? 0}</strong></p>
        <p className="mm-moves">{en ? 'Moves' : '步數'} {match?.moves ?? 0}</p>
        <p ref={clockRef} className="mm-clock">{settings.timeLimitSec ? FormatRemaining(settings.timeLimitSec * 1000, en) : `0.0 ${en ? 's' : '秒'}`}</p>
        <button type="button" className="btn btn-ghost mm-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className={`mm-feedback${match?.outcome ? ' mm-outcome' : ''}`} role="status" data-kind={match?.outcome ? undefined : feedback?.kind}>
        {match?.outcome ? outcomeLabel(match) : feedback?.text ?? ''}</p>
      {match && <div className="mm-board-slot">
        <CardBoard rows={match.rows} cols={match.cols} state={match.outcome ? 'over' : 'running'} label={en ? 'Cards' : '卡片'}
          onKeyDown={event => MoveCardFocus(event, match.rows, match.cols)}>
          {match.cards.map((card, index) => <button type="button" key={index} className="mm-card" data-index={index}
            data-state={card.matched ? 'matched' : card.faceUp ? 'up' : 'down'} data-wrong={match.waiting && match.open.includes(index) ? 'true' : undefined}
            tabIndex={index === focusCard ? 0 : -1} onFocus={() => setFocusCard(index)}
            aria-label={cardLabel(index, card, match.cols)} onClick={() => flipCard(index)}><CardFaces value={card.value} /></button>)}
        </CardBoard>
      </div>}
    </main>}
    {phase === 'results' && score && summary && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Result' : '結果'}</p><strong>{summary.completed ? (en ? 'All pairs found' : '全部配對') : (en ? 'Time is up' : '時間到')}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Moves' : '步數'}</p><strong>{summary.moves}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Wrong pairs' : '配錯次數'}</p><strong>{summary.errors}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Pairs found' : '找到的配對'}</dt><dd>{summary.matchedPairs} / {summary.pairs}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time per move' : '平均每步時間'}</dt><dd>{ms(summary.meanThinkMs)}</dd></div>
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
