import { Suspense, lazy, useEffect, useLayoutEffect } from 'react';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { TrainerAppLayout } from '@rehab-trainer/ui/components/TrainerAppLayout';
import { TrainingLoginReminder } from '@rehab-trainer/ui/components/TrainingLoginReminder';
import { ApplyDisplaySettings } from '@rehab-trainer/ui/settings/displaySettings';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { useT } from './i18n';
import { siteUrls } from './utils/siteUrls';
import {
  defaultUiFontSizePx,
  settingsChangedEvent,
  GetSetting,
} from './utils/settings';

const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const TrainingPage = lazy(() => import('./pages/training/TrainingPage').then((module) => ({ default: module.TrainingPage })));
const MotorTraining = lazy(() => import('./pages/training/MotorTraining').then((module) => ({ default: module.MotorTraining })));
const CreditsPage = lazy(() => import('./pages/credits/CreditsPage').then((module) => ({ default: module.CreditsPage })));
const LinksPage = lazy(() => import('./pages/links/LinksPage').then((module) => ({ default: module.LinksPage })));

export function App() {
  const { lang, t } = useT();
  const location = useLocation();
  const apiBase = siteUrls.hub;
  const locale = lang === 'en' ? 'en' : 'zh-TW';
  const trainingPaths = new Set(['/', '/motor-training', '/training']);

  return (
    <Suspense fallback={<AppLoading label={t('app.loading')} />}>
      <TrainingLoginReminder
        active={trainingPaths.has(location.pathname)}
        apiBase={apiBase}
        appName="StrokeTrainer"
        locale={locale}
        privacyHref={`${siteUrls.hub}/privacy/`}
      />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/motor-training" replace />} />
          <Route path="/motor-training" element={<MotorTraining />} />
          <Route path="/cognitive-training" element={<BrainThinkingRedirect />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/links" element={<LinksPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function BrainThinkingRedirect() {
  const { t } = useT();
  const location = useLocation();

  useEffect(() => {
    window.location.replace(`${siteUrls.brain}/#/thinking-training${location.search}`);
  }, [location.search]);

  return <AppLoading label={t('app.loading')} />;
}

function AppLayout() {
  const { lang } = useT();
  const footerLabels = lang === 'en'
    ? {
        hub: 'Hub',
        privacy: 'Privacy',
        repo: 'GitHub',
        disclaimer: 'For rehabilitation practice workflow prototyping, not medical advice.',
        rights: 'All rights reserved.',
      }
    : {
        hub: 'Hub',
        privacy: '隱私權政策',
        repo: 'GitHub',
        disclaimer: '復健練習流程原型，不能取代醫療建議。',
        rights: '保留所有權利。',
      };

  useLayoutEffect(() => {
    const applySettings = () => {
      ApplyDisplaySettings({
        fontSizePx: GetSetting('uiFontSizePx'),
        defaultFontSizePx: defaultUiFontSizePx,
        fontBold: GetSetting('uiFontBold'),
        uiTheme: GetSetting('uiTheme'),
      });
    };

    applySettings();
    window.addEventListener(settingsChangedEvent, applySettings);
    window.addEventListener('storage', applySettings);
    return () => {
      window.removeEventListener(settingsChangedEvent, applySettings);
      window.removeEventListener('storage', applySettings);
    };
  }, []);

  return (
    <TrainerAppLayout
      navbar={<Navbar />}
      footer={{
        appName: 'StrokeTrainer',
        hubHref: siteUrls.hub,
        privacyHref: `${siteUrls.hub}/privacy/`,
        repoHref: 'https://github.com/ian030590/RehabTrainerHub',
        labels: footerLabels,
      }}
    >
      <Outlet />
    </TrainerAppLayout>
  );
}
