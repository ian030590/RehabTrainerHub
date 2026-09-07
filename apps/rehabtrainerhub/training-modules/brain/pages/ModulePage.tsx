// Canonical Hub-owned brain module dispatcher.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { SelectionCard } from '@rehab-trainer/ui/components/SelectionCard';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import { DetectDisplayDeviceKind } from '@rehab-trainer/ui/displayTiming';
import { EnterFullscreenFromUserGesture } from '@rehab-trainer/ui/fullscreen';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import { useTrainingConfigReady } from '@rehab-trainer/ui/hooks/useTrainingConfigReady';
import { useHostedGameSettings } from '@rehab-trainer/ui/hooks/useHostedGameSettings';
import { trainingFlowLaunchState } from '@rehab-trainer/ui/trainingFlow';
import { GetTrainingCatalogModules } from '@rehab-trainer/hub-modules/catalog';
import {
  IsEmbeddedHubTraining,
  NotifyHubTrainingExit,
  RequestHubTrainingConfiguration,
} from '@rehab-trainer/ui/embeddedTraining';
import { GetPeripheralAttentionConfigLabels } from '@rehab-trainer/ui/i18n/peripheralAttention';
const LoadReferenceCognitiveGame = () => import('./thinking/ReferenceCognitiveGame');
const LoadEveryBallResponsePage = () => import('./EveryBallResponsePage');
const LoadUfovPage = () => import('./PeripheralAttentionPage');
const ReferenceCognitiveGame = lazy(() => LoadReferenceCognitiveGame().then((module) => ({ default: module.ReferenceCognitiveGame })));
const EveryBallResponsePage = lazy(() => LoadEveryBallResponsePage().then((module) => ({ default: module.EveryBallResponsePage })));

export type ModuleId = 'attention' | 'memory';
type ModuleGameId = ReferenceGameId | 'every-ball-response';

interface ModuleCardDefinition {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  imagePath: string;
  to?: string;
  gameId?: ModuleGameId;
}

interface ModuleDefinition {
  id: ModuleId;
  titleKey: TranslationKey;
  introKey: TranslationKey;
  cards: ModuleCardDefinition[];
}

function GetCatalogRouteCards(purpose: 'attention' | 'memory'): ModuleCardDefinition[] {
  return GetTrainingCatalogModules({
    trainer: 'brain',
    purpose,
    kind: 'brain-route',
  }).map((module) => ({
    titleKey: module.titleKey as TranslationKey,
    bodyKey: module.descriptionKey as TranslationKey,
    imagePath: module.imagePath,
    to: module.entryPath,
    gameId: module.runtimeId === 'every-ball-response' ? 'every-ball-response' : undefined,
  }));
}

const modules: ModuleDefinition[] = [
  {
    id: 'attention',
    titleKey: 'module.attention.title',
    introKey: 'module.attention.intro',
    cards: GetCatalogRouteCards('attention'),
  },
  {
    id: 'memory',
    titleKey: 'module.memory.title',
    introKey: 'module.memory.intro',
    cards: GetCatalogRouteCards('memory'),
  },
];

function GetModule(moduleId: ModuleId) {
  return modules.find((module) => module.id === moduleId) ?? modules[0];
}

export function ModulePage({ moduleId }: { moduleId: ModuleId }) {
  const { lang, t } = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const module = GetModule(moduleId);
  const moduleCards: ModuleCardDefinition[] = [
    ...module.cards,
    ...GetReferenceCognitiveModules(moduleId).map((game) => ({
      titleKey: game.titleKey,
      bodyKey: game.descriptionKey,
      imagePath: `/assets/training-modules/${game.id}.webp`,
      gameId: game.id,
    })),
  ];
  const requestedGameId = searchParams.get('game');
  const isUfovRequested = moduleId === 'attention' && requestedGameId === 'ufov';
  const hostedSettings = useHostedGameSettings();
  const isEmbeddedHubTraining = IsEmbeddedHubTraining();
  const hostedSettingsAppliedRef = useRef(false);
  const requestedModule = moduleCards.find((card) => card.gameId === requestedGameId)?.gameId ?? null;
  const { activeModule, openModule, closeModule } = useRoutedTrainingModule<ModuleGameId>({
    requestedModule,
    basePath: `/${moduleId}-training`,
  });
  const [isUfovConfigOpen, setIsUfovConfigOpen] = useState(false);
  const [selectedUfovSubtest, setSelectedUfovSubtest] = useState<SubtestId>(1);
  const [selectedUfovMode, setSelectedUfovMode] = useState<UfovRunMode>('formal');
  const [selectedUfovAxes, setSelectedUfovAxes] = useState<UfovTargetAxis[]>([...ufovTargetAxes]);
  const [selectedUfovStopCondition, setSelectedUfovStopCondition] = useState<PeripheralAttentionStopCondition>('adaptive_80');
  const [ufovContrastPercent, setUfovContrastPercent] = useState(100);
  const [ufovTrialCount, setUfovTrialCount] = useState(48);
  const [ufovTargetVisualAngleDeg, setUfovTargetVisualAngleDeg] = useState(15);
  const [ufovVehicleVisualAngleDeg, setUfovVehicleVisualAngleDeg] = useState(2.5);
  const [ufovScreenWidthCm, setUfovScreenWidthCm] = useState(53.1);
  const [ufovScreenHeightCm, setUfovScreenHeightCm] = useState(29.9);
  const [ufovViewingDistanceCm, setUfovViewingDistanceCm] = useState(50);
  const [subjectId, setSubjectId] = useState<string>(() => GetInitialSubjectId());
  const [isUfovRulesOpen, setIsUfovRulesOpen] = useState(false);
  useTrainingConfigReady(isUfovConfigOpen);
  const ufovLabels = {
    ...GetUfovConfigLabels(lang),
    anglesTitle: GetPeripheralAttentionConfigLabels(lang).anglesTitle,
  };
  const isSmallScreenDevice = IsMobileOrTabletDevice(DetectDisplayDeviceKind());
  const effectiveUfovSubtest = isSmallScreenDevice ? 1 : selectedUfovSubtest;
  const ufovGeometry = CalculatePeripheralAttentionScreenGeometry(
    ufovScreenWidthCm,
    ufovScreenHeightCm,
    ufovViewingDistanceCm,
    ufovTargetVisualAngleDeg,
    ufovVehicleVisualAngleDeg,
  );
  const ruleLabels = GetBrainRuleLabels(lang);

  const handleBackFromUfovRules = () => {
    if (!RequestHubTrainingConfiguration()) {
      setIsUfovRulesOpen(false);
      setIsUfovConfigOpen(false);
      navigate(`/${moduleId}-training`);
    }
  };

  const closeUfovConfig = () => {
    if (IsEmbeddedHubTraining()) {
      NotifyHubTrainingExit();
      return;
    }
    setIsUfovConfigOpen(false);
    navigate(`/${moduleId}-training`);
  };

  useEffect(() => {
    if (isUfovRequested) setIsUfovConfigOpen(true);
  }, [isUfovRequested]);

  useEffect(() => {
    if (!isUfovRequested || !hostedSettings || hostedSettingsAppliedRef.current) return;
    hostedSettingsAppliedRef.current = true;
    if (hostedSettings.subtestId === 1 || hostedSettings.subtestId === 2 || hostedSettings.subtestId === 3) {
      setSelectedUfovSubtest(hostedSettings.subtestId);
    }
    if (hostedSettings.mode === 'practice' || hostedSettings.mode === 'formal') {
      setSelectedUfovMode(hostedSettings.mode);
    }
    const hostedTrialCount = GetHostedNumber(hostedSettings, 'trialCount', 1, 240);
    if (hostedTrialCount !== null) setUfovTrialCount(Math.round(hostedTrialCount));
    if (hostedSettings.stopCondition === 'adaptive_80' || hostedSettings.stopCondition === 'fixed_trials') {
      setSelectedUfovStopCondition(hostedSettings.stopCondition);
    } else if (hostedTrialCount !== null) {
      setSelectedUfovStopCondition('fixed_trials');
    }
    const hostedAxes = ufovTargetAxes.filter((axis) => hostedSettings[`axis${axis}Enabled`] !== false);
    setSelectedUfovAxes(hostedAxes.length > 0 ? hostedAxes : [...ufovTargetAxes]);
    ApplyHostedNumber(hostedSettings, 'contrastPercent', 5, 100, setUfovContrastPercent);
    ApplyHostedNumber(hostedSettings, 'targetVisualAngleDeg', 5, 35, setUfovTargetVisualAngleDeg);
    ApplyHostedNumber(hostedSettings, 'vehicleVisualAngleDeg', .8, 5, setUfovVehicleVisualAngleDeg);
    ApplyHostedNumber(hostedSettings, 'screenWidthCm', 10, 250, setUfovScreenWidthCm);
    ApplyHostedNumber(hostedSettings, 'screenHeightCm', 10, 200, setUfovScreenHeightCm);
    ApplyHostedNumber(hostedSettings, 'viewingDistanceCm', 20, 300, setUfovViewingDistanceCm);
    setIsUfovRulesOpen(true);
  }, [hostedSettings, isUfovRequested]);

  const handleStartUfov = async () => {
    await EnterFullscreenFromUserGesture(document.documentElement);
    setIsUfovRulesOpen(false);
    navigate(`/attention-training/ufov?${new URLSearchParams({
      subtest: String(effectiveUfovSubtest),
      mode: selectedUfovMode,
      trials: String(ufovTrialCount),
      axes: selectedUfovAxes.join(','),
      stop: selectedUfovStopCondition,
      contrast: String(ufovContrastPercent),
      angle: String(ufovTargetVisualAngleDeg),
      vehicleAngle: String(ufovVehicleVisualAngleDeg),
      screenWidth: String(ufovScreenWidthCm),
      screenHeight: String(ufovScreenHeightCm),
      distance: String(ufovViewingDistanceCm),
      subject_id: subjectId,
      start: '1',
    }).toString()}`, { state: trainingFlowLaunchState });
  };

  useEffect(() => {
    if (!isUfovRulesOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleBackFromUfovRules();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUfovRulesOpen]);

  return (
    <main className="page-content training-module-selection-page" id="main-content">
      <h1 className="section-title fade-in-up" id="module-title">{t(module.titleKey)}</h1>
      <p className="section-subtitle fade-in-up">{t(module.introKey)}</p>

      <section className="selection-grid content-grid-spaced" aria-label={t(module.titleKey)}>
        {moduleCards.map((card, index) => {
          const isUfovCard = card.to === '/attention-training?game=ufov';
          const isPlayable = Boolean(card.to || card.gameId);
          return (
            <SelectionCard
              key={card.gameId ?? card.titleKey}
              title={t(card.titleKey)}
              description={t(card.bodyKey)}
              imageSrc={card.imagePath}
              index={index + 1}
              actionLabel={isPlayable ? t('btn.selectModule') : t('module.placeholderAction')}
              className={isPlayable ? '' : 'placeholder-card'}
              disabled={!isPlayable}
              isSelected={activeModule === card.gameId}
              onPreload={() => {
                const loader = isUfovCard
                  ? LoadUfovPage
                  : card.gameId === 'every-ball-response'
                    ? LoadEveryBallResponsePage
                    : LoadReferenceCognitiveGame;
                void loader().catch(() => undefined);
              }}
              onSelect={() => {
                if (card.gameId) {
                  openModule(card.gameId);
                  return;
                }
                if (!card.to) return;
                if (isUfovCard) {
                  setIsUfovConfigOpen(true);
                  return;
                }
                navigate(card.to);
              }}
            />
          );
        })}
      </section>
      <div className="training-module-overlay-content">
        <Suspense fallback={<AppLoading label={t('app.loading')} />}>
          {activeModule === 'every-ball-response'
            ? <EveryBallResponsePage onExit={closeModule} />
            : activeModule && (
              <ReferenceCognitiveGame
                gameId={activeModule}
                onExit={closeModule}
                trainingModuleId={`${moduleId}-training`}
                trainingConfigLabel={t(module.titleKey)}
              />
            )}
        </Suspense>
      </div>
      {isUfovRulesOpen && (
        <div
          className="config-modal-overlay fade-in"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleBackFromUfovRules();
            }
          }}
        >
          <TrainingRulesPanel
            className="config-modal-panel"
            label={ruleLabels.label}
            title={ufovLabels.subtests[effectiveUfovSubtest]}
            summaryTitle={ruleLabels.summary}
            summaryItems={[
              { value: ufovLabels.subtests[effectiveUfovSubtest] },
              { value: ufovLabels.modes[selectedUfovMode].label },
              { value: `${selectedUfovAxes.length}/8` },
              { value: selectedUfovStopCondition === 'adaptive_80' ? '80%' : String(ufovTrialCount) },
              { value: `${ufovContrastPercent}% · ${ufovTargetVisualAngleDeg.toFixed(1)}° · ${ufovVehicleVisualAngleDeg.toFixed(1)}°` },
              { value: `${ufovScreenWidthCm.toFixed(1)} × ${ufovScreenHeightCm.toFixed(1)} cm · ${ufovViewingDistanceCm} cm` },
            ]}
            sections={GetUfovRuleSections(lang, ufovLabels.subtests[effectiveUfovSubtest])}
            startLabel={ruleLabels.start}
            backLabel={ruleLabels.back}
            onStart={() => void handleStartUfov()}
            onBack={handleBackFromUfovRules}
            role="dialog"
            aria-modal
            aria-label={`${ufovLabels.subtests[effectiveUfovSubtest]} ${ruleLabels.label}`}
          />
        </div>
      )}
    </main>
  );
}

const ufovSubtests: SubtestId[] = [1, 2, 3];
const ufovRunModes: UfovRunMode[] = ['practice', 'formal'];
const ufovTargetAxes: UfovTargetAxis[] = [0, 1, 2, 3, 4, 5, 6, 7];

function GetHostedNumber(
  settings: Readonly<Record<string, string | number | boolean>>,
  key: string,
  minimum: number,
  maximum: number,
) {
  const value = settings[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : null;
}

function ApplyHostedNumber(
  settings: Readonly<Record<string, string | number | boolean>>,
  key: string,
  minimum: number,
  maximum: number,
  apply: (value: number) => void,
) {
  const value = GetHostedNumber(settings, key, minimum, maximum);
  if (value !== null) apply(value);
}

function IsMobileOrTabletDevice(deviceKind: ReturnType<typeof DetectDisplayDeviceKind>) {
  return deviceKind === 'phone' || deviceKind === 'tablet';
}

function GetBrainRuleLabels(lang: 'zh' | 'en') {
  return lang === 'en'
    ? {
        label: 'Game Rules',
        next: 'Rules',
        start: 'Start Training',
        back: 'Back to Settings',
        summary: 'Selected Settings',
      }
    : {
        label: '遊戲規則說明',
        next: '規則說明',
        start: '開始訓練',
        back: '回設定',
        summary: '目前設定',
      };
}

function GetUfovRuleSections(lang: 'zh' | 'en', subtestTitle: string) {
  return lang === 'en'
    ? [
        {
          title: 'Task Goal',
          description: `Complete ${subtestTitle} by identifying the central item and, when required, the peripheral direction.`,
          items: [
            'Look at the center first and identify whether the central vehicle is a car or truck.',
            'For divided or selective attention trials, also report the peripheral target direction.',
            'Practice mode gives feedback; formal mode stops early when stable or after the standard 48 recorded trials.',
          ],
        },
        {
          title: 'Results',
          description: 'The result records accuracy, processing speed, direction responses, and the actual trial count.',
        },
      ]
    : [
        {
          title: '任務目標',
          description: `完成「${subtestTitle}」，辨識中央目標，必要時同時判斷周邊目標方向。`,
          items: [
            '每題先看中央刺激，判斷中央車輛是汽車或卡車。',
            '分散注意或選擇性注意題型中，還要回報周邊目標所在方向。',
            '練習模式會提供回饋；正式模式會穩定後提前停止，或完成標準 48 題紀錄。',
          ],
        },
        {
          title: '成績計算',
          description: '結算會記錄正確率、處理速度、方向反應與本次實際題數。',
        },
      ];
}

function GetUfovConfigLabels(lang: 'zh' | 'en') {
  return lang === 'en'
    ? {
        settingsTitle: 'Peripheral Visual Field Training',
        chooseSubtest: 'Training stage',
        chooseTrialCount: 'Stopping condition',
        customTrialCount: 'Custom',
        chooseDirections: 'Peripheral stimulus directions',
        chooseMode: 'Practice flow',
        start: 'Start',
        cancel: 'Cancel',
        subtestUnavailable: 'This subtest is unavailable on this device',
        subtests: {
          1: 'Subtest 1 Processing Speed',
          2: 'Subtest 2 Divided Attention',
          3: 'Subtest 3 Selective Attention',
        },
        instructions: {
          1: 'Identify whether the center item is a car or truck.',
          2: 'Identify the center vehicle and the peripheral target direction.',
          3: 'Identify the center vehicle among distractors and the peripheral target direction.',
        },
        directions: ['Up', 'Up right', 'Right', 'Down right', 'Down', 'Down left', 'Left', 'Up left'],
        modes: {
          instruction: { label: 'Instructions', description: 'Show instructions only, without scoring.' },
          practice: { label: 'Practice', description: 'Run 5 fixed-speed practice trials with feedback.' },
          formal: { label: 'Recorded Practice', description: 'Stop when stable, or after the standard 48 recorded trials, then save results.' },
        },
      }
    : {
        settingsTitle: '周邊視野訓練',
        chooseSubtest: '訓練階段',
        chooseTrialCount: '終止條件',
        customTrialCount: '自訂',
        chooseDirections: '周邊刺激方向',
        chooseMode: '練習流程',
        start: '開始',
        cancel: '取消',
        subtestUnavailable: '此裝置無法使用這個 subtest',
        subtests: {
          1: 'Subtest 1 處理速度',
          2: 'Subtest 2 分散注意力',
          3: 'Subtest 3 選擇性注意力',
        },
        instructions: {
          1: '辨認中央目標是汽車或卡車。',
          2: '辨認中央車輛，並指出周邊目標方向。',
          3: '在干擾物中辨認中央車輛，並指出周邊目標方向。',
        },
        directions: ['上', '右上', '右', '右下', '下', '左下', '左', '左上'],
        modes: {
          instruction: { label: '說明', description: '只顯示練習說明，不計分。' },
          practice: { label: '練習', description: '以固定速度進行 5 題練習並顯示回饋。' },
          formal: { label: '紀錄練習', description: '穩定後提前停止，或完成標準 48 題紀錄後儲存結果。' },
        },
      };
}

function GetInitialSubjectId(): string {
  if (typeof window === 'undefined') return 'SUBJ_' + Math.random().toString(36).slice(2, 8).toUpperCase();
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('subject_id') || params.get('user_id') || params.get('participant');
    if (fromUrl?.trim()) return fromUrl.trim();
    const fromStorage = localStorage.getItem('ufov-subject-id-v1') || localStorage.getItem('oculomotor-subject-id-v1');
    if (fromStorage?.trim()) return fromStorage.trim();
  } catch {}
  const randomId = 'SUBJ_' + Math.random().toString(36).slice(2, 8).toUpperCase();
  try {
    localStorage.setItem('ufov-subject-id-v1', randomId);
  } catch {}
  return randomId;
}
