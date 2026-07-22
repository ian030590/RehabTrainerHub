import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ApplyThemeTokens, type TrainerThemeOverrides } from '@rehab-trainer/ui/trainerTheme';
import { App } from './App';
import { LanguageProvider } from './i18n';
import 'jspsych/css/jspsych.css';
import '@rehab-trainer/ui/components/GridPageLayout.css';
import '@rehab-trainer/ui/components/TrainerApp.css';
import './index.css';

const mouthTheme: TrainerThemeOverrides = {
  '--bg': '#F7F3FC',
  '--bg-panel': '#FBF9FF',
  '--bg-card-hover': '#F5F0FF',
  '--accent': '#6D28D9',
  '--accent-dark': '#5B21B6',
  '--accent-hover': '#7C3AED',
  '--success': '#6D28D9',
  '--bg-accent-soft': 'rgba(109, 40, 217, 0.09)',
  '--bg-accent-soft-hover': 'rgba(109, 40, 217, 0.15)',
  '--shadow-ambient': '0 4px 20px rgba(109, 40, 217, 0.1)',
  '--theme-dark-bg': '#171126',
  '--theme-dark-bg-panel': '#211735',
  '--theme-dark-bg-card': '#2B1D44',
  '--theme-dark-bg-card-hover': '#382558',
  '--theme-dark-accent': '#C4B5FD',
  '--theme-dark-accent-dark': '#DDD6FE',
  '--theme-dark-accent-hover': '#D8B4FE',
  '--theme-dark-success': '#C4B5FD',
  '--theme-dark-bg-accent-soft': 'rgba(196, 181, 253, 0.16)',
};

ApplyThemeTokens(document.documentElement, mouthTheme);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root was not found.');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HashRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </HashRouter>
  </React.StrictMode>,
);
