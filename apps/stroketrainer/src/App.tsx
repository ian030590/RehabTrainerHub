import { Suspense, lazy, useLayoutEffect } from 'react';
import { RehabFooter } from '@rehab-trainer/ui/components/RehabFooter';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { useT } from './i18n';
import {
  DEFAULT_UI_FONT_SIZE_PX,
  SETTINGS_CHANGED_EVENT,
  getSetting,
} from './utils/settings';

const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const TrainingPage = lazy(() => import('./pages/training/TrainingPage').then((module) => ({ default: module.TrainingPage })));
const MotorTraining = lazy(() => import('./pages/training/MotorTraining').then((module) => ({ default: module.MotorTraining })));
const CognitiveTraining = lazy(() => import('./pages/training/CognitiveTraining').then((module) => ({ default: module.CognitiveTraining })));
const SpeechTraining = lazy(() => import('./pages/training/SpeechTraining').then((module) => ({ default: module.SpeechTraining })));
const CreditsPage = lazy(() => import('./pages/credits/CreditsPage').then((module) => ({ default: module.CreditsPage })));
const LinksPage = lazy(() => import('./pages/links/LinksPage').then((module) => ({ default: module.LinksPage })));

export function App() {
  return (
    <Suspense fallback={<div className="app-loading" />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/motor-training" replace />} />
          <Route path="/motor-training" element={<MotorTraining />} />
          <Route path="/cognitive-training" element={<CognitiveTraining />} />
          <Route path="/speech-training" element={<SpeechTraining />} />
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

function AppLayout() {
  const { t } = useT();

  useLayoutEffect(() => {
    const applyFontSettings = () => {
      const fontSizePx = getSetting('uiFontSizePx');
      const fontScale = fontSizePx / DEFAULT_UI_FONT_SIZE_PX;
      const isBold = getSetting('uiFontBold');
      document.documentElement.style.setProperty('--ui-font-size', `${fontSizePx}px`);
      document.documentElement.style.setProperty('--ui-font-scale', String(fontScale));
      document.documentElement.style.setProperty('--ui-font-weight', isBold ? '700' : '400');
      document.documentElement.style.setProperty('--ui-font-medium-weight', isBold ? '800' : '600');
      document.documentElement.style.setProperty('--ui-font-heading-weight', isBold ? '900' : '700');
      document.body.dataset.uiFontBold = isBold ? 'true' : 'false';
      document.body.dataset.uiFontSize = String(fontSizePx);
    };

    applyFontSettings();
    window.addEventListener(SETTINGS_CHANGED_EVENT, applyFontSettings);
    window.addEventListener('storage', applyFontSettings);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, applyFontSettings);
      window.removeEventListener('storage', applyFontSettings);
    };
  }, []);

  return (
    <div className="app-layout">
      <Navbar />
      <Outlet />
      <RehabFooter
        appName="StrokeTrainer"
        hubHref="../"
        repoHref="https://github.com/ian030590/RehabTrainerHub"
        labels={{ rights: t('app.footer.rights') }}
      />
    </div>
  );
}
