import { Suspense, lazy, useLayoutEffect } from 'react';
import { RehabFooter } from '@rehab-trainer/ui/components/RehabFooter';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { useT } from './i18n';
import { ModulePage } from './pages/ModulePage';
import { siteUrls } from './utils/siteUrls';
import {
  DEFAULT_UI_FONT_SIZE_PX,
  SETTINGS_CHANGED_EVENT,
  getSetting,
} from './utils/settings';

const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

export function App() {
  const { t } = useT();

  return (
    <Suspense fallback={<AppLoading label={t('app.loading')} />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/attention-training" replace />} />
          <Route path="/attention-training" element={<ModulePage moduleId="attention" />} />
          <Route path="/memory-training" element={<ModulePage moduleId="memory" />} />
          <Route path="/thinking-training" element={<ModulePage moduleId="thinking" />} />
          <Route path="/settings" element={<SettingsPage />} />
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
      const fontSizePx = getSetting('uiFontSizePx');
      const fontScale = fontSizePx / DEFAULT_UI_FONT_SIZE_PX;
      const isBold = getSetting('uiFontBold');
      document.documentElement.style.setProperty('--ui-font-size', `${fontSizePx}px`);
      document.documentElement.style.setProperty('--ui-font-scale', String(fontScale));
      document.documentElement.style.setProperty('--ui-font-weight', isBold ? '700' : '500');
      document.documentElement.style.setProperty('--ui-font-medium-weight', isBold ? '800' : '700');
      document.documentElement.style.setProperty('--ui-font-heading-weight', isBold ? '900' : '800');
      document.body.dataset.uiFontBold = isBold ? 'true' : 'false';
      document.body.dataset.uiTheme = getSetting('uiTheme');
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
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        {lang === 'en' ? 'Skip to content' : '跳到主要內容'}
      </a>
      <Navbar />
      <Outlet />
      <RehabFooter
        appName="BrainTrainer"
        hubHref={siteUrls.hub}
        privacyHref={`${siteUrls.hub}/privacy/`}
        repoHref="https://github.com/ian030590/RehabTrainerHub"
        labels={footerLabels}
      />
    </div>
  );
}
