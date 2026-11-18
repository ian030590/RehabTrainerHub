import { useEffect, useRef, type RefObject, type ReactNode } from 'react';
import { useT } from './i18n/useT';
import { MakeRoad } from './src/road';
import { ModelFor, Severity, Simulate, step } from './src/physics';
import { Judge, RandomFrom, type MakeRound } from './src/round';
import type { Row } from './src/score';
import type { Settings, Scenario } from './settings';
import { PlayBrakeCue, PrepareAudioFeedback, SetSoundEnabled } from './runtime/soundManager';

export function RunningView({ round, settings, scenario, index, demo, paused, falseStarts, note, lastBrakeInput,
  onFalseStart, onFeedback, onPause, sound, onSound, stopControl }: {
  round: ReturnType<typeof MakeRound>;
  settings: Settings;
  scenario: Scenario;
  index: number;
  demo: boolean;
  paused: boolean;
  falseStarts: number;
  note: string;
  lastBrakeInput: RefObject<number>;
  onFalseStart: () => void;
  onFeedback: (row: Row) => void;
  onPause: () => void;
  sound: boolean;
  onSound: (enabled: boolean) => void;
  stopControl: ReactNode;
}) {
  const { copy: t, lang } = useT();
  const rootRef = useRef<HTMLElement>(null);
  const distraction = index === 5;
  const title = demo ? t.demo : distraction ? t.distraction : (lang === 'zh' ? '第 ' : t.round + ' ') + (index + 1) + ' / 6';
  useEffect(() => {
    if (paused) return;
    const root = rootRef.current!;
    const Element = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
    const model = ModelFor(settings);
    const stream = RandomFrom(round.messageSeed);
    const draw = MakeRoad(Element('canvas'));
    let frame = 0;
    const unbrakedEnd = Simulate(model, round.gap, 10).end;
    const banner = Element('#banner');
    const brake = Element<HTMLButtonElement>('#brake');
    const started = performance.now();
    const events = new AbortController();
    const listeners = { signal: events.signal };
    let status: 'waiting' | 'settling' | 'done' = 'waiting';
    let onset: number | undefined;
    let settledAt = 0;
    let playerDelay = 10;
    let record: Row | undefined;
    let messageAt = 1500 + MessageWait();
    let answered = 0;
    let answerValues: number[] = [];
    let correct = 0;
    const answerButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-answer]')];

    function MessageWait() { return 350 + stream() * 450; }

    function ShowMessage() {
      const first = 2 + Math.floor(stream() * 8);
      const second = 2 + Math.floor(stream() * 8);
      const multiply = stream() < .5;
      correct = multiply ? first * second : first + second;
      const offset = 1 + Math.floor(stream() * 3);
      answerValues = [correct, correct + offset, correct - offset].sort((a, b) => a - b);
      const shift = Math.floor(stream() * answerValues.length);
      answerValues = [...answerValues.slice(shift), ...answerValues.slice(0, shift)];
      Element('#message').textContent = first + (multiply ? ' × ' : ' + ') + second + ' = ?';
      answerButtons.forEach((button, i) => {
        button.textContent = String(answerValues[i]);
        button.disabled = false;
      });
      PlayBrakeCue('ping');
    }

    for (const [i, button] of answerButtons.entries()) button.addEventListener('click', () => {
      if (status !== 'waiting' || !answerValues.length) return;
      if (answerValues[i] !== correct) {
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          button.animate([{ translate: '-3px' }, { translate: '3px' }, { translate: '0' }], 145);
        }
        return;
      }
      answered++;
      answerValues = [];
      messageAt = performance.now() - started + MessageWait();
      Element('#message').textContent = t.noMessage;
      answerButtons.forEach(choice => { choice.disabled = true; });
      brake.focus({ preventScroll: true });
    }, listeners);

    function Pause() {
      if (status === 'done') return;
      status = 'done';
      cancelAnimationFrame(frame);
      onPause();
    }

    function React(input: number) {
      if (status !== 'waiting' || input < started) return;
      const judgment = onset === undefined ? { kind: 'falseStart' } as const : Judge(onset, input);
      if (judgment.kind === 'falseStart') {
        onFalseStart();
        return;
      }
      status = 'settling';
      playerDelay = judgment.r + .2;
      settledAt = performance.now();
      record = { scenario, r: judgment.r, timedOut: judgment.kind === 'timeout', falseStarts, answered,
        gap: round.gap, outcome: Simulate(model, round.gap, playerDelay) };
      answerButtons.forEach(button => { button.disabled = true; });
      brake.disabled = true;
    }

    function InputTime(event: Event) {
      const now = performance.now();
      const stamp = event.timeStamp;
      if (stamp <= 0 || stamp > now + 50 ||
          (onset !== undefined && stamp < onset - 50 && now - stamp > 50)) return now;
      return stamp;
    }

    function BrakeInput(event: Event) {
      const input = InputTime(event);
      if (input - lastBrakeInput.current < 1000 * step) return;
      lastBrakeInput.current = input;
      React(input);
    }

    let brakePlayed = false;
    let contactShown = false;
    function Paint() {
      if (status === 'done') return;
      const now = performance.now();
      const sinceStart = now - started;
      if (sinceStart >= 1500 && onset === undefined && sinceStart >= round.onset) {
        onset = now;
        banner.textContent = t.cue;
        PlayBrakeCue('brake');
      } else if (sinceStart >= 1500 && onset === undefined) {
        banner.textContent = '';
      }
      if (onset !== undefined && status === 'waiting' && now - onset >= 2500) React(onset + 2500);
      if (status === 'waiting' && distraction && !answerValues.length && sinceStart >= messageAt) ShowMessage();

      const elapsed = onset === undefined ? 0 : Math.floor((now - onset) / (1000 * step)) * step;
      const timeline = onset === undefined ? sinceStart : round.onset + now - onset;
      const end = record?.outcome.end ?? unbrakedEnd;
      draw(round, model, timeline, onset !== undefined, playerDelay, Math.min(elapsed, end), settings.road === 'wet');
      if (record && !brakePlayed && elapsed >= playerDelay && playerDelay < end) {
        brakePlayed = true;
        PlayBrakeCue('brake');
      }
      if (record && elapsed >= end && record.outcome.rel !== null && !contactShown) {
        contactShown = true;
        const grade = Severity(record.outcome.rel);
        const road = Element('.road-frame');
        road.dataset.contact = grade;
        Element('.contact-marker').hidden = false;
        PlayBrakeCue(grade);
      }
      if (record && elapsed >= end + .65 && now - settledAt >= 650) {
        onFeedback(record);
        return;
      }
      frame = requestAnimationFrame(Paint);
    }

    window.addEventListener('blur', Pause, listeners);
    let enteredFullscreen = Boolean(document.fullscreenElement);
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) enteredFullscreen = true;
      else if (enteredFullscreen) Pause();
    }, listeners);
    window.addEventListener('pagehide', () => {
      status = 'done';
      cancelAnimationFrame(frame);
      events.abort();
    }, listeners);
    document.addEventListener('visibilitychange', () => { if (document.hidden) Pause(); }, listeners);
    window.addEventListener('keydown', event => {
      if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
          (event.target instanceof HTMLButtonElement && event.target !== brake)) return;
      event.preventDefault();
      BrakeInput(event);
    }, listeners);
    brake.addEventListener('pointerdown', event => {
      if (event.isPrimary && event.button === 0) BrakeInput(event);
    }, listeners);
    brake.addEventListener('click', event => {
      if (event.detail === 0) BrakeInput(event);
    }, listeners);
    frame = requestAnimationFrame(Paint);
    return () => {
      status = 'done';
      cancelAnimationFrame(frame);
      events.abort();
    };
  }, [paused, round, settings, scenario, distraction, falseStarts, t, lastBrakeInput, onFalseStart, onFeedback, onPause]);

  return <section className="driving" ref={rootRef} inert={paused} aria-labelledby={paused ? undefined : "title"}>
    <header className="drive-toolbar">
      <h2 id={paused ? undefined : "title"} tabIndex={-1}>{title}</h2>
      <span>{settings.speedKmh} km/h</span>
      <button className="btn btn-ghost" id="sound" aria-pressed={sound} onClick={() => {
        SetSoundEnabled(!sound);
        if (!sound) PrepareAudioFeedback();
        onSound(!sound);
      }}>{t.sound}</button>
      {stopControl}
    </header>
    <div className="road-frame">
      <canvas aria-hidden="true" />
      <p id="banner" className="road-caption" role="status">{note || t.ready}</p>
      <span className="contact-marker" hidden aria-hidden="true" />
    </div>
    {distraction && <section className="messages" aria-label={t.messages}>
      <p id="message" aria-live="polite">{note ? t.noMessage : t.distractionInstruction}</p>
      <div id="answers" className="answers">{[0, 1, 2].map(i =>
        <button key={i} className="btn btn-ghost" data-answer={i} disabled>…</button>,
      )}</div>
    </section>}
    <div className="brake-controls">
      <button className="btn btn-primary" id="brake" aria-describedby="brake-help">{t.brake}</button>
      <p id="brake-help">{t.pressHelp}</p>
    </div>
  </section>;
}
