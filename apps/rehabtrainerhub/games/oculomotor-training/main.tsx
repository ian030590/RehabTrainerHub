import React from 'react';
import ReactDOM from 'react-dom/client';
import { LanguageProvider } from './i18n/useT';
import { InstallHubBridge } from './runtime/hubBridge';
import { InstallEyeInput } from './runtime/experiment';
import { OculomotorTrainingGame } from './OculomotorTrainingGame';
import './game.css';
import './rules.css';
import './results.css';

InstallHubBridge();
InstallEyeInput();
const root = document.getElementById('root');
if (root) ReactDOM.createRoot(root).render(<React.StrictMode><LanguageProvider><OculomotorTrainingGame /></LanguageProvider></React.StrictMode>);
