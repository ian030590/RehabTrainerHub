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

type Phase = 'menu' | 'rules' | 'running' | 'results';

const feedbackMs = 900;

export function CardSortingGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
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
  const timerRef = useRef(0);
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    window.clearTimeout(timerRef.current);
    sortingRef.current = null;
    busyRef.current = false;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  const finish = useCallback((completed: SortRow[]) => {
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
    if (phaseRef.current !== 'running' || !sorting || !card || busyRef.current) return;
    busyRef.current = true;
    const rule = sorting.ruleCode;
    const category = sorting.categoriesCompleted + 1;
    const outcome = sorting.sort(card, keyIndex);
    rowsRef.current = [...rowsRef.current, { trial: rowsRef.current.length + 1, rule, cardColor: colors.indexOf(card.color),
      cardShape: shapes.indexOf(card.shape), cardCount: card.count, chosen: keyIndex, correct: outcome.correct, perseverative: outcome.perseverative,
      category, rtMs: Math.round(performance.now() - shownAtRef.current) }];
    if (outcome.correct) PlaySuccessSound(); else PlayFailureSound();
    setFeedback({ correct: outcome.correct, chosen: keyIndex });
    const generation = generationRef.current;
    timerRef.current = window.setTimeout(() => {
      if (generation !== generationRef.current) return;
      busyRef.current = false;
      setFeedback(null);
      if (outcome.finished || cardIndex + 1 >= deck.length) { finish(rowsRef.current); return; }
      shownAtRef.current = performance.now();
      setCardIndex(cardIndex + 1);
    }, feedbackMs);
  };
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      const keyIndex = ['1', '2', '3', '4'].indexOf(event.key);
      if (keyIndex >= 0) { event.preventDefault(); if (!event.repeat) chooseRef.current(keyIndex); }
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
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:card-sorting', onStart: () => {
      rowsRef.current = [];
      busyRef.current = false;
      sortingRef.current = new CardSorting(settings);
      setDeck(CreateCardDeck(settings.maxCards, CreateRandom(Date.now())));
      setCardIndex(0);
      setFeedback(null);
      shownAtRef.current = performance.now();
    } });
    return () => {
      window.clearTimeout(timerRef.current);
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
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="sort-stage sort-running" aria-label={title}>
      <header className="sort-hud">
        <p className="sort-progress-label">{en ? `Card ${cardsUsed} of up to ${settings.maxCards}` : `第 ${cardsUsed} 張，最多 ${settings.maxCards} 張`}</p>
        <div className="sort-progress-track"><div className="sort-progress-fill" style={{ width: `${cardsUsed / settings.maxCards * 100}%` }} /></div>
        <button type="button" className="btn btn-ghost sort-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
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
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Rules found' : '找到的規則'}</p><strong>{summary.categoriesCompleted} / {settings.categories}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Stuck on the old rule' : '沿用舊規則的錯誤'}</p><strong>{summary.perseverativeErrors}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Cards used' : '使用卡片'}</p><strong>{summary.cardsUsed}</strong></div>
      </div></section>
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
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
