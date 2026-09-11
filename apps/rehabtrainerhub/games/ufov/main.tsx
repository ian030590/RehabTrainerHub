import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { OfficialGameShell } from '@rehab-trainer/ui/components/OfficialGameShell';
import '@rehab-trainer/ui/components/TrainerApp.css';
import './rules.css';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import { GetHostedGameSetting, InstallHostedGameSettingsReceiver, RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
import { LanguageProvider, useT } from '@rehab-trainer/ui/i18n/games';
import React, { useState } from 'react';
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
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const [phase, setPhase] = useState<'rules' | 'playing'>('rules');
  const isZh = lang !== 'en';
  const subtestId = GetHostedGameSetting<1 | 2 | 3>('subtestId');
  const mode = GetHostedGameSetting<'instruction' | 'practice' | 'formal'>('mode');

  const subtestLabels: Record<number, string> = {
    1: isZh ? 'Subtest 1 處理速度' : 'Subtest 1 Processing Speed',
    2: isZh ? 'Subtest 2 分散注意力' : 'Subtest 2 Divided Attention',
    3: isZh ? 'Subtest 3 選擇性注意力' : 'Subtest 3 Selective Attention',
  };
  const modeLabels: Record<string, string> = {
    formal: isZh ? '正式模式' : 'Formal',
    practice: isZh ? '練習模式' : 'Practice',
    instruction: isZh ? '說明模式' : 'Instruction',
  };

  return (
    <div ref={fullscreenRootRef} className="ufov-game-root" style={{ width: '100%', minHeight: '100dvh' }}>
      {phase === 'rules' && (
        <div className="training-panel">
          <TrainingRulesPanel
            title={isZh ? '有效視野注意力評估 (UFOV)' : 'Useful Field of View (UFOV)'}
            label={isZh ? '遊戲規則說明' : 'Game Rules'}
            summaryTitle={isZh ? '有效視野注意力評估' : 'UFOV Attention'}
            summaryItems={[
              { label: isZh ? '訓練項目' : 'Subtest', value: subtestLabels[subtestId] ?? `Subtest ${subtestId}` },
              { label: isZh ? '活動模式' : 'Mode', value: modeLabels[mode] ?? mode },
            ]}
            sections={isZh ? [
              {
                title: '測驗與玩法說明',
                description: '評估中央與周邊視野之視覺資訊處理速度與注意力分配。',
                items: [
                  'Subtest 1：短暫閃現後，辨認中央出現的車輛是汽車（Car）或卡車（Truck）。',
                  'Subtest 2：同時辨認中央車輛類型，並指出周邊目標在 8 個方位中的出現方向。',
                  'Subtest 3：在眾多三角形干擾物中，找出周邊目標方向並辨識中央車輛。',
                  '刺激呈現僅數十至數百毫秒，請在閃爍遮罩後點擊回答。',
                ],
              },
              {
                title: '成績計算',
                description: '自適應階梯法估算能達到 80% 正確率的臨界曝光時間（毫秒），曝光時間越短代表處理速度越佳。',
              },
            ] : [
              {
                title: 'How to Play',
                description: 'Measures visual processing speed, divided attention, and selective attention.',
                items: [
                  'Subtest 1: Identify whether the center stimulus is a Car or Truck.',
                  'Subtest 2: Identify center vehicle AND locate the peripheral car direction.',
                  'Subtest 3: Locate the peripheral car among visual distractors AND identify center vehicle.',
                  'Stimuli flash briefly followed by a noise mask; select your answers on screen.',
                ],
              },
              {
                title: 'Results',
                description: 'Estimates 80% accuracy threshold exposure duration in milliseconds (shorter is faster).',
              },
            ]}
            startLabel={isZh ? '開始訓練' : 'Start Training'}
            backLabel={isZh ? '回設定' : 'Back to Settings'}
            onStart={async () => {
              await enterTrainingFullscreen();
              setPhase('playing');
            }}
            onBack={() => RequestHubTrainingConfiguration()}
          />
        </div>
      )}

      {phase === 'playing' && (
        <PeripheralAttentionPage
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
        />
      )}
    </div>
  );
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
