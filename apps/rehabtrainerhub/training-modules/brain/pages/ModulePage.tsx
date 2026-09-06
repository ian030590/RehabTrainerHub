// Canonical Hub-owned brain module dispatcher.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLoading } from '@rehab-trainer/ui/components/AppLoading';
import { ConfigDialog } from '@rehab-trainer/ui/components/ConfigDialog';
import { TrainingConfigNavigationActions } from '@rehab-trainer/ui/components/TrainingConfigNavigationActions';
import {
  PeripheralAttentionContrastSlider,
  PeripheralAttentionEccentricitySlider,
  PeripheralAttentionGeometryWarning,
  PeripheralAttentionNineGridCompass,
  PeripheralAttentionVehicleAngleSlider,
} from '@rehab-trainer/ui/components/PeripheralAttentionConfigComponents';
import { SelectionCard } from '@rehab-trainer/ui/components/SelectionCard';
import {
  TrainingConfigOptionGroup,
  TrainingConfigSection,
} from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingSlider } from '@rehab-trainer/ui/components/TrainingConfigRangeField';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import { DetectDisplayDeviceKind } from '@rehab-trainer/ui/displayTiming';
import { EnterFullscreenFromUserGesture } from '@rehab-trainer/ui/fullscreen';
import { useRoutedTrainingModule } from '@rehab-trainer/ui/hooks/useRoutedTrainingModule';
import { useTrainingConfigReady } from '@rehab-trainer/ui/hooks/useTrainingConfigReady';
import { useHostedGameSettings } from '@rehab-trainer/ui/hooks/useHostedGameSettings';
import { trainingFlowLaunchState } from '@rehab-trainer/ui/trainingFlow';
import { GetTrainingCatalogModules } from '@rehab-trainer/hub-modules/catalog';
import { IsEmbeddedHubTraining, NotifyHubTrainingExit } from '@rehab-trainer/ui/embeddedTraining';
import { GetPeripheralAttentionConfigLabels } from '@rehab-trainer/ui/i18n/peripheralAttention';
import { CalculatePeripheralAttentionScreenGeometry } from '@rehab-trainer/ui/peripheralAttentionCanvas';
import { useT, type TranslationKey } from '../i18n';
import { GetReferenceCognitiveModules } from './thinking/cognitive/constants';
import type { ReferenceGameId } from './thinking/cognitive/types';
import type { PeripheralAttentionStopCondition, SubtestId, UfovRunMode, UfovTargetAxis } from './peripheral-attention/PeripheralAttentionPage';

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
    setIsUfovConfigOpen(false);
    setIsUfovRulesOpen(true);
  }, [hostedSettings, isUfovRequested]);

  const handleStartUfov = async () => {
    await EnterFullscreenFromUserGesture(document.documentElement);
    setIsUfovConfigOpen(false);
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
        setIsUfovRulesOpen(false);
        setIsUfovConfigOpen(true);
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
      {isUfovConfigOpen && (
        <ConfigDialog
          ariaLabel={ufovLabels.settingsTitle}
          onClose={closeUfovConfig}
          summaryItems={[
            { value: `${lang === 'en' ? 'Subject' : '受試者'}: ${subjectId || '--'}` },
            { value: ufovLabels.subtests[selectedUfovSubtest] },
            { value: ufovLabels.modes[selectedUfovMode].label },
            { value: `${selectedUfovAxes.length}/8` },
            { value: selectedUfovStopCondition === 'adaptive_80' ? '80%' : String(ufovTrialCount) },
            { value: `${ufovContrastPercent}% · ${ufovTargetVisualAngleDeg.toFixed(1)}° · ${ufovVehicleVisualAngleDeg.toFixed(1)}°` },
            { value: `${ufovScreenWidthCm.toFixed(1)} × ${ufovScreenHeightCm.toFixed(1)} cm · ${ufovViewingDistanceCm} cm` },
          ]}
          actions={(
            <TrainingConfigNavigationActions
              cancelLabel={ufovLabels.cancel}
              nextLabel={ruleLabels.next}
              onCancel={closeUfovConfig}
              onNext={() => {
                setIsUfovConfigOpen(false);
                setIsUfovRulesOpen(true);
              }}
            />
          )}
        >
          <TrainingConfigSection
            title={lang === 'en' ? 'Subject ID' : '受試者代號 (Subject ID)'}
            description={lang === 'en'
              ? 'Identifier for this participant; will be included in exported records and CSV reports.'
              : '輸入受試者識別碼，將自動記錄於測驗報告與匯出之 CSV / JSON 數據中。'}
            value={subjectId}
            wide
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="training-number-input"
                style={{ flex: 1, height: '40px' }}
                value={subjectId}
                onChange={(e) => {
                  const next = e.target.value;
                  setSubjectId(next);
                  try {
                    if (next.trim()) localStorage.setItem('ufov-subject-id-v1', next.trim());
                  } catch {}
                }}
                placeholder={lang === 'en' ? 'Enter Subject ID...' : '請輸入受試者代號...'}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '40px', whiteSpace: 'nowrap' }}
                onClick={() => {
                  const next = 'SUBJ_' + Math.random().toString(36).slice(2, 8).toUpperCase();
                  setSubjectId(next);
                  try {
                    localStorage.setItem('ufov-subject-id-v1', next);
                  } catch {}
                }}
              >
                {lang === 'en' ? 'Random ID' : '隨機產生'}
              </button>
            </div>
          </TrainingConfigSection>

          <TrainingConfigSection
            title={ufovLabels.chooseSubtest}
            value={ufovLabels.subtests[selectedUfovSubtest]}
          >
            <TrainingConfigOptionGroup columns={3}>
              {ufovSubtests.map((subtestId) => {
                const subtestBlocked = isSmallScreenDevice && subtestId !== 1;
                return (
                  <button
                    className={`training-option ${selectedUfovSubtest === subtestId ? 'active' : ''}`}
                    disabled={subtestBlocked}
                    key={subtestId}
                    onClick={() => setSelectedUfovSubtest(subtestId)}
                    type="button"
                  >
                    <span className="training-option-title">{ufovLabels.subtests[subtestId]}</span>
                    <span className="training-option-meta">
                      {subtestBlocked ? ufovLabels.subtestUnavailable : ufovLabels.instructions[subtestId]}
                    </span>
                  </button>
                );
              })}
            </TrainingConfigOptionGroup>
          </TrainingConfigSection>

          {selectedUfovMode === 'formal' && (
            <TrainingConfigSection title={lang === 'en' ? 'Stopping condition' : '終止條件'}>
              <TrainingConfigOptionGroup columns={2}>
                <button className={`training-option ${selectedUfovStopCondition === 'adaptive_80' ? 'active' : ''}`} onClick={() => setSelectedUfovStopCondition('adaptive_80')} type="button">
                  <span className="training-option-title">{lang === 'en' ? '80% confidence threshold' : '信度 80% 門檻'}</span>
                  <span className="training-option-meta">{lang === 'en' ? 'Adaptive staircase; ends on a stable threshold.' : '自適應階梯法；門檻穩定後結束。'}</span>
                </button>
                <button className={`training-option ${selectedUfovStopCondition === 'fixed_trials' ? 'active' : ''}`} onClick={() => setSelectedUfovStopCondition('fixed_trials')} type="button">
                  <span className="training-option-title">{lang === 'en' ? 'Fixed trial count' : '固定題數'}</span>
                  <span className="training-option-meta">{lang === 'en' ? 'Ends after the standard 48 recorded trials.' : '完成標準 48 題紀錄後結束。'}</span>
                </button>
              </TrainingConfigOptionGroup>
              {selectedUfovStopCondition === 'fixed_trials' && (
                <TrainingSlider
                  label={lang === 'en' ? 'Recorded trials' : '紀錄題數'}
                  value={ufovTrialCount}
                  valueLabel={`${ufovTrialCount} ${lang === 'en' ? 'trials' : '題'}`}
                  min={1}
                  max={240}
                  step={1}
                  onValueChange={setUfovTrialCount}
                />
              )}
            </TrainingConfigSection>
          )}

          <TrainingConfigSection
            title={ufovLabels.chooseDirections}
            value={`${selectedUfovAxes.length}/8`}
            wide
          >
            <PeripheralAttentionNineGridCompass
              lang={lang}
              selectedAxes={selectedUfovAxes}
              onChange={setSelectedUfovAxes}
              labels={ufovLabels}
            />
          </TrainingConfigSection>

          <TrainingConfigSection
            title={ufovLabels.chooseMode}
            value={ufovLabels.modes[selectedUfovMode].label}
          >
            <TrainingConfigOptionGroup columns={3}>
              {ufovRunModes.map((mode) => (
                <button
                  className={`training-option ${selectedUfovMode === mode ? 'active' : ''}`}
                  key={mode}
                  onClick={() => setSelectedUfovMode(mode)}
                  type="button"
                >
                  <span className="training-option-title">{ufovLabels.modes[mode].label}</span>
                  <span className="training-option-meta">{ufovLabels.modes[mode].description}</span>
                </button>
              ))}
            </TrainingConfigOptionGroup>
          </TrainingConfigSection>

          <TrainingConfigSection
            title={lang === 'en' ? 'Screen size and viewing distance' : '螢幕尺寸與觀看距離校準'}
            description={lang === 'en'
              ? 'These values convert the stimulus position and size into visual-angle references; they are not a visual-field measurement.'
              : '這些設定只用於換算刺激位置與大小的視角參考值，不代表視野量測。'}
            value={`${ufovScreenWidthCm.toFixed(1)} × ${ufovScreenHeightCm.toFixed(1)} cm · ${ufovViewingDistanceCm} cm`}
            wide
          >
            <TrainingSlider
              label={lang === 'en' ? 'Display width' : '螢幕顯示寬度'}
              value={ufovScreenWidthCm}
              valueLabel={`${ufovScreenWidthCm.toFixed(1)} cm`}
              min={10}
              max={250}
              step={0.1}
              onValueChange={setUfovScreenWidthCm}
            />
            <TrainingSlider
              label={lang === 'en' ? 'Display height' : '螢幕顯示高度'}
              value={ufovScreenHeightCm}
              valueLabel={`${ufovScreenHeightCm.toFixed(1)} cm`}
              min={10}
              max={200}
              step={0.1}
              onValueChange={setUfovScreenHeightCm}
            />
            <TrainingSlider
              label={lang === 'en' ? 'Viewing distance' : '觀看距離'}
              value={ufovViewingDistanceCm}
              valueLabel={`${ufovViewingDistanceCm} cm`}
              min={20}
              max={300}
              step={1}
              onValueChange={setUfovViewingDistanceCm}
            />
            <PeripheralAttentionGeometryWarning
              geometry={ufovGeometry}
              targetAngle={ufovTargetVisualAngleDeg}
              lang={lang}
            />
          </TrainingConfigSection>

          <TrainingConfigSection title={ufovLabels.anglesTitle} wide>
            <PeripheralAttentionEccentricitySlider
              lang={lang}
              value={ufovTargetVisualAngleDeg}
              onChange={setUfovTargetVisualAngleDeg}
            />
            <PeripheralAttentionVehicleAngleSlider
              lang={lang}
              value={ufovVehicleVisualAngleDeg}
              onChange={setUfovVehicleVisualAngleDeg}
            />
            <PeripheralAttentionContrastSlider
              lang={lang}
              value={ufovContrastPercent}
              onChange={setUfovContrastPercent}
            />
          </TrainingConfigSection>

        </ConfigDialog>
      )}
      {isUfovRulesOpen && (
        <div
          className="config-modal-overlay fade-in"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsUfovRulesOpen(false);
              setIsUfovConfigOpen(true);
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
            onBack={() => {
              setIsUfovRulesOpen(false);
              setIsUfovConfigOpen(true);
            }}
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
