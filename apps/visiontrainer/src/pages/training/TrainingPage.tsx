import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { initJsPsych } from 'jspsych';
import type { JsPsych } from 'jspsych';
import WebGazerExtension from '@jspsych/extension-webgazer';
import { useT } from '../../i18n';
import { buildTimeline } from '../../experiment/timeline';
import {
  DRIVING_DURATION_MIN_SEC,
  getActiveUser,
  getSetting,
  isDrivingControlMode,
} from '../../utils/settings';
import { SoundManager } from '../../utils/soundManager';
import { saveTrainingRecord } from '../../utils/trainingRecords';
import { downloadTrainingCsv } from './exportCsv';
import {
  isOculomotorMode,
  isOculomotorPattern,
} from './oculomotor/presets';
import type { OculomotorTargetShape } from './oculomotor/types';
import { getRandomStory } from './reading/stories';
import { TrainingResults } from './results/TrainingResults';
import type { TrialData } from './types';

type Phase = 'running' | 'results';

const TRAINING_LAYOUT_WAIT_TIMEOUT_MS = 800;

function hasUsableLayout(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return element.isConnected && rect.width > 0 && rect.height > 0;
}

function waitForUsableLayout(element: HTMLElement): Promise<void> {
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
      if (!hasUsableLayout(element)) {
        frameId = window.requestAnimationFrame(check);
        return;
      }
      frameId = window.requestAnimationFrame(finish);
    };

    frameId = window.requestAnimationFrame(check);
    timeoutId = window.setTimeout(finish, TRAINING_LAYOUT_WAIT_TIMEOUT_MS);

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
  const difficulty = searchParams.get('difficulty') || getSetting('difficulty');
  const totalRounds = parseInt(searchParams.get('rounds') || '', 10) || getSetting('totalRounds');
  const requestedMode = searchParams.get('mode') || getSetting('oculomotorMode');
  const requestedPattern = searchParams.get('pattern') || getSetting('oculomotorPattern');
  const oculomotorMode = isOculomotorMode(requestedMode) ? requestedMode : getSetting('oculomotorMode');
  const oculomotorPattern = isOculomotorPattern(requestedPattern)
    ? requestedPattern
    : getSetting('oculomotorPattern');
  const oculomotorDurationSec = parseInt(searchParams.get('duration') || '', 10)
    || getSetting('oculomotorDurationSec');
  const oculomotorSpeedDegPerSec = parseFloat(searchParams.get('speed') || '')
    || getSetting('oculomotorSpeedDegPerSec');
  const oculomotorTargetSizeMm = parseFloat(searchParams.get('size') || '')
    || getSetting('oculomotorTargetSizeMm');
  const oculomotorDistractorCount = parseInt(searchParams.get('distractors') || '', 10);
  const requestedTargetShape = searchParams.get('shape') || getSetting('oculomotorTargetShape');
  const oculomotorTargetShape = isOculomotorTargetShape(requestedTargetShape)
    ? requestedTargetShape
    : getSetting('oculomotorTargetShape');
  const oculomotorTargetColor = searchParams.get('targetColor') || getSetting('oculomotorTargetColor');
  const oculomotorBackgroundColor = searchParams.get('backgroundColor') || getSetting('oculomotorBackgroundColor');
  const oculomotorCustomTargetImage = getSetting('oculomotorCustomTargetImage');
  const enableWebGazer = getSetting('oculomotorEnableWebgazer');
  const requestedDrivingDurationSec = parseInt(searchParams.get('duration') || '', 10);
  const drivingDurationSec = Math.max(
    DRIVING_DURATION_MIN_SEC,
    Number.isFinite(requestedDrivingDurationSec)
      ? requestedDrivingDurationSec
      : getSetting('drivingDurationSec'),
  );
  const requestedDrivingFlash = searchParams.get('redFlash');
  const drivingRedFlashEnabled = requestedDrivingFlash === null
    ? getSetting('drivingRedFlashEnabled')
    : requestedDrivingFlash === 'true';
  const drivingDifficulty = (searchParams.get('drivingDifficulty') as any) || getSetting('drivingDifficulty');
  const requestedDrivingControlMode = searchParams.get('controlMode');
  const drivingControlMode = isDrivingControlMode(requestedDrivingControlMode)
    ? requestedDrivingControlMode
    : getSetting('drivingControlMode');
  const gaborDurationSec = parseInt(searchParams.get('duration') || '', 10) || 60;
  const gaborMaxSpots = parseInt(searchParams.get('maxSpots') || '', 10) || 10;

  const [phase, setPhase] = useState<Phase>('running');
  const [results, setResults] = useState<TrialData[]>([]);
  const jsPsychRef = useRef<JsPsych | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userName = getActiveUser() || t('exp.unknownUser');

  useEffect(() => {
    if (phase !== 'running') return;
    if (!containerRef.current) return;
    if (jsPsychRef.current) return;

    const container = containerRef.current;

    let cancelled = false;

    const setupExperiment = async () => {
      await waitForUsableLayout(container);
      if (cancelled) return;

      const storyData = moduleId === 'reading-training'
        ? getRandomStory(lang) || undefined
        : undefined;

      const jsPsych = initJsPsych({
        display_element: container,
        extensions: enableWebGazer ? [{ type: WebGazerExtension }] : [],
        on_finish: async () => {
          const data = jsPsych.data.get().values() as TrialData[];
          await saveTrainingRecord({
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
                : getSetting('oculomotorDistractorCount'),
              gaborDurationSec,
              gaborMaxSpots,
              readingWPS: getSetting('readingWPS'),
              readingCrowding: getSetting('readingCrowding'),
              readingContrast: getSetting('readingContrast'),
              drivingDurationSec,
              drivingRedFlashEnabled,
              drivingDifficulty,
              drivingControlMode,
            },
          });
          SoundManager.destroy();
          setResults(data);
          jsPsychRef.current = null;
          setPhase('results');
        },
      });

      const timeline = await buildTimeline(moduleId, {
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
            : getSetting('oculomotorDistractorCount'),
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
          wps: getSetting('readingWPS'),
          crowding: getSetting('readingCrowding'),
          contrast: getSetting('readingContrast'),
        },
        driving: {
          durationSec: drivingDurationSec,
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
      SoundManager.destroy();
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
    drivingDurationSec,
    drivingRedFlashEnabled,
    drivingDifficulty,
    drivingControlMode,
    userName,
    lang,
  ]);

  const downloadCSV = useCallback(() => {
    downloadTrainingCsv({
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
      onBackHome={() => navigate('/')}
    />
  );
}

function isOculomotorTargetShape(value: string): value is OculomotorTargetShape {
  return ['circle', 'star', 'square', 'cross', 'triangle', 'custom'].includes(value);
}
