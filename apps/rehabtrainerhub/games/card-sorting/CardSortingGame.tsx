import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, rangeSettings, ValidateSettings, type SortingSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { SortingTutorial } from './rules/SortingTutorial';
import { CardSorting, colors, CreateCardDeck, CreateRandom, keyCards, shapes, type Card, type SortRow } from './logic/cardSorting';
import { CardFace, DescribeCard } from './CardFace';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';
import { PauseClock } from './logic/pauseClock';

type Phase = 'menu' | 'rules' | 'running' | 'results';

const feedbackMs = 900;

export function CardSortingGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  const [paused, setPaused] = useState(false);
  const [fullscreenInterrupted, setFullscreenInterrupted] = useState(false);
  const endingRef = useRef(false);
  const pausedRef = useRef(false);
  const pauseClockRef = useRef<PauseClock | null>(null);
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
  const [settings, setSettings] = useState<SortingSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<SortRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [deck, setDeck] = useState<Card[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; chosen: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const sortingRef = useRef<CardSorting | null>(null);
  const rowsRef = useRef<SortRow[]>([]);
  const shownAtRef = useRef(0);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<PauseClock['set']>>(null);
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopRuntime = useCallback(() => {
    endingRef.current = true;
    pausedRef.current = false;
    setPaused(false);
    pauseClockRef.current?.stop();
    pauseClockRef.current = null;
    generationRef.current++;
    sortingRef.current = null;
    busyRef.current = false;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const pause = useCallback(() => {
    if (pausedRef.current) return;
    setFullscreenInterrupted(false);
    pausedRef.current = true;
    pauseClockRef.current?.pause();
    DisposeAudioFeedback();
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    restoreStopRef.current = true;
    pauseClockRef.current?.resume();
    if (!busyRef.current && pauseClockRef.current) shownAtRef.current = pauseClockRef.current.now();
    setPaused(false);
  }, []);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  const finish = useCallback((completed: SortRow[]) => {
    endingRef.current = true;
    sortingRef.current = null;
    const score = BuildGameScore(completed, settings);
    jsPsychLifecycleRef.current?.finish({ cards: completed.length, categories: score.summary.categoriesCompleted, perseverative_errors: score.summary.perseverativeErrors });
    PlayGameEndSound('Victory');
    setRows(completed);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, score.summary, score.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  const chooseRef = useRef<(keyIndex: number) => void>(() => undefined);
  chooseRef.current = (keyIndex: number) => {
    const sorting = sortingRef.current;
    const card = deck[cardIndex];
    if (phaseRef.current !== 'running' || pausedRef.current || !sorting || !card || busyRef.current) return;
    busyRef.current = true;
    const rule = sorting.ruleCode;
    const category = sorting.categoriesCompleted + 1;
    const outcome = sorting.sort(card, keyIndex);
    rowsRef.current = [...rowsRef.current, { trial: rowsRef.current.length + 1, rule, cardColor: colors.indexOf(card.color),
      cardShape: shapes.indexOf(card.shape), cardCount: card.count, chosen: keyIndex, correct: outcome.correct, perseverative: outcome.perseverative,
      category, rtMs: Math.round(pauseClockRef.current!.now() - shownAtRef.current) }];
    if (outcome.correct) PlaySuccessSound(); else PlayFailureSound();
    setFeedback({ correct: outcome.correct, chosen: keyIndex });
    const generation = generationRef.current;
    timerRef.current = pauseClockRef.current!.set(() => {
      if (generation !== generationRef.current) return;
      busyRef.current = false;
      setFeedback(null);
      if (outcome.finished || cardIndex + 1 >= deck.length) { finish(rowsRef.current); return; }
      shownAtRef.current = pauseClockRef.current!.now();
      setCardIndex(cardIndex + 1);
    }, feedbackMs);
  };
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const fullscreenChanged = () => { if (phaseRef.current === 'running' && !endingRef.current && !document.fullscreenElement) { pause(); setFullscreenInterrupted(true); } };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); if (!event.repeat) { if (pausedRef.current) resume(); else pause(); } return; }
      const keyIndex = ['1', '2', '3', '4'].indexOf(event.key);
      if (keyIndex >= 0) { event.preventDefault(); if (!event.repeat) chooseRef.current(keyIndex); }
    };
    const pagehide = () => { stopRuntime(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('keydown', keys, true);
    window.addEventListener('pagehide', pagehide);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('keydown', keys, true);
      window.removeEventListener('pagehide', pagehide);
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      pagehide();
    };
  }, [pause, resume, stopRuntime]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const clock = new PauseClock({ now: () => performance.now(), set: (callback, ms) => window.setTimeout(callback, ms), clear: timer => window.clearTimeout(timer) });
    pauseClockRef.current = clock;
    if (pausedRef.current) clock.pause();
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:card-sorting', onStart: () => {
      rowsRef.current = [];
      busyRef.current = false;
      sortingRef.current = new CardSorting(settings);
      setDeck(CreateCardDeck(settings.maxCards, CreateRandom(Date.now())));
      setCardIndex(0);
      setFeedback(null);
      shownAtRef.current = clock.now();
    } });
    return () => {
      clock.stop();
      if (pauseClockRef.current === clock) pauseClockRef.current = null;
      sortingRef.current = null;
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings]);

  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings(settings);
    setPhase('rules');
  };
  const startTraining = async () => {
    if (phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    endingRef.current = false;
    const generation = generationRef.current;
    PrepareAudioFeedback();
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* Windowed play remains available. */ }
    if (generation !== generationRef.current || phaseRef.current !== 'rules') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    SendGameEvent('active');
    setDeck([]);
    setPhase('running');
  };

  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`;
  const hints: Record<string, string> = en ? {
    runLength: 'After this many correct sorts in a row, the rule changes without warning.',
    categories: 'The session ends once this many rules are found, or when the cards run out.',
    maxCards: 'The session also ends when this many cards have been used.',
  } : {
    runLength: '連續答對這麼多張後，規則會不預告地改變。',
    categories: '找到這麼多個規則，或卡片用完，就會結束。',
    maxCards: '用完這麼多張卡片也會結束。',
  };
  const summaryItems = rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` }));
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const card = deck[cardIndex];
  const cardsUsed = Math.min(cardIndex + 1, settings.maxCards);
  return <div ref={rootRef} className="card-sorting-game-root">
    <div ref={jsPsychHostRef} className="sort-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <SortingTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog card-sorting-phase-menu" aria-labelledby="sort-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="sort-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><main className="sort-stage sort-running" aria-label={title} inert={paused}>
      <header className="sort-hud">
        <p className="sort-progress-label">{en ? `Card ${cardsUsed} of up to ${settings.maxCards}` : `第 ${cardsUsed} 張，最多 ${settings.maxCards} 張`}</p>
        <div className="sort-progress-track"><div className="sort-progress-fill" style={{ width: `${cardsUsed / settings.maxCards * 100}%` }} /></div>
        <button ref={stopRef} type="button" className="btn btn-ghost sort-stop" onClick={pause}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div className="sort-keys" role="group" aria-label={en ? 'Piles' : '四疊卡片'}>
        {keyCards.map((key, index) => <button key={index} type="button" className="sort-key" data-chosen={feedback?.chosen === index ? 'true' : undefined}
          aria-label={en ? `Pile ${index + 1}: ${DescribeCard(key, true)}` : `第 ${index + 1} 疊：${DescribeCard(key, false)}`}
          onClick={() => chooseRef.current(index)}><CardFace card={key} /><span className="sort-key-number" aria-hidden="true">{index + 1}</span></button>)}
      </div>
      <p className="sort-feedback" role="status" data-correct={feedback ? String(feedback.correct) : undefined}>
        {feedback ? (feedback.correct ? (en ? '✓ Correct' : '✓ 對') : (en ? '✗ Wrong' : '✗ 不對')) : ''}</p>
      <div className="sort-current">
        {card && <div className="sort-current-card" role="img" key={cardIndex} data-color={card.color} data-shape={card.shape} data-count={card.count} aria-label={DescribeCard(card, en)}><CardFace card={card} /></div>}
      </div>
    </main>{paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="sort-pause-title"
      onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="sort-pause-title">{en ? 'Paused' : '已暫停'}</h2>
      <p>{fullscreenInterrupted ? (en ? 'Fullscreen ended; ending the activity will not save this session.' : '已退出全螢幕，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束後不會保存這次紀錄。')}</p>
      <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume}>{en ? 'Continue' : '繼續'}</button>
      <button className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
    </div></div>}</>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Rules found' : '找到的規則'}</p><strong>{summary.categoriesCompleted} / {settings.categories}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Stuck on the old rule' : '沿用舊規則的錯誤'}</p><strong>{summary.perseverativeErrors}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Cards used' : '使用卡片'}</p><strong>{summary.cardsUsed}</strong></div>
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
        <div className="score-context-item"><dt>{en ? 'Correct sorts' : '正確率'}</dt><dd>{summary.accuracyPercent === null ? missing : `${summary.accuracyPercent}%`}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Other errors' : '其他錯誤'}</dt><dd>{summary.nonPerseverativeErrors}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Cards to find the first rule' : '找到第一個規則用了幾張'}</dt><dd>{summary.cardsToFirstCategory ?? missing}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Lost the rule after 5+ correct' : '連對 5 張以上後失誤'}</dt><dd>{summary.failuresToMaintainSet}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time per card' : '每張平均時間'}</dt><dd>{summary.meanRtMs === null ? missing : `${summary.meanRtMs} ms`}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Stuck on the old rule counts sorts that still followed the rule in use before the last change.'
          : '沿用舊規則的錯誤，是指規則改變後仍照上一個規則配對的次數。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      </details>
    </section></div>}
  </div>;
}
