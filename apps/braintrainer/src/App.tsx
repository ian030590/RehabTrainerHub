import { Suspense, lazy } from 'react';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { GetTrainerFooterLabels, GetTrainerSkipLinkLabel } from '@rehab-trainer/ui/components/RehabFooter';
import { TrainerAppLayout } from '@rehab-trainer/ui/components/TrainerAppLayout';
import { TrainingLoginReminder } from '@rehab-trainer/ui/components/TrainingLoginReminder';
import { useSyncedDisplaySettings } from '@rehab-trainer/ui/hooks/useSyncedDisplaySettings';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { useT } from './i18n';
import { ModulePage } from './pages/ModulePage';
import { siteUrls } from './utils/siteUrls';
import {
  defaultUiFontSizePx,
  settingsChangedEvent,
  GetSetting,
} from './utils/settings';

const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const ReferencesPage = lazy(() => import('./pages/ReferencesPage').then((module) => ({ default: module.ReferencesPage })));
const LinksPage = lazy(() => import('./pages/links/LinksPage').then((module) => ({ default: module.LinksPage })));
const UFOVPage = lazy(() => import('./pages/UFOVPage').then((module) => ({ default: module.UFOVPage })));
const EveryBallResponsePage = lazy(() => import('./pages/EveryBallResponsePage').then((module) => ({ default: module.EveryBallResponsePage })));
const ThinkingTraining = lazy(() => import('./pages/thinking/ThinkingTraining').then((module) => ({ default: module.ThinkingTraining })));
const MainConceptTraining = lazy(() => import('./pages/MainConceptTraining').then((module) => ({ default: module.MainConceptTraining })));

export function App() {
  const { lang, t } = useT();
  const location = useLocation();
  const apiBase = siteUrls.hub;
  const locale = lang === 'en' ? 'en' : 'zh-TW';
  const trainingPaths = new Set(['/', '/attention-training', '/attention-training/ufov', '/attention-training/every-ball-response', '/memory-training', '/thinking-training', '/thinking-training/main-concept']);

  return (
    <Suspense fallback={<AppLoading label={t('app.loading')} />}>
      <TrainingLoginReminder
        active={trainingPaths.has(location.pathname)}
        apiBase={apiBase}
        appName="BrainTrainer"
        locale={locale}
        privacyHref={`${siteUrls.hub}/privacy/`}
      />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/attention-training" replace />} />
          <Route path="/attention-training" element={<ModulePage moduleId="attention" />} />
          <Route path="/attention-training/ufov" element={<UFOVPage />} />
          <Route path="/attention-training/every-ball-response" element={<EveryBallResponsePage />} />
          <Route path="/memory-training" element={<ModulePage moduleId="memory" />} />
          <Route path="/thinking-training" element={<ThinkingTraining />} />
          <Route path="/thinking-training/main-concept" element={<MainConceptTraining />} />
          <Route path="/references" element={<ReferencesPage />} />
          <Route path="/links" element={<LinksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function AppLayout() {
  const { lang } = useT();
  useSyncedDisplaySettings(() => ({
    fontSizePx: GetSetting('uiFontSizePx'),
    defaultFontSizePx: defaultUiFontSizePx,
    fontBold: GetSetting('uiFontBold'),
    uiTheme: GetSetting('uiTheme'),
  }), settingsChangedEvent);

  return (
    <TrainerAppLayout
      navbar={<Navbar />}
      skipLinkLabel={GetTrainerSkipLinkLabel(lang)}
      footer={{
        appName: 'BrainTrainer',
        hubHref: siteUrls.hub,
        privacyHref: `${siteUrls.hub}/privacy/`,
        repoHref: 'https://github.com/ian030590/RehabTrainerHub',
        labels: GetTrainerFooterLabels(lang),
      }}
    >
      <Outlet />
    </TrainerAppLayout>
  );
}
