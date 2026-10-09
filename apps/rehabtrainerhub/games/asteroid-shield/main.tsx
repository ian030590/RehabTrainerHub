import './game.css';
import './rules.css';
import './results.css';
// Pixi's installed static polyfills replace generated functions; runner CSP stays unchanged.
// Verified in node_modules/pixi.js/lib/unsafe-eval/init.mjs and migration plan section 6.
import 'pixi.js/unsafe-eval';
import { ExitGame, InstallHubBridge } from './runtime/hubBridge';
import { LanguageProvider } from './i18n/useT';
import ReactDOM from 'react-dom/client';
import { AsteroidShieldGame } from './AsteroidShieldGame';
InstallHubBridge();
const rootElement = document.getElementById('root');
if (rootElement) ReactDOM.createRoot(rootElement).render(
  <LanguageProvider><AsteroidShieldGame onExit={ExitGame}/></LanguageProvider>,
);
