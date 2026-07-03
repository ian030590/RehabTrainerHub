import React from 'react';
import ReactDOM from 'react-dom/client';
import { applyThemeTokens } from '@rehab-trainer/ui/trainerTheme';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { LanguageProvider } from './i18n';
import 'jspsych/css/jspsych.css';
import '@rehab-trainer/ui/components/GridPageLayout.css';
import './index.css';

applyThemeTokens();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HashRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </HashRouter>
  </React.StrictMode>
);
