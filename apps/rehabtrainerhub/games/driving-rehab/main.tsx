import { OfficialGameShell } from '@rehab-trainer/ui/components/OfficialGameShell';
import '@rehab-trainer/ui/components/TrainerApp.css';
import { InstallHostedGameSettingsReceiver } from '@rehab-trainer/ui/embeddedTraining';
import { LanguageProvider } from '@rehab-trainer/ui/i18n/games';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { DrivingRehabGame } from './DrivingRehabGame';
import { DrivingWheelSetup } from './input/DrivingWheelSetup';
import { dictionaries } from './i18n';
import settings from './settings.json';

InstallHostedGameSettingsReceiver();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <HashRouter>
        <LanguageProvider dictionaries={dictionaries}>
          <OfficialGameShell settings={settings} title={document.title}>
          <DrivingWheelSetup><DrivingRehabGame /></DrivingWheelSetup>
          </OfficialGameShell>
        </LanguageProvider>
      </HashRouter>
    </React.StrictMode>,
  );
}
