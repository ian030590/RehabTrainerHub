import './game.css';
import 'pixi.js/unsafe-eval';
import './rules.css';
import './results.css';
import { ExitGame, InstallHubBridge } from './runtime/hubBridge';
import { LanguageProvider } from './i18n/useT';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { DrawingTowerDefenseGame } from './DrawingTowerDefenseGame';

InstallHubBridge();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <LanguageProvider><DrawingTowerDefenseGame onExit={ExitGame} /></LanguageProvider>,
  );
}
