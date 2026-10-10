import './game.css';
import './rules.css';
import './results.css';
import { ExitGame, InstallHubBridge } from './runtime/hubBridge';
import { LanguageProvider } from './i18n/useT';
import ReactDOM from 'react-dom/client';
import { MotorCortexRehabGame } from './MotorCortexRehabGame';

InstallHubBridge();
const root = document.getElementById('root');
if (root) ReactDOM.createRoot(root).render(<LanguageProvider><MotorCortexRehabGame onExit={ExitGame} /></LanguageProvider>);
