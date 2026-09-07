import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { InstallHostedGameSettingsReceiver } from '@rehab-trainer/ui/embeddedTraining';
import { LanguageProvider } from '@rehab-trainer/ui/i18n/games';
import { AntisaccadeGame } from './AntisaccadeGame';
import '@rehab-trainer/ui/components/TrainerApp.css';

InstallHostedGameSettingsReceiver();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <HashRouter>
        <LanguageProvider>
          <AntisaccadeGame onExit={() => window.history.back()} />
        </LanguageProvider>
      </HashRouter>
    </React.StrictMode>,
  );
}
