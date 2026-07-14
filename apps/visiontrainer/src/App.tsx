import { Suspense, lazy, useLayoutEffect } from 'react';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { TrainerAppLayout } from '@rehab-trainer/ui/components/TrainerAppLayout';
import { TrainingLoginReminder } from '@rehab-trainer/ui/components/TrainingLoginReminder';
import { applyDisplaySettings } from '@rehab-trainer/ui/settings/displaySettings';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { useT } from './i18n';
import { siteUrls } from './utils/siteUrls';
import {
  APP_SETTINGS_CHANGED_EVENT,
  DEFAULT_UI_FONT_SIZE_PX,
  getSetting,
} from './utils/settings';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const TrainingPage = lazy(() => import('./pages/training/TrainingPage').then((module) => ({ default: module.TrainingPage })));
const AssessmentPage = lazy(() => import('./pages/assessment/AssessmentPage').then((module) => ({ default: module.AssessmentPage })));
const AcuityTestPage = lazy(() => import('./pages/assessment/AcuityTestPage').then((module) => ({ default: module.AcuityTestPage })));
const ContrastTestPage = lazy(() => import('./pages/assessment/ContrastTestPage').then((module) => ({ default: module.ContrastTestPage })));
const UfovAssessmentPage = lazy(() => import('./pages/assessment/UfovAssessmentPage').then((module) => ({ default: module.UfovAssessmentPage })));
const CreditsPage = lazy(() => import('./pages/credits/CreditsPage').then((module) => ({ default: module.CreditsPage })));
const LinksPage = lazy(() => import('./pages/links/LinksPage').then((module) => ({ default: module.LinksPage })));
const HartChartPage = lazy(() => import('./pages/training/HartChartPage').then((module) => ({ default: module.HartChartPage })));
const HartChartDisplayPage = lazy(() => import('./pages/training/HartChartPage').then((module) => ({ default: module.HartChartDisplayPage })));

export function App() {
  const { lang, t } = useT();
  const location = useLocation();
  const apiBase = import.meta.env.VITE_AUTH_API_BASE || siteUrls.hub;
  const locale = lang === 'en' ? 'en' : 'zh-TW';
  const isTrainingPath = [
    '/training',
    '/acuity-test',
    '/contrast-test',
    '/assessment/ufov',
    '/hart-chart',
    '/hart-chart/display',
  ].includes(location.pathname);

  return (
    <Suspense fallback={<AppLoading label={t('app.loading')} />}>
      <TrainingLoginReminder
        active={isTrainingPath}
        apiBase={apiBase}
        appName="VisionTrainer"
        locale={locale}
        privacyHref={`${siteUrls.hub}/privacy/`}
      />
      <Routes>
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/acuity-test" element={<AcuityTestPage />} />
        <Route path="/contrast-test" element={<ContrastTestPage />} />
        <Route path="/hart-chart" element={<HartChartPage />} />
        <Route path="/hart-chart/display" element={<HartChartDisplayPage />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/assessment" element={<AssessmentPage />} />
          <Route path="/assessment/ufov" element={<UfovAssessmentPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/links" element={<LinksPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
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
      applyDisplaySettings({
        fontSizePx: getSetting('uiFontSizePx'),
        defaultFontSizePx: DEFAULT_UI_FONT_SIZE_PX,
        fontBold: getSetting('uiFontBold'),
        uiTheme: getSetting('uiTheme'),
      });
    };

    applySettings();
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, applySettings);
    window.addEventListener('storage', applySettings);
    return () => {
      window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, applySettings);
      window.removeEventListener('storage', applySettings);
    };
  }, []);

  return (
    <TrainerAppLayout
      navbar={<Navbar />}
      footer={{
        appName: 'VisionTrainer',
        hubHref: siteUrls.hub,
        privacyHref: `${siteUrls.hub}/privacy/`,
        labels: footerLabels,
      }}
    >
      <Outlet />
    </TrainerAppLayout>
  );
}
