// Canonical Hub-owned vision runtime dispatcher.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { initJsPsych } from 'jspsych';
import type { JsPsych } from 'jspsych';
import WebGazerExtension from '@jspsych/extension-webgazer';
import {
  NotifyHubTrainingAbort,
  RequestHubTrainingConfiguration,
} from '@rehab-trainer/ui/embeddedTraining';
import { useMediaPermissionPreflight } from '@rehab-trainer/ui/hooks/useMediaPermissionPreflight';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { IsTrainingFlowLaunchState } from '@rehab-trainer/ui/trainingFlow';
import { useT } from '../../i18n';
import { BuildTimeline } from '../../experiment/timeline';
import { ParseDrivingWheelCalibration } from '../../experiment/plugins/driving/driving-input';
import { DisposeDrivingRehabRuntime } from '../../experiment/plugins/driving/driving-runtime-lifecycle';
import {
  getActiveUser,
  GetSetting,
  IsDrivingControlMode,
  IsDrivingRenderQualityLevel,
} from '../../utils/settings';
import { DestroyPixiTrainingRuntime } from '../../utils/pixiPool';
import { soundManager } from '../../utils/soundManager';
import { SaveTrainingRecord } from '../../utils/trainingRecords';
import { EnsureWebGazerLoaded } from '../../utils/webgazerLoader';
import { CleanupWebGazerRuntime, ResetWebGazerCalibrationData } from '../../utils/webgazerCalibration';
import {
  GetDrivingInputCapabilitiesSnapshot,
  IsDrivingControlModeAvailable,
  IsDrivingWheelCalibrationUsable,
  useDrivingInputCapabilities,
} from '../../utils/drivingInputCapabilities';
import {
  isOculomotorMode,
  isOculomotorPattern,
  isOculomotorSpeedUnit,
  isOculomotorTargetShape,
} from './oculomotor/presets';
import { getRandomStory } from './reading/stories';
import { TrainingResults } from './results/TrainingResults';
import type { TrialData } from './types';

type Phase = 'running' | 'results';

const trainingLayoutWaitTimeoutMs = 800;

function HasUsableLayout(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return element.isConnected && rect.width > 0 && rect.height > 0;
}

function WaitForUsableLayout(element: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let observer: ResizeObserver | null = null;
    let frameId = 0;
    let timeoutId = 0;

    const cleanup = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (timeoutId) window.clearTimeout(timeoutId);
      observer?.disconnect();
    };

    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };

    const check = () => {
      if (done) return;
      if (!HasUsableLayout(element)) {
        frameId = window.requestAnimationFrame(check);
        return;
      }
      frameId = window.requestAnimationFrame(finish);
    };

    frameId = window.requestAnimationFrame(check);
    timeoutId = window.setTimeout(finish, trainingLayoutWaitTimeoutMs);

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(check);
      observer.observe(element);
    }
  });
}

export function TrainingPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const moduleId = searchParams.get('module') || 'moving-card';

  if (!IsTrainingFlowLaunchState(location.state)) {
    return <Navigate to={`/?module=${encodeURIComponent(moduleId)}`} replace />;
  }

  return <TrainingRuntimePage />;
}

function TrainingRuntimePage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const moduleId = searchParams.get('module') || 'moving-card';
  const difficulty = searchParams.get('difficulty') || GetSetting('difficulty');
  const totalRounds = parseInt(searchParams.get('rounds') || '', 10) || GetSetting('totalRounds');
  const requestedMode = searchParams.get('mode') || GetSetting('oculomotorMode');
  const requestedPattern = searchParams.get('pattern') || GetSetting('oculomotorPattern');
  const oculomotorMode = isOculomotorMode(requestedMode) ? requestedMode : GetSetting('oculomotorMode');
  const oculomotorPattern = isOculomotorPattern(requestedPattern)
    ? requestedPattern
    : GetSetting('oculomotorPattern');
  const oculomotorDurationSec = parseInt(searchParams.get('duration') || '', 10)
    || GetSetting('oculomotorDurationSec');
  const oculomotorSpeedValue = parseFloat(searchParams.get('speed') || '')
    || GetSetting('oculomotorSpeedValue');
  const requestedSpeedUnit = searchParams.get('speedUnit') || GetSetting('oculomotorSpeedUnit');
  const oculomotorSpeedUnit = isOculomotorSpeedUnit(requestedSpeedUnit)
    ? requestedSpeedUnit
    : GetSetting('oculomotorSpeedUnit');
  const oculomotorTargetRadiusPx = parseFloat(searchParams.get('size') || '')
    || GetSetting('oculomotorTargetRadiusPx');
  const oculomotorTargetCount = parseInt(searchParams.get('targets') || '', 10)
    || GetSetting('oculomotorTargetCount');
  const oculomotorDistractorCount = parseInt(searchParams.get('distractors') || '', 10);
  const requestedTargetShape = searchParams.get('shape') || GetSetting('oculomotorTargetShape');
  const oculomotorTargetShape = isOculomotorTargetShape(requestedTargetShape)
    ? requestedTargetShape
    : GetSetting('oculomotorTargetShape');
  const oculomotorTargetColor = searchParams.get('targetColor') || GetSetting('oculomotorTargetColor');
  const oculomotorBackgroundColor = searchParams.get('backgroundColor') || GetSetting('oculomotorBackgroundColor');
  const oculomotorCustomTargetImage = GetSetting('oculomotorCustomTargetImage');
  const oculomotorBehavior = GetSetting('oculomotorBehavior');
  const oculomotorDistractorBrightness = GetSetting('oculomotorDistractorBrightness');
  const oculomotorTargetOpacity = GetSetting('oculomotorTargetOpacity');
  const oculomotorBackgroundImage = GetSetting('oculomotorBackgroundImage');
  const oculomotorAudio = GetSetting('oculomotorAudio');
  const oculomotorBounceJitter = GetSetting('oculomotorBounceJitter');
  const oculomotorMotionDirection = GetSetting('oculomotorMotionDirection');
  const oculomotorShowTrail = GetSetting('oculomotorShowTrail');
  const oculomotorLetterEnabled = GetSetting('oculomotorLetterEnabled');
  const oculomotorLetterColor = GetSetting('oculomotorLetterColor');
  const oculomotorLetterWeight = GetSetting('oculomotorLetterWeight');
  const oculomotorLetterScale = GetSetting('oculomotorLetterScale');
  const oculomotorLilacChaserScale = GetSetting('oculomotorLilacChaserScale');
  const oculomotorLilacChaserColor = GetSetting('oculomotorLilacChaserColor');
  const oculomotorViewingDistanceCm = GetSetting('oculomotorViewingDistanceCm');
  const oculomotorCssPxPerCm = GetSetting('oculomotorCssPxPerCm');
  const enableWebGazer = moduleId === 'oculomotor-training' && GetSetting('oculomotorEnableWebgazer');
  const showGazepoint = enableWebGazer && GetSetting('oculomotorShowGazepoint');
  const requestedDrivingFlash = searchParams.get('redFlash');
  const drivingRedFlashEnabled = requestedDrivingFlash === null
    ? GetSetting('drivingRedFlashEnabled')
    : requestedDrivingFlash === 'true';
  const drivingDifficulty = (searchParams.get('drivingDifficulty') as any) || GetSetting('drivingDifficulty');
  const requestedDrivingControlMode = searchParams.get('controlMode');
  const drivingControlMode = IsDrivingControlMode(requestedDrivingControlMode)
    ? requestedDrivingControlMode
    : GetSetting('drivingControlMode');
  const requestedDrivingRenderQuality = searchParams.get('renderQuality');
  const drivingRenderQuality = IsDrivingRenderQualityLevel(requestedDrivingRenderQuality)
    ? requestedDrivingRenderQuality
    : GetSetting('drivingRenderQuality');
  const gaborDurationSec = parseInt(searchParams.get('duration') || '', 10) || 60;
  const gaborMaxSpots = parseInt(searchParams.get('maxSpots') || '', 10) || 10;
  const drivingInputCapabilities = useDrivingInputCapabilities();
  const drivingWheelCalibration = ParseDrivingWheelCalibration(
    GetSetting('drivingWheelCalibration'),
  );
  const drivingInputKey = `driving:${drivingControlMode}`;
  const drivingInputAvailable = IsDrivingControlModeAvailable(
    drivingControlMode,
    drivingInputCapabilities,
  ) && (
    drivingControlMode !== 'wheel'
    || IsDrivingWheelCalibrationUsable(drivingWheelCalibration)
  );

  const [phase, setPhase] = useState<Phase>('running');
  const cameraPermission = useMediaPermissionPreflight({
    active: enableWebGazer && phase === 'running',
    video: true,
  });
  const [results, setResults] = useState<TrialData[]>([]);
  const [acceptedDrivingInputKey, setAcceptedDrivingInputKey] = useState<string | null>(() => (
    moduleId === 'driving-rehab'
    && (() => {
      const capabilities = GetDrivingInputCapabilitiesSnapshot();
      return IsDrivingControlModeAvailable(drivingControlMode, capabilities)
        && (
          drivingControlMode !== 'wheel'
          || IsDrivingWheelCalibrationUsable(drivingWheelCalibration)
        );
    })()
      ? drivingInputKey
      : null
  ));
  const jsPsychRef = useRef<JsPsych | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipFinishRef = useRef(false);
  const userName = getActiveUser() || t('exp.unknownUser');
  const drivingInputAccepted = moduleId !== 'driving-rehab'
    || acceptedDrivingInputKey === drivingInputKey;
  const drivingInputGateMessage = drivingControlMode === 'arrow' || drivingControlMode === 'wasd'
    ? t('home.config.drivingKeyboardUnknown')
    : drivingControlMode === 'touch'
      ? t('home.config.drivingTouchMissing')
      : drivingInputCapabilities.wheelDevice
        ? t('home.config.drivingWheelCalibrationStart')
        : t('home.config.drivingWheelMissing');

  useEffect(() => {
    if (!enableWebGazer
      || !['denied', 'error', 'unsupported'].includes(cameraPermission.status)) return;
    if (!RequestHubTrainingConfiguration()) {
      navigate(`/?module=${encodeURIComponent(moduleId)}`, { replace: true });
    }
  }, [cameraPermission.status, enableWebGazer, moduleId, navigate]);

  useEffect(() => {
    if (moduleId === 'driving-rehab' && drivingInputAvailable) {
      setAcceptedDrivingInputKey(drivingInputKey);
    }
  }, [drivingInputAvailable, drivingInputKey, moduleId]);

  useEffect(() => {
    if (phase !== 'running') return;
    if (!drivingInputAccepted) return;
    if (enableWebGazer && cameraPermission.status !== 'granted') return;
    if (!containerRef.current) return;
    if (jsPsychRef.current) return;

    const container = containerRef.current;

    let cancelled = false;

    const setupExperiment = async () => {
      await WaitForUsableLayout(container);
      if (cancelled) return;

      if (enableWebGazer) {
        await EnsureWebGazerLoaded();
        await ResetWebGazerCalibrationData();
        if (cancelled) return;
      }

      const storyData = moduleId === 'reading-training'
        ? getRandomStory(lang) || undefined
        : undefined;

      const jsPsych = initJsPsych({
        display_element: container,
        extensions: enableWebGazer
          ? [{ type: WebGazerExtension, params: { sampling_interval: 100 } }]
          : [],
        on_finish: async () => {
          if (skipFinishRef.current) {
            skipFinishRef.current = false;
            return;
          }
          const timelineData = jsPsych.data.get().values() as TrialData[];
          const data = moduleId === 'oculomotor-training'
            ? timelineData
              .filter((item) => item.trial_type === 'pixi-oculomotor-training')
            : timelineData;
          await SaveTrainingRecord({
            results: data,
            userName,
            moduleId,
            difficulty: moduleId === 'driving-rehab' ? drivingDifficulty : difficulty,
            oculomotorMode,
            oculomotorPattern,
            config: {
              totalRounds,
              oculomotorMode,
              oculomotorPattern,
              oculomotorDurationSec,
              oculomotorBehavior,
              oculomotorSpeedUnit,
              oculomotorSpeedValue,
              oculomotorTargetRadiusPx,
              oculomotorTargetCount,
              oculomotorDistractorBrightness,
              oculomotorTargetColor,
              oculomotorTargetOpacity,
              oculomotorTargetShape,
              oculomotorMotionDirection,
              oculomotorShowTrail,
              oculomotorLetterEnabled,
              oculomotorLetterColor,
              oculomotorLetterWeight,
              oculomotorLetterScale,
              oculomotorLilacChaserScale,
              oculomotorLilacChaserColor,
              oculomotorViewingDistanceCm,
              oculomotorCssPxPerCm,
              oculomotorEnableWebgazer: enableWebGazer,
              oculomotorShowGazepoint: showGazepoint,
              oculomotorDistractorCount: Number.isFinite(oculomotorDistractorCount)
                ? oculomotorDistractorCount
                : GetSetting('oculomotorDistractorCount'),
              gaborDurationSec,
              gaborMaxSpots,
              readingWPS: GetSetting('readingWPS'),
              readingCrowding: GetSetting('readingCrowding'),
              readingContrast: GetSetting('readingContrast'),
              drivingRedFlashEnabled,
              drivingDifficulty,
              drivingControlMode,
              drivingRenderQuality,
            },
          });
          soundManager.destroy();
          DestroyPixiTrainingRuntime(moduleId);
          setResults(data);
          jsPsychRef.current = null;
          setPhase('results');
        },
      });

      const timeline = await BuildTimeline(moduleId, {
        difficulty,
        jsPsych,
        totalRounds,
        oculomotor: {
          mode: oculomotorMode,
          pattern: oculomotorPattern,
          durationSec: oculomotorDurationSec,
          behavior: oculomotorBehavior,
          speedUnit: oculomotorSpeedUnit,
          speedValue: oculomotorSpeedValue,
          targetRadiusPx: oculomotorTargetRadiusPx,
          targetCount: oculomotorTargetCount,
          distractorCount: Number.isFinite(oculomotorDistractorCount)
            ? oculomotorDistractorCount
            : GetSetting('oculomotorDistractorCount'),
          distractorBrightness: oculomotorDistractorBrightness,
          targetColor: oculomotorTargetColor,
          backgroundColor: oculomotorBackgroundColor,
          targetShape: oculomotorTargetShape,
          customTargetImage: oculomotorCustomTargetImage,
          opacity: oculomotorTargetOpacity,
          backgroundImage: oculomotorBackgroundImage,
          audio: oculomotorAudio,
          bounceJitter: oculomotorBounceJitter,
          motionDirection: oculomotorMotionDirection,
          showTrail: oculomotorShowTrail,
          letterEnabled: oculomotorLetterEnabled,
          letterColor: oculomotorLetterColor,
          letterWeight: oculomotorLetterWeight,
          letterScale: oculomotorLetterScale,
          lilacChaserScale: oculomotorLilacChaserScale,
          lilacChaserColor: oculomotorLilacChaserColor,
          viewingDistanceCm: oculomotorViewingDistanceCm,
          cssPxPerCm: oculomotorCssPxPerCm,
          showGazepoint,
          webGazerCalibration: {
            beginInstructions: t('settings.wg.beginInstructions'),
            beginPrompt: t('settings.wg.beginPrompt'),
            beginTitle: t('settings.wg.beginTitle'),
            title: t('settings.wg.title'),
            cameraInstructions: t('settings.wg.cameraInstructions'),
            cameraPermissionButtonText: t('settings.wg.cameraPermissionButton'),
            cameraTitle: t('settings.wg.cameraTitle'),
            calibrationDoneText: t('settings.wg.calibrationDone'),
            continueButtonText: t('settings.wg.continueButton'),
            instruction1: t('settings.wg.inst1'),
            instruction2: t('settings.wg.inst2'),
            instruction3: t('settings.wg.inst3'),
            buttonText: t('settings.wg.startBtn'),
            recalibrateInstructions: t('settings.wg.recalibrateInstructions'),
            recalibrateTitle: t('settings.wg.recalibrateTitle'),
            showDataMissing: t('settings.wg.showDataMissing'),
            showDataPrompt: t('settings.wg.showDataPrompt'),
            showDataSummary: t('settings.wg.showDataSummary'),
            showDataTitle: t('settings.wg.showDataTitle'),
            validationInstructions: t('settings.wg.validationInstructions'),
            validationNoClick: t('settings.wg.validationNoClick'),
            validationTitle: t('settings.wg.validationTitle'),
          },
        },
        gabor: {
          durationSec: gaborDurationSec,
          maxSpots: gaborMaxSpots,
        },
        reading: {
          story: storyData,
          wps: GetSetting('readingWPS'),
          crowding: GetSetting('readingCrowding'),
          contrast: GetSetting('readingContrast'),
        },
        driving: {
          redFlashEnabled: drivingRedFlashEnabled,
          difficulty: drivingDifficulty,
          controlMode: drivingControlMode,
          wheelCalibration: drivingWheelCalibration,
          renderQuality: drivingRenderQuality,
          language: lang,
        },
      });

      if (cancelled) return;
      jsPsychRef.current = jsPsych;
      jsPsych.run(timeline as any);
    };

    void setupExperiment().catch((error) => {
      if (cancelled) return;
      console.error('Unable to initialize visual training.', error);
      alert(t('home.trainingLoadError'));
      if (!RequestHubTrainingConfiguration()) {
        NotifyHubTrainingAbort();
        navigate('/');
      }
    });

    return () => {
      cancelled = true;
      soundManager.destroy();
      DestroyPixiTrainingRuntime(moduleId);
      if (moduleId === 'driving-rehab') DisposeDrivingRehabRuntime();
      const activeJsPsych = jsPsychRef.current;
      jsPsychRef.current = null;
      if (activeJsPsych) {
        skipFinishRef.current = true;
        activeJsPsych.abortExperiment();
      }
      CleanupWebGazerRuntime();
    };
  }, [
    phase,
    moduleId,
    difficulty,
    totalRounds,
    oculomotorMode,
    oculomotorPattern,
    oculomotorDurationSec,
    oculomotorBehavior,
    oculomotorSpeedUnit,
    oculomotorSpeedValue,
    oculomotorTargetRadiusPx,
    oculomotorTargetCount,
    oculomotorDistractorCount,
    oculomotorDistractorBrightness,
    oculomotorTargetColor,
    oculomotorBackgroundColor,
    oculomotorTargetShape,
    oculomotorCustomTargetImage,
    oculomotorTargetOpacity,
    oculomotorBackgroundImage,
    oculomotorAudio,
    oculomotorBounceJitter,
    oculomotorMotionDirection,
    oculomotorShowTrail,
    oculomotorLetterEnabled,
    oculomotorLetterColor,
    oculomotorLetterWeight,
    oculomotorLetterScale,
    oculomotorLilacChaserScale,
    oculomotorLilacChaserColor,
    oculomotorViewingDistanceCm,
    oculomotorCssPxPerCm,
    enableWebGazer,
    cameraPermission.status,
    showGazepoint,
    gaborDurationSec,
    gaborMaxSpots,
    drivingRedFlashEnabled,
    drivingDifficulty,
    drivingControlMode,
    drivingInputAccepted,
    drivingRenderQuality,
    userName,
    lang,
    navigate,
    t,
  ]);

  const abortTraining = useCallback(() => {
    if (phase !== 'running') return;
    skipFinishRef.current = true;
    soundManager.destroy();
    const jsPsych = jsPsychRef.current;
    jsPsychRef.current = null;
    jsPsych?.abortExperiment();
    DestroyPixiTrainingRuntime(moduleId);
    if (moduleId === 'driving-rehab') DisposeDrivingRehabRuntime();
    setResults([]);
    navigate('/');
  }, [moduleId, navigate, phase]);

  useTrainingAbort({
    active: phase === 'running',
    onAbort: abortTraining,
  });

  if (phase === 'running') {
    if (!drivingInputAccepted) {
      return (
        <div className="experiment-container">
          <section
            role="alert"
            aria-live="polite"
            style={{
              width: 'min(560px, calc(100% - 32px))',
              margin: 'auto',
              padding: '24px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-l)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-lg)',
              textAlign: 'center',
            }}
          >
            <h1 style={{ margin: '0 0 10px', fontSize: '1.35rem' }}>
              {t('home.config.drivingControlUnavailable')}
            </h1>
            <p style={{ margin: '0 0 18px', color: 'var(--text-muted)' }}>
              {drivingInputGateMessage}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' }}>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => drivingInputCapabilities.rescan()}
              >
                {t('home.config.drivingRescanInputs')}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => navigate('/?module=driving-rehab')}
              >
                {t('common.back')}
              </button>
            </div>
          </section>
        </div>
      );
    }
    return (
      <div key="running" className="experiment-container">
        <div
          ref={containerRef}
          className={enableWebGazer ? 'webgazer-fullscreen-stage' : undefined}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }

  return (
    <TrainingResults
      moduleId={moduleId}
      results={results}
      userName={userName}
      t={t}
      oculomotorMode={oculomotorMode}
      oculomotorPattern={oculomotorPattern}
      onBackHome={() => navigate('/')}
    />
  );
}
