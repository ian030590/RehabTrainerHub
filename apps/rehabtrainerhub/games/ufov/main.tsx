import { OfficialGameShell } from '@rehab-trainer/ui/components/OfficialGameShell';
import '@rehab-trainer/ui/components/TrainerApp.css';
import { GetHostedGameSetting, InstallHostedGameSettingsReceiver } from '@rehab-trainer/ui/embeddedTraining';
import { LanguageProvider, useT } from '@rehab-trainer/ui/i18n/games';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { dictionaries } from './i18n';
import { PeripheralAttentionPage } from './PeripheralAttentionPage';
import { SaveTrainingRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import settings from './settings.json';
import score from './score.json';

InstallHostedGameSettingsReceiver();

function UfovGame() {
  const { lang } = useT();
  return <PeripheralAttentionPage
    appName="UFOV" backPath="/" lang={lang} moduleId="ufov" autoStart
    onSaveRecord={SaveTrainingRecord}
    initialSubtestId={GetHostedGameSetting<1 | 2 | 3>('subtestId')}
    initialMode={GetHostedGameSetting<'instruction' | 'practice' | 'formal'>('mode')}
    trialCount={GetHostedGameSetting<number>('trialCount')}
    stopCondition={GetHostedGameSetting<'adaptive_80' | 'fixed_trials'>('stopCondition')}
    contrastPercent={GetHostedGameSetting<number>('contrastPercent')}
    targetVisualAngleDeg={GetHostedGameSetting<number>('targetVisualAngleDeg')}
    vehicleVisualAngleDeg={GetHostedGameSetting<number>('vehicleVisualAngleDeg')}
    screenWidthCm={GetHostedGameSetting<number>('screenWidthCm')}
    screenHeightCm={GetHostedGameSetting<number>('screenHeightCm')}
    viewingDistanceCm={GetHostedGameSetting<number>('viewingDistanceCm')}
    targetAxes={([0, 1, 2, 3, 4, 5, 6, 7] as const).filter((axis) => GetHostedGameSetting<boolean>(`axis${axis}Enabled`))}
  />;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <HashRouter>
        <LanguageProvider dictionaries={dictionaries}>
          <OfficialGameShell settings={settings} score={score} title={document.title}>
            <UfovGame />
          </OfficialGameShell>
        </LanguageProvider>
      </HashRouter>
    </React.StrictMode>,
  );
}
