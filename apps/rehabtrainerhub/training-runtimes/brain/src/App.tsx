import { Suspense, lazy } from 'react';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { GetTrainerFooterLabels, GetTrainerSkipLinkLabel } from '@rehab-trainer/ui/components/RehabFooter';
import { TrainerAppLayout } from '@rehab-trainer/ui/components/TrainerAppLayout';
import { TrainingLoginReminder } from '@rehab-trainer/ui/components/TrainingLoginReminder';
import { useSyncedDisplaySettings } from '@rehab-trainer/ui/hooks/useSyncedDisplaySettings';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { useT } from './i18n';
import { ModulePage } from '@rehab-trainer/hub-modules/brain/pages/ModulePage';
import { siteUrls } from './utils/siteUrls';
import {
  defaultUiFontSizePx,
  settingsChangedEvent,
  GetSetting,
} from './utils/settings';

const PeripheralAttentionPage = lazy(() => import('@rehab-trainer/hub-modules/brain/pages/PeripheralAttentionPage').then((module) => ({ default: module.PeripheralAttentionPage })));
const EveryBallResponsePage = lazy(() => import('@rehab-trainer/hub-modules/brain/pages/EveryBallResponsePage').then((module) => ({ default: module.EveryBallResponsePage })));
const ThinkingTraining = lazy(() => import('@rehab-trainer/hub-modules/brain/pages/thinking/ThinkingTraining').then((module) => ({ default: module.ThinkingTraining })));

export function App() {
  const { lang, t } = useT();
  const location = useLocation();
  const apiBase = siteUrls.hub;
  const locale = lang === 'en' ? 'en' : 'zh-TW';
  const trainingPaths = new Set(['/', '/attention-training', '/attention-training/ufov', '/attention-training/every-ball-response', '/memory-training', '/thinking-training']);

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
          <Route path="/" element={<Navigate to="/attention-training" replace />} />
          <Route path="/attention-training" element={<ModulePage moduleId="attention" />} />
          <Route path="/attention-training/ufov" element={<PeripheralAttentionPage />} />
          <Route path="/attention-training/every-ball-response" element={<EveryBallResponsePage />} />
          <Route path="/memory-training" element={<ModulePage moduleId="memory" />} />
          <Route path="/thinking-training" element={<ThinkingTraining />} />
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
