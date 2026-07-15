import { useState, useEffect } from 'react';
import { useT } from '../i18n';
import { useNavigate } from 'react-router-dom';
import { ConfigDialog } from '@rehab-trainer/ui/components/ConfigDialog';
import { NumberPresetSelector } from '@rehab-trainer/ui/components/NumberPresetSelector';
import { SelectionCard } from '@rehab-trainer/ui/components/SelectionCard';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import { enterFullscreenFromUserGesture } from '@rehab-trainer/ui/fullscreen';
import { isCalibrated } from '../utils/settings';
import { pixiAppManager } from '../utils/pixiPool';
import { SoundManager } from '../utils/soundManager';
import { useAppSetting } from '../utils/useAppSetting';
import {
  oculomotorModes,
  oculomotorPatterns,
} from './training/oculomotor/presets';
import { TRAINING_MODULES } from './home/trainingModules';
import type { TrainingModuleId } from './home/trainingModules';
import type { OculomotorPattern, OculomotorTargetShape } from './training/oculomotor/types';
import type { DrivingControlMode } from '../utils/settings';

function preloadTrainingRoute(): Promise<unknown> {
  return import('./training/TrainingPage');
}

function preloadTrainingEngine(moduleId: TrainingModuleId): Promise<unknown> {
  if (moduleId === 'hart-chart') {
    return import('./training/HartChartPage');
  }

  if (moduleId === 'driving-rehab') {
    return import('../experiment/plugins/three-driving-rehab');
  }

  return pixiAppManager.warmUp();
}

export function HomePage() {
  const { t, lang } = useT();
  const navigate = useNavigate();

  // ── Module expansion state ──
  const [expandedModule, setExpandedModule] = useState<TrainingModuleId | null>(null);
  const [rulesModule, setRulesModule] = useState<TrainingModuleId | null>(null);
  const [localDifficulty, setLocalDifficulty] = useAppSetting('difficulty');
  const [localRounds, setLocalRounds] = useAppSetting('totalRounds');
  const [customRoundsInput, setCustomRoundsInput] = useState('');
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
  const [gaborDurationSec, setGaborDurationSec] = useState(60);
  const [gaborMaxSpots, setGaborMaxSpots] = useState(10);
  const [readingWPS, setReadingWPS] = useAppSetting('readingWPS');
  const [readingCrowding, setReadingCrowding] = useAppSetting('readingCrowding');
  const [readingContrast, setReadingContrast] = useAppSetting('readingContrast');
  const [drivingRedFlashEnabled, setDrivingRedFlashEnabled] = useAppSetting('drivingRedFlashEnabled');
  const [drivingDifficulty, setDrivingDifficulty] = useAppSetting('drivingDifficulty');
  const [drivingControlMode, setDrivingControlMode] = useAppSetting('drivingControlMode');
  const [isStartingTraining, setIsStartingTraining] = useState(false);
  const rulesLabels = getRulesLabels(lang);
  const showRulesButtonLabel = rulesLabels.next;
  const rulesStartButtonLabel = rulesLabels.start;

  // Preload the route chunk shortly after the home page is interactive.
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void preloadTrainingRoute();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  // Warm up the selected training route and engine when a module panel expands.
  useEffect(() => {
    if (!expandedModule) return;
    void Promise.all([
      preloadTrainingRoute(),
      preloadTrainingEngine(expandedModule),
    ]).catch(() => undefined);
  }, [expandedModule]);

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
    setRulesModule(null);
    setExpandedModule(expandedModule === moduleId ? null : moduleId);
  };

  const handleShowRules = () => {
    if (!expandedModule || isStartingTraining) return;
    setRulesModule(expandedModule);
  };

  const handleStartTraining = async () => {
    if (!expandedModule || isStartingTraining) return;
    const moduleToStart = expandedModule;
    setIsStartingTraining(true);
    await enterFullscreenFromUserGesture(document.documentElement);

    if (moduleToStart === 'hart-chart') {
      try {
        await preloadTrainingEngine(moduleToStart);
        navigate('/hart-chart');
      } catch (error) {
        console.error('Hart Chart preload failed:', error);
        setIsStartingTraining(false);
        alert(t('home.trainingLoadError'));
      }
      return;
    }

    SoundManager.init();

    try {
      await Promise.all([
        preloadTrainingRoute(),
        preloadTrainingEngine(moduleToStart),
      ]);
    } catch (error) {
      console.error('Training preload failed:', error);
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
      navigate(`/training?module=gabor-patching&duration=${gaborDurationSec}&difficulty=${localDifficulty}&maxSpots=${gaborMaxSpots}`);
      return;
    }

    if (moduleToStart === 'moving-card') {
      navigate(`/training?module=moving-card&difficulty=${localDifficulty}`);
      return;
    }

    if (moduleToStart === 'reading-training') {
      navigate('/training?module=reading-training');
      return;
    }

    if (moduleToStart === 'driving-rehab') {
      navigate(`/training?module=driving-rehab&redFlash=${drivingRedFlashEnabled}&drivingDifficulty=${drivingDifficulty}&controlMode=${drivingControlMode}`);
      return;
    }

    navigate(`/training?${params.toString()}`);
  };

  const handleRoundsPreset = (rounds: number) => {
    setLocalRounds(rounds);
    setCustomRoundsInput('');
  };

  const handleCustomRoundsChange = (val: string) => {
    setCustomRoundsInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 100) {
      setLocalRounds(num);
    }
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

  const calibrated = isCalibrated();
  const roundsPresets = [3, 5, 10, 15];
  const durationPresets = [30, 60, 90, 120];
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
  const drivingControlOptions: { key: DrivingControlMode; label: string }[] = [
    { key: 'arrow', label: t('home.config.drivingControlArrow') },
    { key: 'wasd', label: t('home.config.drivingControlWasd') },
    { key: 'wheel', label: t('home.config.drivingControlWheel') },
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
    ? TRAINING_MODULES.find((module) => module.id === rulesModule)
    : null;
  const activeRulesSummaryItems = rulesModule ? getRulesSummaryItems(rulesModule) : [];

  return (
    <div className="page-content">
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
        {TRAINING_MODULES.map((module, index) => (
          <SelectionCard
            key={module.id}
            title={t(module.titleKey)}
            description={t(module.descKey)}
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
          onClose={() => setExpandedModule(null)}
          summaryItems={[
            { value: diffOptions.find((d) => d.key === localDifficulty)?.label },
            { value: localRounds },
          ]}
        >
            {/* Difficulty */}
            <div className="config-section">
              <div className="config-label">{t('home.config.difficulty')}</div>
              <div className="difficulty-selector">
                {diffOptions.map((opt) => (
                  <button
                    key={opt.key}
                    className={`diff-btn ${localDifficulty === opt.key ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setLocalDifficulty(opt.key); }}
                  >
                    <span className="diff-btn-label">{opt.label}</span>
                    <span className="diff-btn-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Rounds */}
            <div className="config-section">
              <div className="config-label">{t('home.config.rounds')}</div>
              <NumberPresetSelector
                value={localRounds}
                customValue={customRoundsInput}
                presets={roundsPresets}
                min={1}
                max={100}
                placeholder={t('home.config.custom')}
                onPresetSelect={handleRoundsPreset}
                onCustomChange={handleCustomRoundsChange}
              />
            </div>

            {/* Actions */}
            <div className="config-actions">
              <button
                className={`btn btn-primary btn-lg config-start-btn ${isStartingTraining ? 'is-loading' : ''}`}
                disabled={isStartingTraining}
                aria-busy={isStartingTraining}
                onClick={(e) => { e.stopPropagation(); handleShowRules(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {showRulesButtonLabel}
                {isStartingTraining && <span className="loading-dot" />}
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={(e) => { e.stopPropagation(); setExpandedModule(null); }}
              >
                {t('btn.cancel')}
              </button>
            </div>

        </ConfigDialog>
      )}

      {expandedModule === 'oculomotor-training' && rulesModule !== 'oculomotor-training' && (
        <ConfigDialog
          ariaLabel={t('home.module.oculomotor.title')}
          onClose={() => setExpandedModule(null)}
          summaryItems={[
            { value: t(`preset.mode.${oculomotorMode}` as any) },
            { value: `${oculomotorDurationSec}s` },
          ]}
        >
            <div className="config-section">
              <div className="config-label">{t('home.config.trainingMode')}</div>
              <div className="difficulty-selector">
                {oculomotorModes.map((mode) => (
                  <button
                    key={mode.id}
                    className={`diff-btn ${oculomotorMode === mode.id ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOculomotorMode(mode.id);
                    }}
                  >
                    <span className="diff-btn-label">{t(`preset.mode.${mode.id}` as any)}</span>
                    <span className="diff-btn-desc">{t(`preset.mode.${mode.id}Desc` as any)}</span>
                  </button>
                ))}
              </div>
            </div>

            {oculomotorMode !== 'lilac-chaser' && (
              <div className="config-section">
                <div className="config-label">{t('home.config.movementPath')}</div>
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
              </div>
            )}

            <div className="config-section">
              <div className="config-label">{t('home.config.durationSec')}</div>
              <div className="number-preset-selector">
                {durationPresets.map((duration) => (
                  <button
                    key={duration}
                    className={`number-preset-button ${oculomotorDurationSec === duration ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOculomotorDurationSec(duration);
                    }}
                  >
                    {duration}
                  </button>
                ))}
                <input
                  className="number-preset-input"
                  type="number"
                  min="15"
                  max="300"
                  value={oculomotorDurationSec}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (Number.isFinite(value)) {
                      setOculomotorDurationSec(Math.max(15, Math.min(300, value)));
                    }
                  }}
                />
              </div>
            </div>

            <div className="config-section">
              <div className="config-label">{t('home.config.speedAndSize')}</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, justifyContent: 'center' }}>
                {[1, 2, 4, 8].map(mult => (
                  <button
                    key={mult}
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOculomotorSpeedDegPerSec(Math.min(80, oculomotorSpeedDegPerSec * mult));
                    }}
                  >
                    {mult}x
                  </button>
                ))}
              </div>
              <div className="difficulty-selector">
                <label className="diff-btn" style={{ cursor: 'default', alignItems: 'stretch' }}>
                  <span className="diff-btn-desc">{t('home.config.speed')}</span>
                  <input
                    className="number-preset-input"
                    type="number"
                    min="2"
                    max="80"
                    value={oculomotorSpeedDegPerSec}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (Number.isFinite(value)) {
                        setOculomotorSpeedDegPerSec(Math.max(2, Math.min(80, value)));
                      }
                    }}
                    style={{ width: '100%' }}
                  />
                </label>
                <label className="diff-btn" style={{ cursor: 'default', alignItems: 'stretch' }}>
                  <span className="diff-btn-desc">{t('home.config.size')}</span>
                  <input
                    className="number-preset-input"
                    type="number"
                    min="2"
                    max="100"
                    value={oculomotorTargetSizeMm}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (Number.isFinite(value)) {
                        setOculomotorTargetSizeMm(Math.max(2, Math.min(100, value)));
                      }
                    }}
                    style={{ width: '100%' }}
                  />
                </label>
                <label className="diff-btn" style={{ cursor: 'default', alignItems: 'stretch' }}>
                  <span className="diff-btn-desc">{t('home.config.distractors')}</span>
                  <input
                    className="number-preset-input"
                    type="number"
                    min="0"
                    max="12"
                    value={oculomotorDistractorCount}
                    disabled={oculomotorMode !== 'multi-object'}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (Number.isFinite(value)) {
                        setOculomotorDistractorCount(Math.max(0, Math.min(12, value)));
                      }
                    }}
                    style={{ width: '100%', opacity: oculomotorMode === 'multi-object' ? 1 : 0.5 }}
                  />
                </label>
              </div>
            </div>

            <div className="config-section">
              <div className="config-label">{t('home.config.colors')}</div>
              <div className="color-settings-row">
                <label className="color-field">
                  <span>{t('home.config.targetColor')}</span>
                  <input
                    type="color"
                    value={oculomotorTargetColor}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setOculomotorTargetColor(e.target.value)}
                  />
                </label>
                <label className="color-field">
                  <span>{t('home.config.bgColor')}</span>
                  <input
                    type="color"
                    value={oculomotorBackgroundColor}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setOculomotorBackgroundColor(e.target.value)}
                  />
                </label>
                <label className="color-field" style={{ flex: 2 }}>
                  <span>{t('home.config.opacity')} ({oculomotorTargetOpacity})</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={oculomotorTargetOpacity}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setOculomotorTargetOpacity(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </label>
              </div>
            </div>
            
            <div className="config-section">
              <div className="config-label">{t('home.config.advancedConfig')}</div>
              <div className="color-settings-row">
                <label className="color-field" style={{ flex: 1 }}>
                  <span>{t('home.config.bgImage')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleBackgroundImageChange(e.target.files?.[0])}
                    style={{ width: '100%' }}
                  />
                  {oculomotorBackgroundImage && (
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setOculomotorBackgroundImage(''); }}>
                      {t('btn.delete')}
                    </button>
                  )}
                </label>
                <label className="color-field" style={{ flex: 1 }}>
                  <span>{t('home.config.audio')}</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleAudioChange(e.target.files?.[0])}
                    style={{ width: '100%' }}
                  />
                  {oculomotorAudio && (
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setOculomotorAudio(''); }}>
                      {t('btn.delete')}
                    </button>
                  )}
                </label>
              </div>
              <div className="color-settings-row" style={{ marginTop: 16 }}>
                <label className="color-field" style={{ flex: 1 }}>
                  <span>{t('home.config.bounceJitter')} ({oculomotorBounceJitter})</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={oculomotorBounceJitter}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setOculomotorBounceJitter(parseInt(e.target.value, 10))}
                    style={{ width: '100%' }}
                  />
                </label>
              </div>
            </div>

            <div className="config-section">
              <div className="config-label">{t('settings.train.wgToggle')}</div>
              <label className="diff-btn" style={{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="diff-btn-label">{t('settings.train.wgToggle')}</span>
                  <span className="diff-btn-desc">{t('settings.train.wgDesc')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={oculomotorEnableWebgazer}
                  onChange={(e) => setOculomotorEnableWebgazer(e.target.checked)}
                  style={{ transform: 'scale(1.5)', cursor: 'pointer' }}
                />
              </label>
            </div>

            <div className="config-section">
              <div className="config-label">{t('home.config.targetShape')}</div>
              <div className="shape-selector">
                {targetShapeOptions.map((shape) => (
                  <button
                    key={shape.key}
                    className={`shape-btn ${oculomotorTargetShape === shape.key ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOculomotorTargetShape(shape.key);
                    }}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>
              {oculomotorTargetShape === 'custom' && (
                <div className="custom-image-field">
                  <input
                    className="input"
                    type="file"
                    accept="image/*"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleCustomTargetImageChange(e.target.files?.[0])}
                  />
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
            </div>

            <div className="config-actions">
              <button
                className={`btn btn-primary btn-lg config-start-btn ${isStartingTraining ? 'is-loading' : ''}`}
                disabled={isStartingTraining}
                aria-busy={isStartingTraining}
                onClick={(e) => { e.stopPropagation(); handleShowRules(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {showRulesButtonLabel}
                {isStartingTraining && <span className="loading-dot" />}
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={(e) => { e.stopPropagation(); setExpandedModule(null); }}
              >
                {t('btn.cancel')}
              </button>
            </div>

        </ConfigDialog>
      )}

      {expandedModule === 'gabor-patching' && rulesModule !== 'gabor-patching' && (
        <ConfigDialog
          ariaLabel={t('home.module.gaborPatching.title')}
          onClose={() => setExpandedModule(null)}
          summaryItems={[
            { value: gaborDiffOptions.find((d) => d.key === localDifficulty)?.label },
            { value: `${gaborDurationSec}s` },
            { value: gaborMaxSpots },
          ]}
        >
            {/* Difficulty */}
            <div className="config-section">
              <div className="config-label">{t('home.config.difficulty')}</div>
              <div className="difficulty-selector">
                {gaborDiffOptions.map((opt) => (
                  <button
                    key={opt.key}
                    className={`diff-btn ${localDifficulty === opt.key ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setLocalDifficulty(opt.key); }}
                  >
                    <span className="diff-btn-label">{opt.label}</span>
                    <span className="diff-btn-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="config-section">
              <div className="config-label">{t('home.config.gaborDuration')}</div>
              <div className="number-preset-selector">
                {durationPresets.map((duration) => (
                  <button
                    key={duration}
                    className={`number-preset-button ${gaborDurationSec === duration ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setGaborDurationSec(duration);
                    }}
                  >
                    {duration}s
                  </button>
                ))}
                <input
                  className="number-preset-input"
                  type="number"
                  min="15"
                  max="300"
                  value={gaborDurationSec}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (Number.isFinite(value)) {
                      setGaborDurationSec(Math.max(15, Math.min(300, value)));
                    }
                  }}
                />
              </div>
            </div>

            {/* Max Spots */}
            <div className="config-section">
              <div className="config-label">{t('home.config.gaborMaxSpots')}</div>
              <div className="difficulty-selector">
                <input
                  className="number-preset-input"
                  type="number"
                  min="3"
                  max="50"
                  value={gaborMaxSpots}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (Number.isFinite(value)) {
                      setGaborMaxSpots(Math.max(3, Math.min(50, value)));
                    }
                  }}
                  style={{ width: '100%', maxWidth: 200 }}
                />
              </div>
            </div>

            <div className="config-actions">
              <button
                className={`btn btn-primary btn-lg config-start-btn ${isStartingTraining ? 'is-loading' : ''}`}
                disabled={isStartingTraining}
                aria-busy={isStartingTraining}
                onClick={(e) => { e.stopPropagation(); handleShowRules(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {showRulesButtonLabel}
                {isStartingTraining && <span className="loading-dot" />}
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={(e) => { e.stopPropagation(); setExpandedModule(null); }}
              >
                {t('btn.cancel')}
              </button>
            </div>

        </ConfigDialog>
      )}

      {expandedModule === 'reading-training' && rulesModule !== 'reading-training' && (
        <ConfigDialog
          ariaLabel={t('home.module.reading.title')}
          onClose={() => setExpandedModule(null)}
          summaryItems={[
            { value: t('home.config.randomStory') },
          ]}
        >

            <div className="config-section">
              <div className="config-label">{t('home.config.readingSettings')}</div>
              <div className="difficulty-selector">
                <label className="diff-btn" style={{ cursor: 'default', alignItems: 'stretch' }}>
                  <span className="diff-btn-desc">{t('home.config.readingWps')}</span>
                  <input
                    className="number-preset-input"
                    type="number"
                    min="1"
                    max="20"
                    value={readingWPS}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (Number.isFinite(value)) setReadingWPS(Math.max(1, Math.min(20, value)));
                    }}
                    style={{ width: '100%' }}
                  />
                </label>
                <label className="diff-btn" style={{ cursor: 'default', alignItems: 'stretch' }}>
                  <span className="diff-btn-desc">{t('home.config.readingCrowding')}</span>
                  <input
                    className="number-preset-input"
                    type="number"
                    min="1"
                    max="5"
                    value={readingCrowding}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (Number.isFinite(value)) setReadingCrowding(Math.max(1, Math.min(5, value)));
                    }}
                    style={{ width: '100%' }}
                  />
                </label>
                <label className="diff-btn" style={{ cursor: 'default', alignItems: 'stretch' }}>
                  <span className="diff-btn-desc">{t('home.config.readingContrast')}</span>
                  <input
                    type="range"
                    min="0.0"
                    max="2.0"
                    step="0.1"
                    value={readingContrast}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setReadingContrast(parseFloat(e.target.value))}
                    style={{ width: '100%', marginTop: 'auto' }}
                  />
                  <span className="diff-btn-label">{readingContrast.toFixed(1)}</span>
                </label>
              </div>
            </div>

            <div className="config-actions">
              <button
                className={`btn btn-primary btn-lg config-start-btn ${isStartingTraining ? 'is-loading' : ''}`}
                disabled={isStartingTraining}
                aria-busy={isStartingTraining}
                onClick={(e) => { e.stopPropagation(); handleShowRules(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {showRulesButtonLabel}
                {isStartingTraining && <span className="loading-dot" />}
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={(e) => { e.stopPropagation(); setExpandedModule(null); }}
              >
                {t('btn.cancel')}
              </button>
            </div>

        </ConfigDialog>
      )}

      {expandedModule === 'driving-rehab' && rulesModule !== 'driving-rehab' && (
        <ConfigDialog
          ariaLabel={t('home.module.driving.title')}
          onClose={() => setExpandedModule(null)}
          summaryItems={[
            { value: drivingDifficultyLabels[drivingDifficulty] },
            { value: drivingRedFlashEnabled ? t('common.on') : t('common.off') },
          ]}
        >
            <div className="config-section">
              <div className="config-label">{t('home.config.drivingReactionDifficulty')}</div>
              <div className="difficulty-selector">
                {(['beginner', 'intermediate', 'advanced'] as const).map((level) => {
                  return (
                    <button
                      key={level}
                      className={`diff-btn ${drivingDifficulty === level ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setDrivingDifficulty(level); }}
                    >
                      <span className="diff-btn-label">{drivingDifficultyLabels[level]}</span>
                      <span className="diff-btn-desc">{drivingDifficultyDescs[level]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="config-section">
              <div className="config-label">{t('home.config.drivingAssist')}</div>
              <label className="diff-btn" style={{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="diff-btn-label">{t('home.config.drivingRedFlash')}</span>
                  <span className="diff-btn-desc">{t('home.config.drivingRedFlashDesc')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={drivingRedFlashEnabled}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDrivingRedFlashEnabled(e.target.checked)}
                  style={{ transform: 'scale(1.5)', cursor: 'pointer' }}
                />
              </label>
            </div>

            <div className="config-section">
              <div className="config-label">{t('home.config.drivingControls')}</div>
              <div className="difficulty-selector">
                {drivingControlOptions.map((option) => (
                  <button
                    key={option.key}
                    className={`diff-btn ${drivingControlMode === option.key ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDrivingControlMode(option.key);
                    }}
                  >
                    <span className="diff-btn-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="config-actions">
              <button
                className={`btn btn-primary btn-lg config-start-btn ${isStartingTraining ? 'is-loading' : ''}`}
                disabled={isStartingTraining}
                aria-busy={isStartingTraining}
                onClick={(e) => { e.stopPropagation(); handleShowRules(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {showRulesButtonLabel}
                {isStartingTraining && <span className="loading-dot" />}
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={(e) => { e.stopPropagation(); setExpandedModule(null); }}
              >
                {t('btn.cancel')}
              </button>
            </div>

        </ConfigDialog>
      )}

      {expandedModule === 'hart-chart' && rulesModule !== 'hart-chart' && (
        <ConfigDialog ariaLabel={t('home.module.hartChart.title')} onClose={() => setExpandedModule(null)}>
            <div className="config-section">
              <div className="config-label">{t('home.module.hartChart.title')}</div>
              <p className="calibration-warning-message">{t('home.config.hartChartSummary')}</p>
            </div>

            <div className="config-actions">
              <button
                className={`btn btn-primary btn-lg config-start-btn ${isStartingTraining ? 'is-loading' : ''}`}
                disabled={isStartingTraining}
                aria-busy={isStartingTraining}
                onClick={(e) => { e.stopPropagation(); handleShowRules(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {showRulesButtonLabel}
                {isStartingTraining && <span className="loading-dot" />}
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={(e) => { e.stopPropagation(); setExpandedModule(null); }}
              >
                {t('btn.cancel')}
              </button>
            </div>
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
            title={t(activeRulesModule.titleKey)}
            summaryTitle={rulesLabels.summary}
            summaryItems={activeRulesSummaryItems}
            sections={getVisionRuleSections(rulesModule, lang, t)}
            startLabel={rulesStartButtonLabel}
            backLabel={rulesLabels.back}
            startDisabled={isStartingTraining}
            startClassName={isStartingTraining ? 'is-loading' : ''}
            onStart={() => void handleStartTraining()}
            onBack={() => setRulesModule(null)}
            role="dialog"
            aria-modal
            aria-label={`${t(activeRulesModule.titleKey)} ${rulesLabels.label}`}
          />
        </div>
      )}
    </div>
  );
}

function getRulesLabels(lang: string) {
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

function getVisionRuleSections(
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
