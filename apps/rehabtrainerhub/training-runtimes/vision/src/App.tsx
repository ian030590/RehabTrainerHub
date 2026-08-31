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
  appSettingsChangedEvent,
  defaultUiFontSizePx,
  GetSetting,
} from './utils/settings';

const HomePage = lazy(() => import('@rehab-trainer/hub-modules/vision/pages/HomePage').then((module) => ({ default: module.HomePage })));
const TrainingPage = lazy(() => import('@rehab-trainer/hub-modules/vision/pages/training/TrainingPage').then((module) => ({ default: module.TrainingPage })));
const HartChartPage = lazy(() => import('@rehab-trainer/hub-modules/vision/pages/training/HartChartPage').then((module) => ({ default: module.HartChartPage })));
const HartChartDisplayPage = lazy(() => import('@rehab-trainer/hub-modules/vision/pages/training/HartChartPage').then((module) => ({ default: module.HartChartDisplayPage })));

export function App() {
  const { lang, t } = useT();
  const location = useLocation();
  const apiBase = siteUrls.hub;
  const locale = lang === 'en' ? 'en' : 'zh-TW';
  const isTrainingPath = [
    '/',
    '/training',
    '/hart-chart',
    '/hart-chart/display',
  ].includes(location.pathname);

  return (
    <Suspense fallback={<AppLoading label={t('app.loading')} />}>
      <TrainingLoginReminder
        active={isTrainingPath}
        apiBase={apiBase}
        appName={t('nav.brand')}
        locale={locale}
        privacyHref={`${siteUrls.hub}/privacy/`}
        turnstileAuthRequired={import.meta.env.VITE_TURNSTILE_AUTH_REQUIRED === '1'}
        turnstileRecordsRequired={import.meta.env.VITE_TURNSTILE_RECORDS_REQUIRED === '1'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
      />
      <Routes>
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/hart-chart" element={<HartChartPage />} />
        <Route path="/hart-chart/display" element={<HartChartDisplayPage />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
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
  }), appSettingsChangedEvent);

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
        labels: GetTrainerFooterLabels(lang),
      }}
    >
      <Outlet />
    </TrainerAppLayout>
  );
}
