import { Suspense, lazy } from 'react';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { GetTrainerFooterLabels, GetTrainerSkipLinkLabel } from '@rehab-trainer/ui/components/RehabFooter';
import { TrainerAppLayout } from '@rehab-trainer/ui/components/TrainerAppLayout';
import { TrainingLoginReminder } from '@rehab-trainer/ui/components/TrainingLoginReminder';
import { useSyncedDisplaySettings } from '@rehab-trainer/ui/hooks/useSyncedDisplaySettings';
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
const TrainingPage = lazy(() => import('@rehab-trainer/hub-modules/motor/pages/training/TrainingPage').then((module) => ({ default: module.TrainingPage })));
const UpperLimbTraining = lazy(() => import('@rehab-trainer/hub-modules/motor/pages/training/UpperLimbTraining').then((module) => ({ default: module.UpperLimbTraining })));
const LowerLimbTraining = lazy(() => import('@rehab-trainer/hub-modules/motor/pages/training/LowerLimbTraining').then((module) => ({ default: module.LowerLimbTraining })));
const CreditsPage = lazy(() => import('./pages/credits/CreditsPage').then((module) => ({ default: module.CreditsPage })));

export function App() {
  const { lang, t } = useT();
  const location = useLocation();
  const apiBase = siteUrls.hub;
  const locale = lang === 'en' ? 'en' : 'zh-TW';
  const trainingPaths = new Set(['/', '/upper-limb-training', '/lower-limb-training', '/training']);

  return (
    <Suspense fallback={<AppLoading label={t('app.loading')} />}>
      <TrainingLoginReminder
        active={trainingPaths.has(location.pathname)}
        apiBase={apiBase}
        appName={t('nav.brand')}
        locale={locale}
        privacyHref={`${siteUrls.hub}/privacy/`}
        turnstileAuthRequired={import.meta.env.VITE_TURNSTILE_AUTH_REQUIRED === '1'}
        turnstileRecordsRequired={import.meta.env.VITE_TURNSTILE_RECORDS_REQUIRED === '1'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
      />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/upper-limb-training" replace />} />
          <Route path="/upper-limb-training" element={<UpperLimbTraining />} />
          <Route path="/lower-limb-training" element={<LowerLimbTraining />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/credits" element={<CreditsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function AppLayout() {
  const { lang, t } = useT();
  useSyncedDisplaySettings(() => ({
    fontSizePx: GetSetting('uiFontSizePx'),
    defaultFontSizePx: defaultUiFontSizePx,
    fontBold: GetSetting('uiFontBold'),
    uiTheme: GetSetting('uiTheme'),
  }), settingsChangedEvent);

  return (
    <TrainerAppLayout
      analyticsToken={import.meta.env.VITE_CF_WEB_ANALYTICS_TOKEN}
      locale={lang === 'en' ? 'en' : 'zh-TW'}
      navbar={<Navbar />}
      skipLinkLabel={GetTrainerSkipLinkLabel(lang)}
      footer={{
        appName: t('nav.brand'),
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
