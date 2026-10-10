import ReactDOM from 'react-dom/client';
import './game.css';
import './rules.css';
import './results.css';
import { LanguageProvider } from './i18n/useT';
import { InstallHubBridge } from './runtime/hubBridge';
import { MovingCardGame } from './MovingCardGame';

InstallHubBridge();
const rootElement = document.getElementById('root');
if (rootElement) ReactDOM.createRoot(rootElement).render(<LanguageProvider><MovingCardGame /></LanguageProvider>);
