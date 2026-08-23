import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { LanguageProvider } from './i18n';
import { ApplyThemeTokens } from './theme';
import { InitializeTrainingRecords } from './utils/trainingRecords';
import 'jspsych/css/jspsych.css';
import '@rehab-trainer/ui/components/GridPageLayout.css';
import './index.css';
import '@rehab-trainer/ui/components/TrainerApp.css';

ApplyThemeTokens();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

void InitializeTrainingRecords().catch((error) => {
  console.warn('Unable to initialize training records.', error);
});

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HashRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </HashRouter>
  </React.StrictMode>
);
