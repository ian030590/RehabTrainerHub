import ReactDOM from 'react-dom/client';
import { BrakeReactionGame } from './BrakeReactionGame';
import { LanguageProvider } from './i18n/useT';
import { InstallHubBridge } from './runtime/hubBridge';
import './game.css';
import './rules.css';
import './results.css';

InstallHubBridge();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <LanguageProvider><BrakeReactionGame /></LanguageProvider>,
);
