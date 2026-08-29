// Canonical Hub-owned vision config and rules entry.
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ConfigDialog } from '@rehab-trainer/ui/components/ConfigDialog';
import { TrainingConfigNavigationActions } from '@rehab-trainer/ui/components/TrainingConfigNavigationActions';
import { TrainingConfigRangeField } from '@rehab-trainer/ui/components/TrainingConfigRangeField';
import { SelectionCard } from '@rehab-trainer/ui/components/SelectionCard';
import { TrainingFilePickerButton } from '@rehab-trainer/ui/components/TrainingFilePickerButton';
import {
  TrainingConfigOptionGroup,
  TrainingConfigSection,
} from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import { useTrainingConfigReady } from '@rehab-trainer/ui/hooks/useTrainingConfigReady';
import { EnterFullscreenFromUserGesture } from '@rehab-trainer/ui/fullscreen';
import { IsEmbeddedHubTraining, NotifyHubTrainingExit } from '@rehab-trainer/ui/embeddedTraining';
import { trainingFlowLaunchState } from '@rehab-trainer/ui/trainingFlow';
import {
  CreateSingleFlightPreloadCache,
} from '@rehab-trainer/training-contracts';
import { GetTrainingModuleCopy } from '@rehab-trainer/hub-modules/catalog';
import {
  GetDrivingInputCapabilitiesSnapshot,
  IsDrivingControlModeAvailable,
  IsDrivingWheelCalibrationUsable,
  useDrivingInputCapabilities,
  useDrivingWheelCalibration,
} from '../utils/drivingInputCapabilities';
import { IsCalibrated } from '../utils/settings';
import { soundManager } from '../utils/soundManager';
import { useAppSetting } from '../utils/useAppSetting';
import {
  oculomotorModes,
  oculomotorPatterns,
} from './training/oculomotor/presets';
import { trainingModules } from './home/trainingModules';
import type { TrainingModuleId } from './home/trainingModules';
import type { OculomotorPattern, OculomotorTargetShape } from './training/oculomotor/types';
import type { DrivingControlMode, DrivingRenderQualityLevel } from '../utils/settings';

const oculomotorColorOptions = [
  { value: '#FFFFFF', label: '白色' },
  { value: '#FFD166', label: '黃色' },
  { value: '#06D6A0', label: '綠色' },
  { value: '#118AB2', label: '藍色' },
  { value: '#EF476F', label: '紅色' },
  { value: '#000000', label: '黑色' },
] as const;

function PreloadTrainingRoute(): Promise<unknown> {
  return import('./training/TrainingPage');
}

async function PreloadTrainingEngine(moduleId: TrainingModuleId, signal: AbortSignal): Promise<unknown> {
  ThrowIfAborted(signal);
  if (moduleId === 'hart-chart') {
    const result = await import('./training/HartChartPage');
    ThrowIfAborted(signal);
    return result;
  }

  if (moduleId === 'driving-rehab') {
    const result = await import('../experiment/plugins/three-driving-rehab');
    ThrowIfAborted(signal);
    return result;
  }

  const { WarmUpPixiTrainingRuntime } = await import('../utils/pixiPool');
  ThrowIfAborted(signal);

  if (moduleId === 'moving-card') {
    return Promise.all([
      import('../experiment/plugins/pixi-moving-card'),
      WarmUpPixiTrainingRuntime(moduleId, signal),
    ]);
  }

  if (moduleId === 'oculomotor-training') {
    return Promise.all([
      import('../experiment/plugins/pixi-oculomotor-training'),
      WarmUpPixiTrainingRuntime(moduleId, signal),
    ]);
  }

  if (moduleId === 'gabor-patching') {
    return Promise.all([
      import('../experiment/plugins/pixi-gabor-patching'),
      WarmUpPixiTrainingRuntime(moduleId, signal),
    ]);
  }

  if (moduleId === 'reading-training') {
    return Promise.all([
      import('../experiment/plugins/pixi-reading-training'),
      WarmUpPixiTrainingRuntime(moduleId, signal),
    ]);
  }

  return Promise.resolve();
}

function ThrowIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    const error = new Error('Training engine preload was aborted.');
    error.name = 'AbortError';
    throw error;
  }
}

function DisposeTrainingEngine(moduleId: TrainingModuleId): void {
  if (!['moving-card', 'oculomotor-training', 'gabor-patching', 'reading-training'].includes(moduleId)) return;
  void import('../utils/pixiPool').then(({ DestroyPixiTrainingRuntime }) => {
    DestroyPixiTrainingRuntime(moduleId);
  }).catch(() => undefined);
}

export function HomePage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedModule = trainingModules.find(
    (module) => module.id === searchParams.get('module'),
  )?.id ?? null;

  // ── Module expansion state ──
  const [expandedModule, setExpandedModule] = useState<TrainingModuleId | null>(requestedModule);
  const [rulesModule, setRulesModule] = useState<TrainingModuleId | null>(null);
  useTrainingConfigReady(expandedModule !== null && rulesModule === null);
  const [localDifficulty, setLocalDifficulty] = useAppSetting('difficulty');
  const [localRounds, setLocalRounds] = useAppSetting('totalRounds');
  const [oculomotorMode, setOculomotorMode] = useAppSetting('oculomotorMode');
  const [oculomotorPattern, setOculomotorPattern] = useAppSetting('oculomotorPattern');
  const [oculomotorDurationSec, setOculomotorDurationSec] = useAppSetting('oculomotorDurationSec');
  const [oculomotorSpeedDegPerSec, setOculomotorSpeedDegPerSec] = useAppSetting('oculomotorSpeedDegPerSec');
  const [oculomotorTargetSizeMm, setOculomotorTargetSizeMm] = useAppSetting('oculomotorTargetSizeMm');
  const [oculomotorDistractorCount, setOculomotorDistractorCount] = useAppSetting('oculomotorDistractorCount');
  const [oculomotorTargetColor, setOculomotorTargetColor] = useAppSetting('oculomotorTargetColor');
  const [oculomotorBackgroundColor, setOculomotorBackgroundColor] = useAppSetting('oculomotorBackgroundColor');
  const [oculomotorTargetShape, setOculomotorTargetShape] = useAppSetting('oculomotorTargetShape');
  const [oculomotorCustomTargetImage, setOculomotorCustomTargetImage] = useAppSetting('oculomotorCustomTargetImage');
  const [oculomotorTargetOpacity, setOculomotorTargetOpacity] = useAppSetting('oculomotorTargetOpacity');
  const [oculomotorBackgroundImage, setOculomotorBackgroundImage] = useAppSetting('oculomotorBackgroundImage');
  const [oculomotorAudio, setOculomotorAudio] = useAppSetting('oculomotorAudio');
  const [oculomotorBounceJitter, setOculomotorBounceJitter] = useAppSetting('oculomotorBounceJitter');
  const [oculomotorEnableWebgazer, setOculomotorEnableWebgazer] = useAppSetting('oculomotorEnableWebgazer');
  const [oculomotorShowGazepoint, setOculomotorShowGazepoint] = useAppSetting('oculomotorShowGazepoint');
  const [gaborDurationSec, setGaborDurationSec] = useState(60);
  const [gaborMaxSpots, setGaborMaxSpots] = useState(10);
  const [readingWPS, setReadingWPS] = useAppSetting('readingWPS');
  const [readingCrowding, setReadingCrowding] = useAppSetting('readingCrowding');
  const [readingContrast, setReadingContrast] = useAppSetting('readingContrast');
  const [drivingRedFlashEnabled, setDrivingRedFlashEnabled] = useAppSetting('drivingRedFlashEnabled');
  const [drivingDifficulty, setDrivingDifficulty] = useAppSetting('drivingDifficulty');
  const [drivingControlMode, setDrivingControlMode] = useAppSetting('drivingControlMode');
  const [drivingRenderQuality, setDrivingRenderQuality] = useAppSetting('drivingRenderQuality');
  const [isStartingTraining, setIsStartingTraining] = useState(false);
  const drivingInputCapabilities = useDrivingInputCapabilities();
  const drivingWheelCalibration = useDrivingWheelCalibration(
    drivingInputCapabilities.wheelDevice,
  );
  const drivingControlModeAvailable = IsDrivingControlModeAvailable(
    drivingControlMode,
    drivingInputCapabilities,
  ) && (drivingControlMode !== 'wheel' || drivingWheelCalibration.calibrated);
  const rulesLabels = GetRulesLabels(lang);
  const showRulesButtonLabel = rulesLabels.next;
  const rulesStartButtonLabel = rulesLabels.start;

  // Preload the route chunk shortly after the home page is interactive.
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void PreloadTrainingRoute();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  const enginePreloadRef = useRef<ReturnType<typeof CreateSingleFlightPreloadCache> | null>(null);
  const enginePreloadCache = enginePreloadRef.current ?? CreateSingleFlightPreloadCache();
  enginePreloadRef.current = enginePreloadCache;
  const preserveEnginePreloadRef = useRef(false);

  const preloadEngineOnce = (moduleId: TrainingModuleId) => {
    return enginePreloadCache.load(
      moduleId,
      (signal) => PreloadTrainingEngine(moduleId, signal),
      { dispose: () => DisposeTrainingEngine(moduleId) },
    );
  };

  // Rules are the only normal UI transition allowed to request a heavy engine
  // chunk. Card/config rendering remains setup-only; a repeated open/close of
  // the same rules panel reuses the same preload promise.
  useEffect(() => {
    if (!rulesModule) return;
    const moduleId = rulesModule;
    void preloadEngineOnce(moduleId).catch(() => undefined);
    return () => {
      if (!preserveEnginePreloadRef.current) enginePreloadRef.current?.clear(moduleId);
      preserveEnginePreloadRef.current = false;
    };
  }, [rulesModule]);

  useEffect(() => {
    if (!rulesModule) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRulesModule(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rulesModule]);

  // ── Handlers ──
  const handleCardClick = (moduleId: TrainingModuleId) => {
    if (isStartingTraining) return;
    enginePreloadRef.current?.clear();
    setRulesModule(null);
    setExpandedModule(expandedModule === moduleId ? null : moduleId);
  };

  const handleShowRules = () => {
    if (!expandedModule || isStartingTraining) return;
    if (expandedModule === 'driving-rehab' && !drivingControlModeAvailable) return;
    setRulesModule(expandedModule);
  };

  const handleCloseConfig = () => {
    if (IsEmbeddedHubTraining()) {
      NotifyHubTrainingExit();
      return;
    }
    preserveEnginePreloadRef.current = false;
    enginePreloadRef.current?.clear();
    setRulesModule(null);
    setExpandedModule(null);
  };

  const handleStartTraining = async () => {
    if (!expandedModule || isStartingTraining) return;
    const moduleToStart = expandedModule;
    if (moduleToStart === 'driving-rehab') {
      const latestCapabilities = GetDrivingInputCapabilitiesSnapshot();
      if (!IsDrivingControlModeAvailable(drivingControlMode, latestCapabilities)) {
        drivingInputCapabilities.rescan();
        setRulesModule(null);
        return;
      }
      if (drivingControlMode === 'wheel' && (
        !drivingWheelCalibration.calibrated
        || !IsDrivingWheelCalibrationUsable(drivingWheelCalibration.calibration)
      )) {
        setRulesModule(null);
        return;
      }
    }
    preserveEnginePreloadRef.current = true;
    setIsStartingTraining(true);
    await EnterFullscreenFromUserGesture(document.documentElement);

    if (moduleToStart === 'hart-chart') {
      try {
        await preloadEngineOnce(moduleToStart);
        navigate('/hart-chart', { state: trainingFlowLaunchState });
      } catch (error) {
        console.error('Hart Chart preload failed:', error);
        preserveEnginePreloadRef.current = false;
        enginePreloadRef.current?.clear(moduleToStart);
        setIsStartingTraining(false);
        alert(t('home.trainingLoadError'));
      }
      return;
    }

    soundManager.init();

    try {
      await Promise.all([
        PreloadTrainingRoute(),
        preloadEngineOnce(moduleToStart),
      ]);
    } catch (error) {
      console.error('Training preload failed:', error);
      preserveEnginePreloadRef.current = false;
      enginePreloadRef.current?.clear(moduleToStart);
      setIsStartingTraining(false);
      alert(t('home.trainingLoadError'));
      return;
    }

    const params = new URLSearchParams({
      module: moduleToStart,
      difficulty: localDifficulty,
      rounds: String(localRounds),
    });

    if (moduleToStart === 'oculomotor-training') {
      params.set('mode', oculomotorMode);
      params.set('pattern', oculomotorPattern);
      params.set('duration', String(oculomotorDurationSec));
      params.set('speed', String(oculomotorSpeedDegPerSec));
      params.set('size', String(oculomotorTargetSizeMm));
      params.set('distractors', String(oculomotorDistractorCount));
      params.set('targetColor', oculomotorTargetColor);
      params.set('backgroundColor', oculomotorBackgroundColor);
      params.set('shape', oculomotorTargetShape);
    }

    if (moduleToStart === 'gabor-patching') {
      navigate(`/training?module=gabor-patching&duration=${gaborDurationSec}&difficulty=${localDifficulty}&maxSpots=${gaborMaxSpots}`, { state: trainingFlowLaunchState });
      return;
    }

    if (moduleToStart === 'moving-card') {
      navigate(`/training?module=moving-card&difficulty=${localDifficulty}`, { state: trainingFlowLaunchState });
      return;
    }

    if (moduleToStart === 'reading-training') {
      navigate('/training?module=reading-training', { state: trainingFlowLaunchState });
      return;
    }

    if (moduleToStart === 'driving-rehab') {
      navigate(`/training?module=driving-rehab&redFlash=${drivingRedFlashEnabled}&drivingDifficulty=${drivingDifficulty}&controlMode=${drivingControlMode}&renderQuality=${drivingRenderQuality}`, { state: trainingFlowLaunchState });
      return;
    }

    navigate(`/training?${params.toString()}`, { state: trainingFlowLaunchState });
  };

  const handleCustomTargetImageChange = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(t('home.pleaseSelectImage'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOculomotorCustomTargetImage(reader.result);
        setOculomotorTargetShape('custom');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundImageChange = (file: File | undefined) => {
    if (!file) {
      setOculomotorBackgroundImage('');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert(t('home.pleaseSelectImage'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOculomotorBackgroundImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAudioChange = (file: File | undefined) => {
    if (!file) {
      setOculomotorAudio('');
      return;
    }
    if (!file.type.startsWith('audio/')) {
      alert(t('home.pleaseSelectAudio'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOculomotorAudio(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const calibrated = IsCalibrated();
  const targetShapeOptions: { key: OculomotorTargetShape; label: string }[] = [
    { key: 'circle', label: t('home.shape.circle') },
    { key: 'star', label: t('home.shape.star') },
    { key: 'square', label: t('home.shape.square') },
    { key: 'cross', label: t('home.shape.cross') },
    { key: 'triangle', label: t('home.shape.triangle') },
    { key: 'custom', label: t('home.shape.custom') },
  ];
  const diffOptions: { key: 'beginner' | 'intermediate' | 'advanced'; label: string; desc: string }[] = [
    { key: 'beginner', label: t('home.diff.beginner'), desc: t('home.diff.beginnerDesc') },
    { key: 'intermediate', label: t('home.diff.intermediate'), desc: t('home.diff.intermediateDesc') },
    { key: 'advanced', label: t('home.diff.advanced'), desc: t('home.diff.advancedDesc') },
  ];
  const gaborDiffOptions: { key: 'beginner' | 'intermediate' | 'advanced'; label: string; desc: string }[] = [
    { key: 'beginner', label: t('home.diff.beginner'), desc: t('home.diff.gaborBeginnerDesc') },
    { key: 'intermediate', label: t('home.diff.intermediate'), desc: t('home.diff.gaborIntermediateDesc') },
    { key: 'advanced', label: t('home.diff.advanced'), desc: t('home.diff.gaborAdvancedDesc') },
  ];
  const keyboardCapabilityLabel = drivingInputCapabilities.keyboardConfirmed
    ? t('home.config.drivingKeyboardReady')
    : t('home.config.drivingKeyboardUnknown');
  const wheelCapabilityLabel = drivingInputCapabilities.wheelDevice
    ? drivingWheelCalibration.calibrated
      ? t('home.config.drivingWheelCalibrated', { id: drivingInputCapabilities.wheelDevice.id })
      : t('home.config.drivingWheelNeedsCalibration', { id: drivingInputCapabilities.wheelDevice.id })
    : drivingInputCapabilities.wheelApiSupported
      ? t('home.config.drivingWheelMissing')
      : t('home.config.drivingWheelUnsupported');
  const touchCapabilityLabel = drivingInputCapabilities.touchAvailable
    ? t('home.config.drivingTouchReady')
    : t('home.config.drivingTouchMissing');
  const drivingControlOptions: {
    key: DrivingControlMode;
    label: string;
    available: boolean;
    capabilityLabel: string;
  }[] = [
    {
      key: 'arrow',
      label: t('home.config.drivingControlArrow'),
      available: drivingInputCapabilities.keyboardConfirmed,
      capabilityLabel: keyboardCapabilityLabel,
    },
    {
      key: 'wasd',
      label: t('home.config.drivingControlWasd'),
      available: drivingInputCapabilities.keyboardConfirmed,
      capabilityLabel: keyboardCapabilityLabel,
    },
    {
      key: 'wheel',
      label: t('home.config.drivingControlWheel'),
      available: drivingInputCapabilities.wheelDevice !== null,
      capabilityLabel: wheelCapabilityLabel,
    },
    {
      key: 'touch',
      label: t('home.config.drivingControlTouch'),
      available: drivingInputCapabilities.touchAvailable,
      capabilityLabel: touchCapabilityLabel,
    },
  ];
  const drivingRenderQualityOptions: { key: DrivingRenderQualityLevel; label: string }[] = [
    { key: 'high', label: t('home.config.drivingRenderQualityHigh') },
    { key: 'medium', label: t('home.config.drivingRenderQualityMedium') },
    { key: 'low', label: t('home.config.drivingRenderQualityLow') },
  ];
  const drivingDifficultyLabels: Record<'beginner' | 'intermediate' | 'advanced', string> = {
    beginner: t('home.diff.beginner'),
    intermediate: t('home.diff.intermediate'),
    advanced: t('home.diff.advanced'),
  };
  const drivingDifficultyDescs: Record<'beginner' | 'intermediate' | 'advanced', string> = {
    beginner: t('home.diff.drivingBeginnerDesc'),
    intermediate: t('home.diff.drivingIntermediateDesc'),
    advanced: t('home.diff.drivingAdvancedDesc'),
  };
  const getRulesSummaryItems = (moduleId: TrainingModuleId) => {
    switch (moduleId) {
      case 'moving-card':
        return [
          { value: diffOptions.find((d) => d.key === localDifficulty)?.label },
          { value: localRounds },
        ];
      case 'oculomotor-training':
        return [
          { value: t(`preset.mode.${oculomotorMode}` as any) },
          { value: `${oculomotorDurationSec}s` },
        ];
      case 'gabor-patching':
        return [
          { value: gaborDiffOptions.find((d) => d.key === localDifficulty)?.label },
          { value: `${gaborDurationSec}s` },
          { value: gaborMaxSpots },
        ];
      case 'reading-training':
        return [
          { value: t('home.config.randomStory') },
          { value: `${readingWPS} WPS` },
        ];
      case 'driving-rehab':
        return [
          { value: drivingDifficultyLabels[drivingDifficulty] },
          { value: drivingControlOptions.find((option) => option.key === drivingControlMode)?.label },
          { value: drivingRenderQualityOptions.find((option) => option.key === drivingRenderQuality)?.label },
        ];
      case 'hart-chart':
        return [
          { value: t('home.module.hartChart.title') },
        ];
      default:
        return [];
    }
  };
  const activeRulesModule = rulesModule
    ? trainingModules.find((module) => module.id === rulesModule)
    : null;
  const activeRulesSummaryItems = rulesModule ? getRulesSummaryItems(rulesModule) : [];
  const configActions = (
    <TrainingConfigNavigationActions
      cancelLabel={t('btn.cancel')}
      disabled={isStartingTraining || (
        expandedModule === 'driving-rehab'
        && !drivingControlModeAvailable
      )}
      loading={isStartingTraining}
      nextLabel={showRulesButtonLabel}
      onCancel={handleCloseConfig}
      onNext={handleShowRules}
    />
  );

  return (
    <main className="page-content training-module-selection-page" id="main-content">
      {/* ── Calibration Notice ── */}
      {!calibrated && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 24,
          padding: '10px 16px',
          background: 'rgba(210, 153, 34, 0.1)',
          border: '1px solid var(--warning)',
          borderRadius: 'var(--radius-m)',
          fontSize: 13,
          color: 'var(--warning)',
          maxWidth: 700,
          width: '100%',
        }}>
          {t('home.calWarning')}
        </div>
      )}

      {/* ── Section Title ── */}
      <h1 className="section-title fade-in-up">{t('home.listTitle')}</h1>
      <p className="section-subtitle fade-in-up">{t('home.listSubtitle')}</p>

      {/* ── Training Cards ── */}
      <div className="selection-grid">
        {trainingModules.map((module, index) => (
          <SelectionCard
            key={module.id}
            title={GetTrainingModuleCopy(module.catalogModule, lang).title}
            description={GetTrainingModuleCopy(module.catalogModule, lang).description}
            imageSrc={module.catalogModule.imagePath}
            index={index + 1}
            isSelected={expandedModule === module.id}
            actionLabel={expandedModule === module.id ? t('btn.collapseSettings') : t('btn.selectModule')}
            onSelect={() => handleCardClick(module.id)}
          />
        ))}
      </div>

      {/* ── Module Config Panel ── */}
      {expandedModule === 'moving-card' && rulesModule !== 'moving-card' && (
        <ConfigDialog
          ariaLabel={t('home.module.movingCard.title')}
          onClose={handleCloseConfig}
          summaryItems={[
            { value: diffOptions.find((d) => d.key === localDifficulty)?.label },
            { value: localRounds },
          ]}
          actions={configActions}
        >
            {/* Difficulty */}
            <TrainingConfigSection
              title={t('home.config.difficulty')}
              value={diffOptions.find((option) => option.key === localDifficulty)?.label}
            >
              <TrainingConfigOptionGroup columns={3}>
                {diffOptions.map((opt) => (
                  <button
                    key={opt.key}
                    className={`training-option ${localDifficulty === opt.key ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setLocalDifficulty(opt.key); }}
                  >
                    <span className="training-option-title">{opt.label}</span>
                    <span className="training-option-meta">{opt.desc}</span>
                  </button>
                ))}
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            {/* Rounds */}
            <TrainingConfigSection title={t('home.config.rounds')} value={localRounds}>
              <input
                type="range"
                value={localRounds}
                min={1}
                max={100}
                step={1}
                aria-label={t('home.config.rounds')}
                onChange={(event) => setLocalRounds(Number(event.target.value))}
              />
            </TrainingConfigSection>

        </ConfigDialog>
      )}

      {expandedModule === 'oculomotor-training' && rulesModule !== 'oculomotor-training' && (
        <ConfigDialog
          ariaLabel={t('home.module.oculomotor.title')}
          onClose={handleCloseConfig}
          summaryItems={[
            { value: t(`preset.mode.${oculomotorMode}` as any) },
            { value: `${oculomotorDurationSec}s` },
          ]}
          actions={configActions}
        >
            <TrainingConfigSection
              title={t('settings.train.wgToggle')}
              value={oculomotorEnableWebgazer ? t('common.on') : t('common.off')}
            >
              <label className={`training-option training-option-toggle ${oculomotorEnableWebgazer ? 'active' : ''}`}>
                <div>
                  <span className="training-option-title">{t('settings.train.wgToggle')}</span>
                  <span className="training-option-meta">{t('settings.train.wgDesc')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={oculomotorEnableWebgazer}
                  onChange={(e) => setOculomotorEnableWebgazer(e.target.checked)}
                />
              </label>
              <label
                className={`training-option training-option-toggle ${oculomotorShowGazepoint ? 'active' : ''}`}
                aria-disabled={!oculomotorEnableWebgazer}
              >
                <div>
                  <span className="training-option-title">{t('settings.train.gazepointToggle')}</span>
                  <span className="training-option-meta">{t('settings.train.gazepointDesc')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={oculomotorShowGazepoint}
                  disabled={!oculomotorEnableWebgazer}
                  onChange={(e) => setOculomotorShowGazepoint(e.target.checked)}
                />
              </label>
            </TrainingConfigSection>

            <TrainingConfigSection
              title={t('home.config.trainingMode')}
              value={t(`preset.mode.${oculomotorMode}` as any)}
            >
              <select
                className="input"
                value={oculomotorMode}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setOculomotorMode(e.target.value as typeof oculomotorMode)}
              >
                {oculomotorModes.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {t(`preset.mode.${mode.id}` as any)}
                  </option>
                ))}
              </select>
            </TrainingConfigSection>

            {oculomotorMode !== 'lilac-chaser' && (
              <TrainingConfigSection
                title={t('home.config.movementPath')}
                value={t(`preset.path.${oculomotorPattern}` as any)}
              >
                <select
                  className="input"
                  value={oculomotorPattern}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setOculomotorPattern(e.target.value as OculomotorPattern)}
                >
                  {oculomotorPatterns.map((pattern) => (
                    <option key={pattern.id} value={pattern.id}>{t(`preset.path.${pattern.id}` as any)}</option>
                  ))}
                </select>
              </TrainingConfigSection>
            )}

            <TrainingConfigSection
              title={t('home.config.durationSec')}
              value={`${oculomotorDurationSec}s`}
            >
              <input
                type="range"
                min="15"
                max="300"
                step="1"
                value={oculomotorDurationSec}
                aria-label={t('home.config.durationSec')}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => setOculomotorDurationSec(Number(event.target.value))}
              />
            </TrainingConfigSection>

            <TrainingConfigSection title={t('home.config.speedAndSize')} wide>
              <TrainingConfigOptionGroup columns={3}>
                <TrainingConfigRangeField
                  label={t('home.config.speed')}
                  value={oculomotorSpeedDegPerSec}
                  valueLabel={`${oculomotorSpeedDegPerSec}°/s`}
                  min={2}
                  max={80}
                  step={1}
                  scaleLabels={['2', '41', '80']}
                  onClick={(event) => event.stopPropagation()}
                  onValueChange={(value) => setOculomotorSpeedDegPerSec(Math.max(2, Math.min(80, value)))}
                />
                <TrainingConfigRangeField
                  label={t('home.config.size')}
                  value={oculomotorTargetSizeMm}
                  valueLabel={`${oculomotorTargetSizeMm} mm`}
                  min={2}
                  max={100}
                  step={1}
                  scaleLabels={['2 mm', '51 mm', '100 mm']}
                  onClick={(event) => event.stopPropagation()}
                  onValueChange={(value) => setOculomotorTargetSizeMm(Math.max(2, Math.min(100, value)))}
                />
                <TrainingConfigRangeField
                  label={t('home.config.distractors')}
                  value={oculomotorDistractorCount}
                  valueLabel={oculomotorDistractorCount}
                  min={0}
                  max={12}
                  step={1}
                  scaleLabels={['0', '6', '12']}
                  disabled={oculomotorMode !== 'multi-object'}
                  onClick={(event) => event.stopPropagation()}
                  onValueChange={(value) => setOculomotorDistractorCount(Math.max(0, Math.min(12, value)))}
                />
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            <TrainingConfigSection title={t('home.config.colors')} wide>
              <TrainingConfigOptionGroup columns={3}>
                <label className="training-option training-option-field training-option-color-field">
                  <span className="training-option-title">{t('home.config.targetColor')}</span>
                  <select
                    className="input"
                    value={oculomotorTargetColor}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setOculomotorTargetColor(e.target.value)}
                  >
                    {!oculomotorColorOptions.some((option) => option.value === oculomotorTargetColor) && (
                      <option value={oculomotorTargetColor}>{oculomotorTargetColor}</option>
                    )}
                    {oculomotorColorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="training-option training-option-field training-option-color-field">
                  <span className="training-option-title">{t('home.config.bgColor')}</span>
                  <select
                    className="input"
                    value={oculomotorBackgroundColor}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setOculomotorBackgroundColor(e.target.value)}
                  >
                    {!oculomotorColorOptions.some((option) => option.value === oculomotorBackgroundColor) && (
                      <option value={oculomotorBackgroundColor}>{oculomotorBackgroundColor}</option>
                    )}
                    {oculomotorColorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <TrainingConfigRangeField
                  label={t('home.config.opacity')}
                  value={oculomotorTargetOpacity}
                  valueLabel={`${Math.round(oculomotorTargetOpacity * 100)}%`}
                  min={0.1}
                  max={1}
                  step={0.1}
                  scaleLabels={['10%', '50%', '100%']}
                  onClick={(event) => event.stopPropagation()}
                  onValueChange={setOculomotorTargetOpacity}
                />
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            <TrainingConfigSection title={t('home.config.advancedConfig')} wide>
              <TrainingConfigOptionGroup columns={2}>
                <label className="training-option training-option-field">
                  <span className="training-option-title">{t('home.config.bgImage')}</span>
                  <TrainingFilePickerButton accept="image/*" label={t('home.config.bgImage')} onFile={handleBackgroundImageChange} />
                  {oculomotorBackgroundImage && (
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setOculomotorBackgroundImage(''); }}>
                      {t('btn.delete')}
                    </button>
                  )}
                </label>
                <label className="training-option training-option-field">
                  <span className="training-option-title">{t('home.config.audio')}</span>
                  <TrainingFilePickerButton accept="audio/*" label={t('home.config.audio')} onFile={handleAudioChange} />
                  {oculomotorAudio && (
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setOculomotorAudio(''); }}>
                      {t('btn.delete')}
                    </button>
                  )}
                </label>
              </TrainingConfigOptionGroup>
              <TrainingConfigOptionGroup className="training-option-grid-spaced" columns={2}>
                <TrainingConfigRangeField
                  label={t('home.config.bounceJitter')}
                  value={oculomotorBounceJitter}
                  valueLabel={`${oculomotorBounceJitter}%`}
                  min={0}
                  max={100}
                  step={1}
                  scaleLabels={['0', '50', '100']}
                  onClick={(event) => event.stopPropagation()}
                  onValueChange={setOculomotorBounceJitter}
                />
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            <TrainingConfigSection
              title={t('home.config.targetShape')}
              value={targetShapeOptions.find((shape) => shape.key === oculomotorTargetShape)?.label}
            >
              <TrainingConfigOptionGroup columns={3}>
                {targetShapeOptions.map((shape) => (
                  <button
                    key={shape.key}
                    className={`training-option ${oculomotorTargetShape === shape.key ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOculomotorTargetShape(shape.key);
                    }}
                  >
                    <span className="training-option-title">{shape.label}</span>
                  </button>
                ))}
              </TrainingConfigOptionGroup>
              {oculomotorTargetShape === 'custom' && (
                <div className="custom-image-field">
                  <TrainingFilePickerButton accept="image/*" label={t('home.config.custom')} onFile={handleCustomTargetImageChange} />
                  {oculomotorCustomTargetImage && (
                    <div className="custom-image-preview">
                      <img src={oculomotorCustomTargetImage} alt={t('home.config.customTargetPreview')} />
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOculomotorCustomTargetImage('');
                        }}
                      >
                        {t('btn.removeImage')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </TrainingConfigSection>

        </ConfigDialog>
      )}

      {expandedModule === 'gabor-patching' && rulesModule !== 'gabor-patching' && (
        <ConfigDialog
          ariaLabel={t('home.module.gaborPatching.title')}
          onClose={handleCloseConfig}
          summaryItems={[
            { value: gaborDiffOptions.find((d) => d.key === localDifficulty)?.label },
            { value: `${gaborDurationSec}s` },
            { value: gaborMaxSpots },
          ]}
          actions={configActions}
        >
            {/* Difficulty */}
            <TrainingConfigSection
              title={t('home.config.difficulty')}
              value={gaborDiffOptions.find((option) => option.key === localDifficulty)?.label}
            >
              <TrainingConfigOptionGroup columns={3}>
                {gaborDiffOptions.map((opt) => (
                  <button
                    key={opt.key}
                    className={`training-option ${localDifficulty === opt.key ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setLocalDifficulty(opt.key); }}
                  >
                    <span className="training-option-title">{opt.label}</span>
                    <span className="training-option-meta">{opt.desc}</span>
                  </button>
                ))}
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            {/* Duration */}
            <TrainingConfigSection title={t('home.config.gaborDuration')} value={`${gaborDurationSec}s`}>
              <input
                type="range"
                min="15"
                max="300"
                step="1"
                value={gaborDurationSec}
                aria-label={t('home.config.gaborDuration')}
                onChange={(e) => setGaborDurationSec(Number(e.target.value))}
              />
            </TrainingConfigSection>

            {/* Max Spots */}
            <TrainingConfigSection title={t('home.config.gaborMaxSpots')} value={gaborMaxSpots}>
              <input
                type="range"
                min="3"
                max="50"
                step="1"
                value={gaborMaxSpots}
                aria-label={t('home.config.gaborMaxSpots')}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => setGaborMaxSpots(Math.max(3, Math.min(50, Number(event.target.value))))}
              />
            </TrainingConfigSection>

        </ConfigDialog>
      )}

      {expandedModule === 'reading-training' && rulesModule !== 'reading-training' && (
        <ConfigDialog
          ariaLabel={t('home.module.reading.title')}
          onClose={handleCloseConfig}
          summaryItems={[
            { value: t('home.config.randomStory') },
          ]}
          actions={configActions}
        >

            <TrainingConfigSection title={t('home.config.readingSettings')} wide>
              <TrainingConfigOptionGroup columns={3}>
                <TrainingConfigRangeField
                  label={t('home.config.readingWps')}
                  value={readingWPS}
                  valueLabel={`${readingWPS} WPS`}
                  min={1}
                  max={20}
                  step={1}
                  scaleLabels={['1', '10', '20']}
                  onClick={(event) => event.stopPropagation()}
                  onValueChange={(value) => setReadingWPS(Math.max(1, Math.min(20, value)))}
                />
                <TrainingConfigRangeField
                  label={t('home.config.readingCrowding')}
                  value={readingCrowding}
                  valueLabel={readingCrowding}
                  min={1}
                  max={5}
                  step={1}
                  scaleLabels={['1', '3', '5']}
                  onClick={(event) => event.stopPropagation()}
                  onValueChange={(value) => setReadingCrowding(Math.max(1, Math.min(5, value)))}
                />
                <TrainingConfigRangeField
                  label={t('home.config.readingContrast')}
                  value={readingContrast}
                  valueLabel={`${readingContrast.toFixed(1)} logCS`}
                  description={t('home.config.readingContrastDesc')}
                  min={0}
                  max={2}
                  step={0.1}
                  scaleLabels={['0.0', '1.0', '2.0']}
                  onClick={(event) => event.stopPropagation()}
                  onValueChange={setReadingContrast}
                />
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

        </ConfigDialog>
      )}

      {expandedModule === 'driving-rehab' && rulesModule !== 'driving-rehab' && (
        <ConfigDialog
          ariaLabel={t('home.module.driving.title')}
          onClose={handleCloseConfig}
          summaryItems={[
            { value: drivingDifficultyLabels[drivingDifficulty] },
            { value: drivingControlOptions.find((option) => option.key === drivingControlMode)?.label },
            { value: drivingRenderQualityOptions.find((option) => option.key === drivingRenderQuality)?.label },
            { value: drivingRedFlashEnabled ? t('common.on') : t('common.off') },
          ]}
          actions={configActions}
        >
            <TrainingConfigSection
              title={t('home.config.drivingReactionDifficulty')}
              value={drivingDifficultyLabels[drivingDifficulty]}
            >
              <TrainingConfigOptionGroup columns={3}>
                {(['beginner', 'intermediate', 'advanced'] as const).map((level) => {
                  return (
                    <button
                      key={level}
                      className={`training-option ${drivingDifficulty === level ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setDrivingDifficulty(level); }}
                    >
                      <span className="training-option-title">{drivingDifficultyLabels[level]}</span>
                      <span className="training-option-meta">{drivingDifficultyDescs[level]}</span>
                    </button>
                  );
                })}
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            <TrainingConfigSection
              title={t('home.config.drivingRenderQuality')}
              value={drivingRenderQualityOptions.find((option) => option.key === drivingRenderQuality)?.label}
            >
              <TrainingConfigOptionGroup columns={3}>
                {drivingRenderQualityOptions.map((option) => (
                  <button
                    key={option.key}
                    className={`training-option ${drivingRenderQuality === option.key ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDrivingRenderQuality(option.key);
                    }}
                  >
                    <span className="training-option-title">{option.label}</span>
                  </button>
                ))}
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            <TrainingConfigSection
              title={t('home.config.drivingAssist')}
              value={drivingRedFlashEnabled ? t('common.on') : t('common.off')}
            >
              <label className={`training-option training-option-toggle ${drivingRedFlashEnabled ? 'active' : ''}`}>
                <div>
                  <span className="training-option-title">{t('home.config.drivingRedFlash')}</span>
                  <span className="training-option-meta">{t('home.config.drivingRedFlashDesc')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={drivingRedFlashEnabled}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDrivingRedFlashEnabled(e.target.checked)}
                />
              </label>
            </TrainingConfigSection>

            <TrainingConfigSection
              title={t('home.config.drivingControls')}
              description={t('home.config.drivingControlsDesc')}
              value={drivingControlOptions.find((option) => option.key === drivingControlMode)?.label}
              wide
            >
              <button
                className="btn btn-secondary btn-sm training-config-rescan-inputs"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  drivingInputCapabilities.rescan();
                }}
              >
                {t('home.config.drivingRescanInputs')}
              </button>
              <TrainingConfigOptionGroup columns={4}>
                {drivingControlOptions.map((option) => (
                  <button
                    key={option.key}
                    className={`training-option ${drivingControlMode === option.key ? 'active' : ''}`}
                    type="button"
                    disabled={!option.available}
                    title={!option.available ? option.capabilityLabel : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDrivingControlMode(option.key);
                    }}
                  >
                    <span className="training-option-title">{option.label}</span>
                    <span className="training-option-meta">{option.capabilityLabel}</span>
                  </button>
                ))}
              </TrainingConfigOptionGroup>
              {drivingControlMode === 'wheel' && drivingInputCapabilities.wheelDevice && (
                <div className="training-config-control-status" role="status" aria-live="polite">
                  <span className="training-option-meta">
                    {drivingWheelCalibration.phase === 'idle'
                      ? drivingWheelCalibration.calibrated
                        ? t('home.config.drivingWheelCalibrationReady')
                        : t('home.config.drivingWheelCalibrationStart')
                      : drivingWheelCalibration.phase === 'error'
                        ? t(`home.config.drivingWheelCalibrationError.${drivingWheelCalibration.error ?? 'disconnected'}`)
                        : t(`home.config.drivingWheelCalibrationStep.${drivingWheelCalibration.phase}`)}
                  </span>
                  {drivingWheelCalibration.phase === 'idle' ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        drivingWheelCalibration.begin();
                      }}
                    >
                      {drivingWheelCalibration.calibrated
                        ? t('home.config.drivingWheelRecalibrate')
                        : t('home.config.drivingWheelCalibrate')}
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (drivingWheelCalibration.phase === 'error') {
                            drivingWheelCalibration.begin();
                          } else {
                            drivingWheelCalibration.advance();
                          }
                        }}
                      >
                        {drivingWheelCalibration.phase === 'error'
                          ? t('home.config.drivingWheelRetryCalibration')
                          : t('home.config.drivingWheelCaptureStep')}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          drivingWheelCalibration.cancel();
                        }}
                      >
                        {t('common.cancel')}
                      </button>
                    </>
                  )}
                </div>
              )}
              {!drivingControlModeAvailable && (
                <div className="training-config-control-status" role="status" aria-live="polite">
                  <span className="training-option-meta">
                    {t('home.config.drivingControlUnavailable')}
                  </span>
                </div>
              )}
            </TrainingConfigSection>

        </ConfigDialog>
      )}

      {expandedModule === 'hart-chart' && rulesModule !== 'hart-chart' && (
        <ConfigDialog
          ariaLabel={t('home.module.hartChart.title')}
          onClose={handleCloseConfig}
          actions={configActions}
        >
            <TrainingConfigSection
              title={t('home.config.hartChartSetup')}
              description={t('home.config.hartChartSummary')}
              wide
            />
        </ConfigDialog>
      )}

      {rulesModule && activeRulesModule && (
        <div
          className="config-modal-overlay fade-in"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setRulesModule(null);
            }
          }}
        >
          <TrainingRulesPanel
            className="config-modal-panel"
            label={rulesLabels.label}
            title={GetTrainingModuleCopy(activeRulesModule.catalogModule, lang).title}
            summaryTitle={rulesLabels.summary}
            summaryItems={activeRulesSummaryItems}
            sections={GetVisionRuleSections(rulesModule, lang, t)}
            startLabel={rulesStartButtonLabel}
            backLabel={rulesLabels.back}
            startDisabled={isStartingTraining || (
              rulesModule === 'driving-rehab'
              && !drivingControlModeAvailable
            )}
            startClassName={isStartingTraining ? 'is-loading' : ''}
            onStart={() => void handleStartTraining()}
            onBack={() => setRulesModule(null)}
            role="dialog"
            aria-modal
            aria-label={`${GetTrainingModuleCopy(activeRulesModule.catalogModule, lang).title} ${rulesLabels.label}`}
          />
        </div>
      )}
    </main>
  );
}

function GetRulesLabels(lang: string) {
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

function GetVisionRuleSections(
  moduleId: TrainingModuleId,
  lang: string,
  t: (key: any, params?: Record<string, string | number>) => string,
) {
  const isZh = lang !== 'en';

  switch (moduleId) {
    case 'moving-card':
      return isZh
        ? [
            {
              title: '目標與操作',
              description: '先記住畫面上方的目標字母，再從移動卡片中找出完全相同的一張。',
              items: [
                '每一回合會顯示一組目標字母與多張候選卡片。',
                '點擊與目標完全相同的卡片；答錯會提示並可繼續尋找。',
                '卡片會依難度移動、分散或旋轉，請保持視線掃描並盡快反應。',
              ],
            },
            {
              title: '成績計算',
              description: '結算會記錄每回合反應時間、答案是否正確與整體正確率。',
            },
          ]
        : [
            {
              title: 'Goal and Controls',
              description: 'Memorize the target letters, then find the matching moving card.',
              items: [
                'Each round shows target letters and several candidate cards.',
                'Click the card that exactly matches the target; a wrong click gives feedback and the round continues.',
                'Higher difficulty adds movement, scattered placement, or rotation, so keep scanning and respond quickly.',
              ],
            },
            {
              title: 'Results',
              description: 'The result records reaction time, correctness, and overall accuracy.',
            },
          ];
    case 'oculomotor-training':
      return isZh
        ? [
            {
              title: '訓練目標',
              description: '依所選模式追視、跳視、追蹤多目標或維持中央固視。',
              items: [
                '開始後依畫面上的目標移動視線，盡量保持頭部穩定。',
                '多目標或周邊模式下，請依模式要求維持注意力，不要被干擾物帶走。',
                '若啟用 WebGazer，請讓臉部維持在鏡頭中，系統會同步記錄視線資料。',
              ],
            },
            {
              title: '成績計算',
              description: '結算會依模式記錄完成時間、目標取得、AOI 或追蹤相關資料。',
            },
          ]
        : [
            {
              title: 'Training Goal',
              description: 'Follow the selected pursuit, saccade, multi-object, or fixation mode.',
              items: [
                'Move your eyes with the target while keeping the head as steady as possible.',
                'For multi-object or peripheral modes, keep attention on the required target and ignore distractors.',
                'If WebGazer is enabled, keep the face visible so gaze data can be recorded.',
              ],
            },
            {
              title: 'Results',
              description: 'The result records mode-specific duration, acquired targets, AOI, or tracking data.',
            },
          ];
    case 'gabor-patching':
      return isZh
        ? [
            {
              title: '遊玩方式',
              description: '在灰色背景中尋找逐漸浮現的 Gabor 斑塊，出現後盡快點擊。',
              items: [
                '斑塊會隨時間變大、變清楚；越早點到分數越高。',
                '畫面上同時存在的斑塊數量會受最大斑塊數與難度影響。',
                '時間結束後自動進入成績結算。',
              ],
            },
            {
              title: '成績計算',
              description: '結算會記錄命中數、總分與訓練時長。',
            },
          ]
        : [
            {
              title: 'How to Play',
              description: 'Find Gabor patches as they fade in on the gray field and click them quickly.',
              items: [
                'Patches grow and become clearer over time; earlier hits score more points.',
                'The maximum spot setting and difficulty control how crowded the field becomes.',
                'The session moves to results automatically when time expires.',
              ],
            },
            {
              title: 'Results',
              description: 'The result records hits, score, and training duration.',
            },
          ];
    case 'reading-training':
      return isZh
        ? [
            {
              title: '閱讀流程',
              description: '系統會倒數後以 RSVP 方式逐段顯示文字，請依設定速度閱讀。',
              items: [
                '一次顯示的字數由 Crowding 設定控制。',
                '閱讀結束後會出現理解題，請選出最符合文章內容的答案。',
                '訓練中若按 Esc 會提前結束。',
              ],
            },
            {
              title: '成績計算',
              description: '結算會記錄閱讀時間、題目答對率與每題反應。',
            },
          ]
        : [
            {
              title: 'Reading Flow',
              description: 'After a countdown, the text appears in RSVP chunks at the configured speed.',
              items: [
                'The crowding setting controls how many words appear at once.',
                'After reading, answer the comprehension questions based on the story.',
                'Pressing Esc during training ends the session early.',
              ],
            },
            {
              title: 'Results',
              description: 'The result records reading time, comprehension accuracy, and question responses.',
            },
          ];
    case 'driving-rehab':
      return isZh
        ? [
            {
              title: '任務目標',
              description: '依小地圖與路口提示完成送貨路線，並在突發事件中做出煞車或閃避反應。',
              items: [
                '使用設定的控制方式操控方向、油門與緊急煞車。',
                '按 C 或 V 可在第一人稱與第三人稱視角間切換。',
                '遇到行人、逆向車或其他危險事件時，請立即煞車或避開碰撞箱。',
                '偏離車道太久會被系統重置，請盡量維持在路線上。',
              ],
            },
            {
              title: '成績計算',
              description: '結算會記錄有效事件反應時間、碰撞次數、偏離車道次數與路線進度。',
            },
          ]
        : [
            {
              title: 'Mission Goal',
              description: 'Follow the mini-map and intersection prompts to complete the delivery route while responding to hazards.',
              items: [
                'Use the selected control mode for steering, throttle, and emergency braking.',
                'Press C or V to switch between first-person and third-person camera views.',
                'When a pedestrian, wrong-way car, or other hazard appears, brake or steer away from the collision box.',
                'If you leave the lane for too long, the system resets the vehicle to the route.',
              ],
            },
            {
              title: 'Results',
              description: 'The result records valid hazard reaction time, collisions, lane deviations, and route progress.',
            },
          ];
    case 'hart-chart':
      return isZh
        ? [
            {
              title: '遠近交替訓練',
              description: '注視的字母或數字必須清晰且只能看到單一影像，才算完成一次有效練習。',
              items: [
                '將大型遠距哈特圖固定在牆上，距離約 3 公尺。',
                '手持小型近距哈特圖，距離眼睛約 40 公分，也可用 QR Code 在手機開啟近距圖表。',
                '先朗讀遠距哈特圖第一個字母，再移到近距圖第一個字母，確認清晰且單一後讀出。',
                '持續在遠距圖與近距圖間交替，依序完成所有字母或數字。',
                '若影像變模糊或出現重影，請放慢速度並重新對焦後再繼續。',
              ],
            },
            {
              title: t('hart.decoderInstructionsTitle' as any),
              description: t('hart.decoderSummary' as any),
              items: [
                t('hart.decoderInstructions.1' as any),
                t('hart.decoderInstructions.2' as any),
                t('hart.decoderInstructions.3' as any),
                t('hart.decoderInstructions.4' as any),
                t('hart.decoderInstructions.5' as any),
              ],
            },
          ]
        : [
            {
              title: 'Near-Far Focus Training',
              description: 'Each letter or number should be clear and single before you count the repetition as effective.',
              items: [
                'Place the large distance Hart chart on a wall about 3 m away.',
                'Hold the near chart about 40 cm from the eyes, or open the near chart on a phone with the QR code.',
                'Read the first distance-chart letter, then shift to the first near-chart letter and read it when it is clear and single.',
                'Keep alternating between distance and near charts until all letters or numbers are complete.',
                'If the target blurs or doubles, slow down and refocus before continuing.',
              ],
            },
            {
              title: t('hart.decoderInstructionsTitle' as any),
              description: t('hart.decoderSummary' as any),
              items: [
                t('hart.decoderInstructions.1' as any),
                t('hart.decoderInstructions.2' as any),
                t('hart.decoderInstructions.3' as any),
                t('hart.decoderInstructions.4' as any),
                t('hart.decoderInstructions.5' as any),
              ],
            },
          ];
    default:
      return [];
  }
}
