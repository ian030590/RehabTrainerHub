import { useState, useEffect } from 'react';
import { useT } from '../i18n';
import { useNavigate } from 'react-router-dom';
import {
  isCalibrated,
  DRIVING_DURATION_MIN_SEC,
  DRIVING_DURATION_MAX_SEC,
} from '../utils/settings';
import { UserSelector } from '../components/UserSelector';
import { pixiAppManager } from '../utils/pixiPool';
import { SoundManager } from '../utils/soundManager';
import { useActiveUser } from '../utils/useActiveUser';
import { useAppSetting } from '../utils/useAppSetting';
import { ConfigDialog } from '../components/ConfigDialog';
import { NumberPresetSelector } from '../components/NumberPresetSelector';
import { SelectionCard } from '../components/SelectionCard';
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
  const { t } = useT();
  const navigate = useNavigate();
  const activeUser = useActiveUser();

  // ── Module expansion state ──
  const [expandedModule, setExpandedModule] = useState<TrainingModuleId | null>(null);
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
  const [drivingDurationSec, setDrivingDurationSec] = useAppSetting('drivingDurationSec');
  const [drivingRedFlashEnabled, setDrivingRedFlashEnabled] = useAppSetting('drivingRedFlashEnabled');
  const [drivingDifficulty, setDrivingDifficulty] = useAppSetting('drivingDifficulty');
  const [drivingControlMode, setDrivingControlMode] = useAppSetting('drivingControlMode');
  const [prewarmed, setPrewarmed] = useState(() => pixiAppManager.ready);
  const [isStartingTraining, setIsStartingTraining] = useState(false);
  const startTrainingButtonLabel = isStartingTraining ? t('btn.preparingTraining') : t('btn.startTraining');

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
    setPrewarmed(false);
    let cancelled = false;
    Promise.all([
      preloadTrainingRoute(),
      preloadTrainingEngine(expandedModule),
    ]).then(() => {
      if (!cancelled) setPrewarmed(true);
    }).catch(() => {
      if (!cancelled) setPrewarmed(false);
    });
    return () => { cancelled = true; };
  }, [expandedModule]);

  // ── Handlers ──
  const handleCardClick = (moduleId: TrainingModuleId) => {
    if (isStartingTraining) return;
    if (!activeUser) {
      alert(t('home.pleaseSelectUser'));
      return;
    }
    setExpandedModule(expandedModule === moduleId ? null : moduleId);
  };

  const handleStartTraining = async () => {
    if (!expandedModule || !activeUser || isStartingTraining) return;
    const moduleToStart = expandedModule;
    setIsStartingTraining(true);

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
      setPrewarmed(false);
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
      navigate(`/training?module=driving-rehab&duration=${drivingDurationSec}&redFlash=${drivingRedFlashEnabled}&drivingDifficulty=${drivingDifficulty}&controlMode=${drivingControlMode}`);
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
  const drivingDurationPresets = [80, 100, 120, 140];
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

  return (
    <div className="page-content">
      {/* ── User Selector ── */}
      <UserSelector />

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
        {TRAINING_MODULES.map((module) => (
          <SelectionCard
            key={module.id}
            title={t(module.titleKey)}
            description={t(module.descKey)}
            icon={module.icon}
            isSelected={expandedModule === module.id}
            actionLabel={expandedModule === module.id ? t('btn.collapseSettings') : t('btn.selectModule')}
            onSelect={() => handleCardClick(module.id)}
          />
        ))}
      </div>

      {/* ── Module Config Panel ── */}
      {expandedModule === 'moving-card' && (
        <ConfigDialog ariaLabel={t('home.module.movingCard.title')} onClose={() => setExpandedModule(null)}>
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
                onClick={(e) => { e.stopPropagation(); handleStartTraining(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {startTrainingButtonLabel}
                {isStartingTraining ? <span className="loading-dot" /> : prewarmed && <span className="ready-dot" />}
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={(e) => { e.stopPropagation(); setExpandedModule(null); }}
              >
                {t('btn.cancel')}
              </button>
            </div>

            {/* Current settings summary */}
            <div className="config-summary">
              {t('home.config.user')} <strong>{activeUser}</strong> ·{' '}
              {t('home.config.diffLabel')} <strong>{diffOptions.find((d) => d.key === localDifficulty)?.label}</strong> ·{' '}
              {t('home.config.roundsLabel')} <strong>{localRounds}</strong>
            </div>
        </ConfigDialog>
      )}

      {expandedModule === 'oculomotor-training' && (
        <ConfigDialog ariaLabel={t('home.module.oculomotor.title')} onClose={() => setExpandedModule(null)}>
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
                    style={{ fontSize: 12, width: '100%' }}
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
                    style={{ fontSize: 12, width: '100%' }}
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
                  <span className="diff-btn-desc" style={{ fontSize: '0.85em' }}>{t('settings.train.wgDesc')}</span>
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
                onClick={(e) => { e.stopPropagation(); handleStartTraining(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {startTrainingButtonLabel}
                {isStartingTraining ? <span className="loading-dot" /> : prewarmed && <span className="ready-dot" />}
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={(e) => { e.stopPropagation(); setExpandedModule(null); }}
              >
                {t('btn.cancel')}
              </button>
            </div>

            <div className="config-summary">
              {t('home.config.user')} <strong>{activeUser}</strong> ·{' '}
              {t('home.config.modeLabel')} <strong>{t(`preset.mode.${oculomotorModes.find((mode) => mode.id === oculomotorMode)?.id}` as any)}</strong> ·{' '}
              {t('home.config.durationLabel')} <strong>{oculomotorDurationSec}s</strong>
            </div>
        </ConfigDialog>
      )}

      {expandedModule === 'gabor-patching' && (
        <ConfigDialog ariaLabel={t('home.module.gaborPatching.title')} onClose={() => setExpandedModule(null)}>
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
                onClick={(e) => { e.stopPropagation(); handleStartTraining(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {startTrainingButtonLabel}
                {isStartingTraining ? <span className="loading-dot" /> : prewarmed && <span className="ready-dot" />}
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={(e) => { e.stopPropagation(); setExpandedModule(null); }}
              >
                {t('btn.cancel')}
              </button>
            </div>

            <div className="config-summary">
              {t('home.config.user')} <strong>{activeUser}</strong> ·{' '}
              {t('home.config.diffLabel')} <strong>{gaborDiffOptions.find((d) => d.key === localDifficulty)?.label}</strong> ·{' '}
              {t('home.config.durationLabel')} <strong>{gaborDurationSec}s</strong> ·{' '}
              {t('home.config.gaborMaxSpots')} <strong>{gaborMaxSpots}</strong>
            </div>
        </ConfigDialog>
      )}

      {expandedModule === 'reading-training' && (
        <ConfigDialog ariaLabel={t('home.module.reading.title')} onClose={() => setExpandedModule(null)}>

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
                  <div style={{ textAlign: 'center', fontSize: 12 }}>{readingContrast.toFixed(1)}</div>
                </label>
              </div>
            </div>

            <div className="config-actions">
              <button
                className={`btn btn-primary btn-lg config-start-btn ${isStartingTraining ? 'is-loading' : ''}`}
                disabled={isStartingTraining}
                aria-busy={isStartingTraining}
                onClick={(e) => { e.stopPropagation(); handleStartTraining(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {startTrainingButtonLabel}
                {isStartingTraining ? <span className="loading-dot" /> : prewarmed && <span className="ready-dot" />}
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={(e) => { e.stopPropagation(); setExpandedModule(null); }}
              >
                {t('btn.cancel')}
              </button>
            </div>

            <div className="config-summary">
              {t('home.config.user')} <strong>{activeUser}</strong> ·{' '}
              {t('home.config.storyLabel')} <strong>{t('home.config.randomStory')}</strong>
            </div>
        </ConfigDialog>
      )}

      {expandedModule === 'driving-rehab' && (
        <ConfigDialog ariaLabel={t('home.module.driving.title')} onClose={() => setExpandedModule(null)}>
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
              <div className="config-label">{t('home.config.drivingDuration')}</div>
              <div className="number-preset-selector">
                {drivingDurationPresets.map((duration) => (
                  <button
                    key={duration}
                    className={`number-preset-button ${drivingDurationSec === duration ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDrivingDurationSec(duration);
                    }}
                  >
                    {duration}s
                  </button>
                ))}
                <input
                  className="number-preset-input"
                  type="number"
                  min={DRIVING_DURATION_MIN_SEC}
                  max={DRIVING_DURATION_MAX_SEC}
                  value={drivingDurationSec}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (Number.isFinite(value)) {
                      setDrivingDurationSec(Math.max(DRIVING_DURATION_MIN_SEC, Math.min(DRIVING_DURATION_MAX_SEC, value)));
                    }
                  }}
                />
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
                onClick={(e) => { e.stopPropagation(); handleStartTraining(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {startTrainingButtonLabel}
                {isStartingTraining ? <span className="loading-dot" /> : prewarmed && <span className="ready-dot" />}
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={(e) => { e.stopPropagation(); setExpandedModule(null); }}
              >
                {t('btn.cancel')}
              </button>
            </div>

            <div className="config-summary">
              {t('home.config.user')} <strong>{activeUser}</strong> ·{' '}
              {t('home.config.durationLabel')} <strong>{drivingDurationSec}s</strong> ·{' '}
              {t('home.config.diffLabel')} <strong>{drivingDifficultyLabels[drivingDifficulty]}</strong> ·{' '}
              {t('home.config.drivingRedFlash')} <strong>{drivingRedFlashEnabled ? t('common.on') : t('common.off')}</strong>
            </div>
        </ConfigDialog>
      )}

      {expandedModule === 'hart-chart' && (
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
                onClick={(e) => { e.stopPropagation(); handleStartTraining(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {startTrainingButtonLabel}
                {isStartingTraining ? <span className="loading-dot" /> : prewarmed && <span className="ready-dot" />}
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
    </div>
  );
}
