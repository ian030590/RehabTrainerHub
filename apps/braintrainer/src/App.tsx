import { Suspense, lazy, useLayoutEffect } from 'react';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { TrainerAppLayout } from '@rehab-trainer/ui/components/TrainerAppLayout';
import { TrainingLoginReminder } from '@rehab-trainer/ui/components/TrainingLoginReminder';
import { applyDisplaySettings } from '@rehab-trainer/ui/settings/displaySettings';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { useT } from './i18n';
import { ModulePage } from './pages/ModulePage';
import { siteUrls } from './utils/siteUrls';
import {
  DEFAULT_UI_FONT_SIZE_PX,
  SETTINGS_CHANGED_EVENT,
  getSetting,
} from './utils/settings';

const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const ReferencesPage = lazy(() => import('./pages/ReferencesPage').then((module) => ({ default: module.ReferencesPage })));
const LinksPage = lazy(() => import('./pages/links/LinksPage').then((module) => ({ default: module.LinksPage })));
const UFOVPage = lazy(() => import('./pages/UFOVPage').then((module) => ({ default: module.UFOVPage })));
const MainConceptTraining = lazy(() => import('./pages/MainConceptTraining').then((module) => ({ default: module.MainConceptTraining })));

export function App() {
  const { lang, t } = useT();
  const location = useLocation();
  const apiBase = siteUrls.hub;
  const locale = lang === 'en' ? 'en' : 'zh-TW';
  const trainingPaths = new Set(['/', '/attention-training', '/attention-training/ufov', '/memory-training', '/thinking-training', '/thinking-training/main-concept']);

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
          <Route path="/memory-training" element={<ModulePage moduleId="memory" />} />
          <Route path="/thinking-training" element={<ModulePage moduleId="thinking" />} />
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
  const footerLabels = lang === 'en'
    ? {
        hub: 'Hub',
        privacy: 'Privacy',
        repo: 'GitHub',
        disclaimer: 'For cognitive practice workflow prototyping, not medical advice.',
        rights: 'All rights reserved.',
      }
    : {
        hub: 'Hub',
        privacy: '隱私權政策',
        repo: 'GitHub',
        disclaimer: '認知訓練流程原型，不能取代醫療建議。',
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
    window.addEventListener(SETTINGS_CHANGED_EVENT, applySettings);
    window.addEventListener('storage', applySettings);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, applySettings);
      window.removeEventListener('storage', applySettings);
    };
  }, []);

  return (
    <TrainerAppLayout
      navbar={<Navbar />}
      skipLinkLabel={lang === 'en' ? 'Skip to content' : '跳到主要內容'}
      footer={{
        appName: 'BrainTrainer',
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
