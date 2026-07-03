import { Suspense, lazy } from 'react';
import { RehabFooter } from '@rehab-trainer/ui/components/RehabFooter';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { useT } from './i18n';
import { siteUrls } from './utils/siteUrls';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const TrainingPage = lazy(() => import('./pages/training/TrainingPage').then((module) => ({ default: module.TrainingPage })));
const AssessmentPage = lazy(() => import('./pages/assessment/AssessmentPage').then((module) => ({ default: module.AssessmentPage })));
const AcuityTestPage = lazy(() => import('./pages/assessment/AcuityTestPage').then((module) => ({ default: module.AcuityTestPage })));
const ContrastTestPage = lazy(() => import('./pages/assessment/ContrastTestPage').then((module) => ({ default: module.ContrastTestPage })));
const CreditsPage = lazy(() => import('./pages/credits/CreditsPage').then((module) => ({ default: module.CreditsPage })));
const LinksPage = lazy(() => import('./pages/links/LinksPage').then((module) => ({ default: module.LinksPage })));
const HartChartPage = lazy(() => import('./pages/training/HartChartPage').then((module) => ({ default: module.HartChartPage })));
const HartChartDisplayPage = lazy(() => import('./pages/training/HartChartPage').then((module) => ({ default: module.HartChartDisplayPage })));

export function App() {
  const { t } = useT();

  return (
    <Suspense fallback={<AppLoading label={t('app.loading')} />}>
      <Routes>
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/acuity-test" element={<AcuityTestPage />} />
        <Route path="/contrast-test" element={<ContrastTestPage />} />
        <Route path="/hart-chart" element={<HartChartPage />} />
        <Route path="/hart-chart/display" element={<HartChartDisplayPage />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/assessment" element={<AssessmentPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/links" element={<LinksPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function AppLoading({ label }: { label: string }) {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <div className="app-loading-indicator" />
      <div className="app-loading-text">{label}</div>
    </div>
  );
}

function AppLayout() {
  return (
    <div className="app-layout">
      <Navbar />
      <Outlet />
      <RehabFooter
        appName="VisionTrainer"
        hubHref={siteUrls.hub}
        privacyHref={`${siteUrls.hub}/privacy/`}
        labels={{ privacy: '隱私權政策' }}
      />
    </div>
  );
}
