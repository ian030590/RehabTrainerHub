import { lazy, Suspense, useLayoutEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { TrainerAppLayout } from '@rehab-trainer/ui/components/TrainerAppLayout';
import { TrainingLoginReminder } from '@rehab-trainer/ui/components/TrainingLoginReminder';
import { ApplyDisplaySettings } from '@rehab-trainer/ui/settings/displaySettings';
import { Navbar } from './components/Navbar';
import { useT } from './i18n';
import { ComprehensionTraining } from './pages/ComprehensionTraining';
import { OralTraining } from './pages/training/OralTraining';
import { SpeechTraining } from './pages/training/SpeechTraining';
import { defaultUiFontSizePx, GetSetting, settingsChangedEvent } from './utils/settings';
import { siteUrls } from './utils/siteUrls';

const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const ReferencesPage = lazy(() => import('./pages/ReferencesPage').then((module) => ({ default: module.ReferencesPage })));
const LinksPage = lazy(() => import('./pages/links/LinksPage').then((module) => ({ default: module.LinksPage })));

export function App() {
  const { lang, t } = useT();
  const location = useLocation();
  const isTraining = ['/speech-training', '/comprehension-training', '/oral-training'].includes(location.pathname);
  return <Suspense fallback={<AppLoading label={t('app.loading')} />}><TrainingLoginReminder active={isTraining} apiBase={siteUrls.hub} appName="MouthTrainer" locale={lang === 'en' ? 'en' : 'zh-TW'} privacyHref={`${siteUrls.hub}/privacy/`} /><Routes><Route element={<AppLayout />}><Route path="/" element={<Navigate to="/speech-training" replace />} /><Route path="/speech-training" element={<SpeechTraining />} /><Route path="/comprehension-training" element={<ComprehensionTraining />} /><Route path="/oral-training" element={<OralTraining />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/references" element={<ReferencesPage />} /><Route path="/links" element={<LinksPage />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></Suspense>;
}

function AppLayout() {
  const { lang } = useT();
  useLayoutEffect(() => {
    const applySettings = () => ApplyDisplaySettings({ fontSizePx: GetSetting('uiFontSizePx'), defaultFontSizePx: defaultUiFontSizePx, fontBold: GetSetting('uiFontBold'), uiTheme: GetSetting('uiTheme') });
    applySettings();
    window.addEventListener(settingsChangedEvent, applySettings);
    window.addEventListener('storage', applySettings);
    return () => { window.removeEventListener(settingsChangedEvent, applySettings); window.removeEventListener('storage', applySettings); };
  }, []);
  const labels = lang === 'en' ? { hub: 'Hub', privacy: 'Privacy', repo: 'GitHub', disclaimer: 'For rehabilitation practice workflow prototyping, not medical advice.', rights: 'All rights reserved.' } : { hub: 'Hub', privacy: '隱私權', repo: 'GitHub', disclaimer: '本網站供復健練習流程原型使用，不提供醫療建議。', rights: '版權所有。' };
  return <TrainerAppLayout navbar={<Navbar />} skipLinkLabel={lang === 'en' ? 'Skip to content' : '跳至主要內容'} footer={{ appName: 'MouthTrainer', hubHref: siteUrls.hub, privacyHref: `${siteUrls.hub}/privacy/`, repoHref: 'https://github.com/ian030590/RehabTrainerHub', labels }}><Outlet /></TrainerAppLayout>;
}
