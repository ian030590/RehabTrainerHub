import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { initJsPsych } from 'jspsych';
import type { JsPsych } from 'jspsych';
import WebGazerExtension from '@jspsych/extension-webgazer';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useT } from '../../i18n';
import { BuildTimeline } from '../../experiment/timeline';
import {
  getActiveUser,
  GetSetting,
  IsDrivingControlMode,
} from '../../utils/settings';
import { DestroyPixiTrainingRuntime } from '../../utils/pixiPool';
import { soundManager } from '../../utils/soundManager';
import { SaveTrainingRecord } from '../../utils/trainingRecords';
import { DownloadTrainingCsv } from './exportCsv';
import {
  isOculomotorMode,
  isOculomotorPattern,
} from './oculomotor/presets';
import type { OculomotorTargetShape } from './oculomotor/types';
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
  const oculomotorSpeedDegPerSec = parseFloat(searchParams.get('speed') || '')
    || GetSetting('oculomotorSpeedDegPerSec');
  const oculomotorTargetSizeMm = parseFloat(searchParams.get('size') || '')
    || GetSetting('oculomotorTargetSizeMm');
  const oculomotorDistractorCount = parseInt(searchParams.get('distractors') || '', 10);
  const requestedTargetShape = searchParams.get('shape') || GetSetting('oculomotorTargetShape');
  const oculomotorTargetShape = IsOculomotorTargetShape(requestedTargetShape)
    ? requestedTargetShape
    : GetSetting('oculomotorTargetShape');
  const oculomotorTargetColor = searchParams.get('targetColor') || GetSetting('oculomotorTargetColor');
  const oculomotorBackgroundColor = searchParams.get('backgroundColor') || GetSetting('oculomotorBackgroundColor');
  const oculomotorCustomTargetImage = GetSetting('oculomotorCustomTargetImage');
  const enableWebGazer = GetSetting('oculomotorEnableWebgazer');
  const requestedDrivingFlash = searchParams.get('redFlash');
  const drivingRedFlashEnabled = requestedDrivingFlash === null
    ? GetSetting('drivingRedFlashEnabled')
    : requestedDrivingFlash === 'true';
  const drivingDifficulty = (searchParams.get('drivingDifficulty') as any) || GetSetting('drivingDifficulty');
  const requestedDrivingControlMode = searchParams.get('controlMode');
  const drivingControlMode = IsDrivingControlMode(requestedDrivingControlMode)
    ? requestedDrivingControlMode
    : GetSetting('drivingControlMode');
  const gaborDurationSec = parseInt(searchParams.get('duration') || '', 10) || 60;
  const gaborMaxSpots = parseInt(searchParams.get('maxSpots') || '', 10) || 10;

  const [phase, setPhase] = useState<Phase>('running');
  const [results, setResults] = useState<TrialData[]>([]);
  const jsPsychRef = useRef<JsPsych | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipFinishRef = useRef(false);
  const userName = getActiveUser() || t('exp.unknownUser');

  useEffect(() => {
    if (phase !== 'running') return;
    if (!containerRef.current) return;
    if (jsPsychRef.current) return;

    const container = containerRef.current;

    let cancelled = false;

    const setupExperiment = async () => {
      await WaitForUsableLayout(container);
      if (cancelled) return;

      const storyData = moduleId === 'reading-training'
        ? getRandomStory(lang) || undefined
        : undefined;

      const jsPsych = initJsPsych({
        display_element: container,
        extensions: enableWebGazer ? [{ type: WebGazerExtension }] : [],
        on_finish: async () => {
          if (skipFinishRef.current) {
            skipFinishRef.current = false;
            return;
          }
          const data = jsPsych.data.get().values() as TrialData[];
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
              oculomotorSpeedDegPerSec,
              oculomotorTargetSizeMm,
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
        totalRounds,
        oculomotor: {
          mode: oculomotorMode,
          pattern: oculomotorPattern,
          durationSec: oculomotorDurationSec,
          speedDegPerSec: oculomotorSpeedDegPerSec,
          targetSizeMm: oculomotorTargetSizeMm,
          distractorCount: Number.isFinite(oculomotorDistractorCount)
            ? oculomotorDistractorCount
            : GetSetting('oculomotorDistractorCount'),
          targetColor: oculomotorTargetColor,
          backgroundColor: oculomotorBackgroundColor,
          targetShape: oculomotorTargetShape,
          customTargetImage: oculomotorCustomTargetImage,
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
          language: lang,
        },
      });

      if (cancelled) return;
      jsPsychRef.current = jsPsych;
      jsPsych.run(timeline as any);
    };

    void setupExperiment();

    return () => {
      cancelled = true;
      soundManager.destroy();
      DestroyPixiTrainingRuntime(moduleId);
      if (jsPsychRef.current) {
        jsPsychRef.current = null;
      }
    };
  }, [
    phase,
    moduleId,
    difficulty,
    totalRounds,
    oculomotorMode,
    oculomotorPattern,
    oculomotorDurationSec,
    oculomotorSpeedDegPerSec,
    oculomotorTargetSizeMm,
    oculomotorDistractorCount,
    oculomotorTargetColor,
    oculomotorBackgroundColor,
    oculomotorTargetShape,
    oculomotorCustomTargetImage,
    enableWebGazer,
    gaborDurationSec,
    gaborMaxSpots,
    drivingRedFlashEnabled,
    drivingDifficulty,
    drivingControlMode,
    userName,
    lang,
  ]);

  const abortTraining = useCallback(() => {
    if (phase !== 'running') return;
    skipFinishRef.current = true;
    soundManager.destroy();
    const jsPsych = jsPsychRef.current;
    jsPsychRef.current = null;
    jsPsych?.abortExperiment();
    DestroyPixiTrainingRuntime(moduleId);
    setResults([]);
    navigate('/');
  }, [moduleId, navigate, phase]);

  useTrainingAbort({
    active: phase === 'running',
    onAbort: abortTraining,
  });

  const downloadCSV = useCallback(() => {
    DownloadTrainingCsv({
      results,
      userName,
      moduleId,
      difficulty,
      oculomotorMode,
      oculomotorPattern,
      t,
    });
  }, [results, userName, moduleId, difficulty, oculomotorMode, oculomotorPattern, t]);

  if (phase === 'running') {
    return (
      <div key="running" className="experiment-container">
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
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
      onDownloadCsv={downloadCSV}
      onRestart={() => {
        setResults([]);
        setPhase('running');
      }}
      onBackHome={() => navigate('/')}
    />
  );
}

function IsOculomotorTargetShape(value: string): value is OculomotorTargetShape {
  return ['circle', 'star', 'square', 'cross', 'triangle', 'custom'].includes(value);
}
