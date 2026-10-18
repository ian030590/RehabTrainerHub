import ReactDOM from 'react-dom/client';
import { HartChartPage } from './HartChartPage';
import { LanguageProvider } from './i18n/useT';
import { InstallHubBridge } from './runtime/hubBridge';
import './game.css';
import './styles/hart-chart.css';
import './rules.css';
import './results.css';

InstallHubBridge();
ReactDOM.createRoot(document.getElementById('root')!).render(<LanguageProvider><HartChartPage /></LanguageProvider>);
