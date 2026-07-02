import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { LanguageProvider } from './i18n';
import { applyThemeTokens } from './theme';
import { initializeTrainingRecords } from './utils/trainingRecords';
import 'jspsych/css/jspsych.css';
import './index.css';

applyThemeTokens();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

void initializeTrainingRecords().catch((error) => {
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
