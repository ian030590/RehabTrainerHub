import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ApplyThemeTokens } from '@rehab-trainer/ui/trainerTheme';
import { App } from './App';
import { LanguageProvider } from './i18n';
import 'jspsych/css/jspsych.css';
import '@rehab-trainer/ui/components/GridPageLayout.css';
import '@rehab-trainer/ui/components/TrainerApp.css';
import './index.css';

ApplyThemeTokens();

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
