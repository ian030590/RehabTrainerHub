import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { NormalizeGameSettingsValues, ParseGameSettingsDefinition } from '@rehab-trainer/game-settings';
import {
  GetHostedGameSettings,
  IsEmbeddedHubTraining,
  NotifyHubTrainingReady,
  SetHostedGameSettings,
  SetGameScoreDefinition,
} from '../embeddedTraining';
import { EnterFullscreenFromUserGesture } from '../fullscreen';
import { useT } from '../i18n/games';
import { useHostedGameSettings } from '../hooks/useHostedGameSettings';
import { GameSettingsForm } from './GameSettingsForm';
import './GameSettings.css';

export function OfficialGameShell({ children, settings, score, title }: {
  children: ReactNode;
  settings: unknown;
  score: unknown;
  title: string;
}) {
  const [definition] = useState(() => {
    const parsed = ParseGameSettingsDefinition(settings);
    SetGameScoreDefinition(score, parsed.gameId);
    return parsed;
  });
  const { lang } = useT();
  const received = useHostedGameSettings();
  const [configured, setConfigured] = useState(false);
  const [session, setSession] = useState(0);
  const embedded = IsEmbeddedHubTraining();

  useEffect(() => {
    if (embedded) NotifyHubTrainingReady();
    const configure = () => {
      setConfigured(false);
      setSession((value) => value + 1);
    };
    window.addEventListener('rehab-trainer:standalone-configure', configure);
    return () => window.removeEventListener('rehab-trainer:standalone-configure', configure);
  }, [embedded]);

  useEffect(() => {
    if (!embedded || !received) return;
    SetHostedGameSettings(NormalizeGameSettingsValues(definition, received));
    setConfigured(true);
  }, [definition, embedded, received]);

  if (configured && GetHostedGameSettings()) return <Fragment key={session}>{children}</Fragment>;
  if (embedded) return <p role="status">{lang === 'en' ? 'Loading settings…' : '載入設定中…'}</p>;
  return <GameSettingsForm
    definition={definition}
    language={lang}
    title={title}
    onCancel={() => window.history.back()}
    onSubmit={(values) => {
      // The settings submit is the user gesture that browsers require for fullscreen.
      // Request it before mounting the game runtime, whose iframe load is too late.
      void EnterFullscreenFromUserGesture(document.documentElement);
      SetHostedGameSettings(values);
      setConfigured(true);
    }}
  />;
}
