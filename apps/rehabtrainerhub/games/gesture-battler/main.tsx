import 'pixi.js/unsafe-eval';
import './game.css';
import './rules.css';
import { ExitGame, InstallHubBridge } from './runtime/hubBridge';
import { LanguageProvider } from './i18n/useT';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { GestureBattlerGame } from './GestureBattlerGame';

InstallHubBridge();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <LanguageProvider><GestureBattlerGame onExit={ExitGame} /></LanguageProvider>,
  );
}
