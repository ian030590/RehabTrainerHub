import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { NormalizeGameSettingsValues, ParseGameSettingsDefinition } from '@rehab-trainer/game-settings';
import {
  GetHostedGameSettings,
  IsEmbeddedHubTraining,
  IsHubTrainingConfigureReason,
  NotifyHubTrainingReady,
  SetHostedGameSettings,
  SetGameScoreDefinition,
  type HubTrainingConfigureReason,
} from '../embeddedTraining';
import { EnterFullscreenFromUserGesture } from '../fullscreen';
import { useT } from '../i18n/games';
import { useHostedGameSettings } from '../hooks/useHostedGameSettings';
import { GameSettingsForm } from './GameSettingsForm';
import { GetOrCreateSubjectId } from '../storage/subjectId';
import {
  ConfigureRemoteTrainingRecordVerification,
  FlushPendingRemoteTrainingRecords,
} from '../auth/authClient';
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
  const [notice, setNotice] = useState<HubTrainingConfigureReason | null>(null);
  const embedded = IsEmbeddedHubTraining();

  useEffect(() => {
    GetOrCreateSubjectId();
    void FlushPendingRemoteTrainingRecords();
    const flush = () => { void FlushPendingRemoteTrainingRecords(); };
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);

  useEffect(() => {
    ConfigureRemoteTrainingRecordVerification({
      enabled: import.meta.env.VITE_TURNSTILE_RECORDS_REQUIRED === '1',
      locale: lang === 'en' ? 'en' : 'zh-TW',
      siteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
    });
    return () => ConfigureRemoteTrainingRecordVerification({ enabled: false });
  }, [lang]);

  useEffect(() => {
    if (embedded) NotifyHubTrainingReady();
    const configure = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: unknown } | null>).detail?.reason;
      setNotice(IsHubTrainingConfigureReason(reason) ? reason : null);
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
    notice={notice}
    title={title}
    onCancel={() => window.history.back()}
    onSubmit={(values) => {
      setNotice(null);
      // The settings submit is the user gesture that browsers require for fullscreen.
      // Request it before mounting the game runtime, whose iframe load is too late.
      void EnterFullscreenFromUserGesture(document.documentElement);
      SetHostedGameSettings(values);
      setConfigured(true);
    }}
  />;
}
