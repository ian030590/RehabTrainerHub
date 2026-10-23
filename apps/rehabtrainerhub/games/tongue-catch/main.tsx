import { OfficialGameShell } from '@rehab-trainer/ui/components/OfficialGameShell';
import '@rehab-trainer/ui/components/TrainerApp.css';
import './rules.css';
import { InstallHostedGameSettingsReceiver, RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
import { LanguageProvider } from '@rehab-trainer/ui/i18n/games';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { dictionaries } from './i18n';
import settings from './settings.json';
import score from './score.json';
import { TongueCatchGame } from './TongueCatchGame';

InstallHostedGameSettingsReceiver();

// Mouth-category theme tokens, as the shared mouth runtime set them before this game had its own entry.
const mouthTheme = {
  '--bg': '#F7F5F8',
  '--bg-panel': '#FBFAFC',
  '--bg-card-hover': '#F3F0F5',
  '--accent': '#6750A4',
  '--accent-dark': '#4F378B',
  '--accent-hover': '#7965AF',
  '--success': '#6750A4',
  '--bg-accent-soft': 'rgba(103, 80, 164, 0.09)',
  '--bg-accent-soft-hover': 'rgba(103, 80, 164, 0.15)',
  '--shadow-ambient': '0 4px 20px rgba(103, 80, 164, 0.1)',
  '--theme-dark-bg': '#18161B',
  '--theme-dark-bg-panel': '#211E26',
  '--theme-dark-bg-card': '#2B2732',
  '--theme-dark-bg-card-hover': '#37313F',
  '--theme-dark-accent': '#C9BEDC',
  '--theme-dark-accent-dark': '#E2DAEB',
  '--theme-dark-accent-hover': '#D5CAE3',
  '--theme-dark-success': '#C9BEDC',
  '--theme-dark-bg-accent-soft': 'rgba(201, 190, 220, 0.16)',
  '--theme-dark-logo-filter': 'brightness(1.14) contrast(1.12) saturate(0.78)',
};

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <HashRouter>
        <LanguageProvider dictionaries={dictionaries}>
          <OfficialGameShell settings={settings} score={score} theme={mouthTheme} titleKey="tongue.title">
            <TongueCatchGame onExit={() => RequestHubTrainingConfiguration()} />
          </OfficialGameShell>
        </LanguageProvider>
      </HashRouter>
    </React.StrictMode>,
  );
}
