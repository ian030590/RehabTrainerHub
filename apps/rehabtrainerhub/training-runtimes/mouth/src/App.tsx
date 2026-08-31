import { Suspense, lazy } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { GetTrainerFooterLabels, GetTrainerSkipLinkLabel } from '@rehab-trainer/ui/components/RehabFooter';
import { TrainerAppLayout } from '@rehab-trainer/ui/components/TrainerAppLayout';
import { TrainingLoginReminder } from '@rehab-trainer/ui/components/TrainingLoginReminder';
import { useSyncedDisplaySettings } from '@rehab-trainer/ui/hooks/useSyncedDisplaySettings';
import { Navbar } from './components/Navbar';
import { useT } from './i18n';
import { defaultUiFontSizePx, GetSetting, settingsChangedEvent } from './utils/settings';
import { siteUrls } from './utils/siteUrls';

const ComprehensionTraining = lazy(() => import('@rehab-trainer/hub-modules/mouth/pages/training/ComprehensionTraining').then((module) => ({ default: module.ComprehensionTraining })));
const OralTraining = lazy(() => import('@rehab-trainer/hub-modules/mouth/pages/training/OralTraining').then((module) => ({ default: module.OralTraining })));

export function App() {
  const { lang, t } = useT();
  const location = useLocation();
  const isTraining = ['/comprehension-training', '/oral-training'].includes(location.pathname);
  return (
    <Suspense fallback={<AppLoading label={t('app.loading')} />}>
      <TrainingLoginReminder
        active={isTraining}
        apiBase={siteUrls.hub}
        appName={t('nav.brand')}
        locale={lang === 'en' ? 'en' : 'zh-TW'}
        privacyHref={`${siteUrls.hub}/privacy/`}
        turnstileAuthRequired={import.meta.env.VITE_TURNSTILE_AUTH_REQUIRED === '1'}
        turnstileRecordsRequired={import.meta.env.VITE_TURNSTILE_RECORDS_REQUIRED === '1'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
      />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/oral-training" replace />} />
          <Route path="/comprehension-training" element={<ComprehensionTraining />} />
          <Route path="/oral-training" element={<OralTraining />} />
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
