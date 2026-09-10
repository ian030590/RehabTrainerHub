import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { NormalizeGameSettingsValues, ParseGameSettingsDefinition } from '@rehab-trainer/game-settings';
import {
  GetHostedGameSettings,
  IsEmbeddedHubTraining,
  NotifyHubTrainingReady,
  SetHostedGameSettings,
} from '../embeddedTraining';
import { useT } from '../i18n/games';
import { useHostedGameSettings } from '../hooks/useHostedGameSettings';
import { EndTour, IsTourActive, StartTour, type TourStep } from '../tour';
import { GameSettingsForm } from './GameSettingsForm';
import './GameSettings.css';
import '../tour/toutour.css';

export const officialGameTourCompleteEvent = 'rehab-trainer:official-game-tour-complete';

export function OfficialGameShell({ children, settings, title }: {
  children: ReactNode;
  settings: unknown;
  title: string;
}) {
  const [definition] = useState(() => ParseGameSettingsDefinition(settings));
  const { lang } = useT();
  const received = useHostedGameSettings();
  const [configured, setConfigured] = useState(false);
  const [session, setSession] = useState(0);
  const [tourComplete, setTourComplete] = useState(false);
  const runtimeRef = useRef<HTMLDivElement>(null);
  const embedded = IsEmbeddedHubTraining();

  useEffect(() => {
    if (embedded) NotifyHubTrainingReady();
    const configure = () => {
      setConfigured(false);
      setTourComplete(false);
      setSession((value) => value + 1);
    };
    window.addEventListener('rehab-trainer:standalone-configure', configure);
    return () => window.removeEventListener('rehab-trainer:standalone-configure', configure);
  }, [embedded]);

  useEffect(() => {
    if (!embedded || !received) return;
    SetHostedGameSettings(NormalizeGameSettingsValues(definition, received));
    setTourComplete(false);
    setConfigured(true);
  }, [definition, embedded, received]);

  useEffect(() => {
    if (!configured) return;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    let disposed = false;
    const finishTour = () => {
      if (!disposed) setTourComplete(true);
    };
    runtime.addEventListener(officialGameTourCompleteEvent, finishTour);

    if (runtime.querySelector('[data-official-game-tour-managed="true"]')) {
      return () => {
        disposed = true;
        runtime.removeEventListener(officialGameTourCompleteEvent, finishTour);
      };
    }

    const find = (selector: string) => () => runtime.querySelector<HTMLElement>(selector) ?? runtime;
    const steps: TourStep[] = [
      {
        target: find('.training-rules .training-config-header, h1, h2'),
        title: '訓練目標 / Training goal',
        text: '<p lang="zh-TW">先確認本次活動的目標與規則。</p><p lang="en">Review the activity goal and rules first.</p>',
        place: 'bottom',
      },
      {
        target: find('.training-rules-body, main, canvas'),
        title: '遊戲畫面 / Game screen',
        text: '<p lang="zh-TW">依照畫面提示完成每次反應。</p><p lang="en">Follow the on-screen cues for each response.</p>',
        place: 'bottom',
      },
      {
        target: find('.training-rules .training-config-navigation-buttons button:first-child, button'),
        title: '開始方式 / How to start',
        text: '<p lang="zh-TW">導覽結束後，使用開始按鈕進入活動；計時與遊玩不會提前開始。</p><p lang="en">After the tour, use the start button to begin; timing and play do not start early.</p>',
        place: 'top',
      },
    ];
    const started = StartTour(steps, {
      allowHTML: true,
      block: true,
      labels: {
        next: '下一步 / Next',
        prev: '上一步 / Back',
        done: '完成導覽 / Finish',
        skip: '略過導覽 / Skip tour',
      },
      lang: 'zh-TW',
      storageKey: `rehab_official_game_tour_${window.location.pathname}`,
      onEvent: (name) => {
        if (name === 'tour_done' || name === 'tour_skip') finishTour();
      },
    });
    if (!started) finishTour();

    return () => {
      disposed = true;
      runtime.removeEventListener(officialGameTourCompleteEvent, finishTour);
      if (started && IsTourActive()) EndTour(false);
    };
  }, [configured, session]);

  if (configured && GetHostedGameSettings()) return (
    <Fragment key={session}>
      <div
        aria-busy={!tourComplete || undefined}
        data-official-game-tour={tourComplete ? 'complete' : 'pending'}
        inert={!tourComplete || undefined}
        ref={runtimeRef}
      >
        {children}
      </div>
    </Fragment>
  );
  if (embedded) return <p role="status">{lang === 'en' ? 'Loading settings…' : '正在載入設定…'}</p>;
  return <GameSettingsForm
    definition={definition}
    language={lang}
    title={title}
    onCancel={() => window.history.back()}
    onSubmit={(values) => {
      SetHostedGameSettings(values);
      setTourComplete(false);
      setConfigured(true);
    }}
  />;
}
