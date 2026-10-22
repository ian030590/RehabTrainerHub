import ReactDOM from 'react-dom/client';
import './game.css';
import './rules.css';
import './results.css';
import { LanguageProvider } from './i18n/useT';
import { InstallHubBridge } from './runtime/hubBridge';
import { TowerPlanning } from './TowerPlanning';

InstallHubBridge();
const rootElement = document.getElementById('root');
if (rootElement) ReactDOM.createRoot(rootElement).render(<LanguageProvider><TowerPlanning /></LanguageProvider>);
