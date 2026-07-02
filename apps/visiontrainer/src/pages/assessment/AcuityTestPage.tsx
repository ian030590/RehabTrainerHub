import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useT } from '../../i18n';
import WebGazerExtension from '@jspsych/extension-webgazer';
import { BestPEST } from './logic/bestPest';
import {
  getStrokeBounds,
  stimDeviceFromThresholder,
  stimThresholderFromDevice,
  logMARFromStrokePixels,
  decVAFromStrokePixels,
  formatSnellenFraction,
  lettersFromLogMAR,
} from './logic/acuityLogic';
import {
  clearCanvas,
  drawLandoltC,
  drawTumblingE,
  drawSloanLetter,
  drawPictureOptotype,
  drawGrating,
  getAlternativeCount,
  randomAlternative,
  LANDOLT_DIRECTION_LABELS,
  E_DIRECTION_LABELS,
  SLOAN_LETTERS,
  PICTURE_NAMES,
} from './logic/optotypeRenderer';
import type {
  TestType,
  LandoltDirection,
  EDirection,
  SloanLetterIndex,
  PictureIndex,
  GratingOrientation,
} from './logic/optotypeRenderer';
import { getActiveUser, getSetting } from '../../utils/settings';
import { pixelFromDegree } from '../../utils/spatialUtils';
import { SoundManager } from '../../utils/soundManager';
import { downloadCsvFile } from '../../utils/downloadFile';

type Phase = 'intro' | 'isi' | 'stimulus' | 'results';

const ACUITY_OVERLAY_FONT_SIZE = 12;
const MID_LUMINANCE = 0.5;
const DEFAULT_ACUITY_BACKGROUND = '#FFFFFF';
const VALID_TEST_TYPES: TestType[] = ['landolt', 'tumblingE', 'letters', 'pictures', 'gratings', 'contrast'];
const PICTURE_KEY_LABELS = ['1', '2', '3', '4'] as const;

interface TrialRecord {
  trial: number;
  presented: number;
  responded: number;
  correct: boolean;
  strokePx: number;
  logMAR: number;
  responseMode?: 'keyboard' | 'webgazer';
  gazeLeftSamples?: number;
  gazeRightSamples?: number;
  gazeTotalSamples?: number;
}

interface GazeRegion {
  x: number;
  y: number;
  radius: number;
}

interface GazeDecisionMeta {
  mode: 'keyboard' | 'webgazer';
  leftSamples?: number;
  rightSamples?: number;
  totalSamples?: number;
}

function isTestType(value: string | null): value is TestType {
  return value !== null && VALID_TEST_TYPES.includes(value as TestType);
}

function prepareAcuityCanvas(canvas: HTMLCanvasElement) {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const backingWidth = Math.round(width * dpr);
  const backingHeight = Math.round(height * dpr);

  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  return { ctx, width, height };
}

function getGammaCorrectedMidGrayChannel(): number {
  const gamma = getSetting('gammaValue');
  const corrected = Math.pow(MID_LUMINANCE, 1 / gamma);
  return Math.round(Math.min(1, Math.max(0, corrected)) * 255);
}

function getGammaCorrectedMidGray(): string {
  const channel = getGammaCorrectedMidGrayChannel();
  return `rgb(${channel}, ${channel}, ${channel})`;
}

function getAcuityBackground(testType: TestType): string {
  return testType === 'gratings' ? getGammaCorrectedMidGray() : DEFAULT_ACUITY_BACKGROUND;
}

function getBalancedGratingColors() {
  const gray = getGammaCorrectedMidGrayChannel();
  const amplitude = Math.min(gray, 255 - gray);
  const light = gray + amplitude;
  const dark = gray - amplitude;

  return {
    lightColor: `rgb(${light}, ${light}, ${light})`,
    darkColor: `rgb(${dark}, ${dark}, ${dark})`,
  };
}

function drawGratingApertureRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  diameter: number,
) {
  ctx.save();
  ctx.strokeStyle = DEFAULT_ACUITY_BACKGROUND;
  ctx.lineWidth = Math.max(1.5, diameter * 0.012);
  ctx.beginPath();
  ctx.arc(cx, cy, diameter / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function AcuityTestPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTestType = searchParams.get('type') || searchParams.get('test');
  const testType = isTestType(requestedTestType) ? requestedTestType : 'landolt';
  const totalTrials = parseInt(searchParams.get('trials') || '18', 10);
  const isTrialMode = searchParams.get('trialMode') === 'true';
  const requestedResponseMode =
    searchParams.get('responseMode') || searchParams.get('mode') || getSetting('preferentialLookingInputMode');
  const responseMode: 'keyboard' | 'webgazer' =
    requestedResponseMode === 'webgazer' ? 'webgazer' : 'keyboard';
  const isWebGazerPL = testType === 'gratings' && responseMode === 'webgazer';

  const [phase, setPhase] = useState<Phase>('intro');
  const [trialRecords, setTrialRecords] = useState<TrialRecord[]>([]);
  const [webGazerStatus, setWebGazerStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [webGazerMessage, setWebGazerMessage] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pestRef = useRef<BestPEST | null>(null);
  const trialRef = useRef(0);
  const currentAlternativeRef = useRef(0);
  const strokeBoundsRef = useRef({ strokeMin: 0.5, strokeMax: 100 });
  const currentStrokePxRef = useRef(10);
  const recordsRef = useRef<TrialRecord[]>([]);
  const phaseRef = useRef<Phase>('intro');
  const gratingRegionsRef = useRef<{ left: GazeRegion; right: GazeRegion } | null>(null);
  const gazeExtensionRef = useRef<any>(null);

  const userName = getActiveUser() || t('exp.unknownUser');

  // Keep phaseRef in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const ensureWebGazerReady = useCallback(async () => {
    if (!isWebGazerPL) return;

    if (!(window as any).webgazer) {
      throw alert(t('acuity.wgNotLoaded'));
    }

    if (!gazeExtensionRef.current) {
      const extension = new (WebGazerExtension as any)({});
      await extension.initialize({});
      gazeExtensionRef.current = extension;
    }

    const extension = gazeExtensionRef.current;
    if (!extension) {
      throw alert(t('acuity.wgFailed'));
    }

    if (!extension.isInitialized()) {
      await extension.start();
    }

    extension.hideVideo();
    extension.hidePredictions();
    extension.resume();
  }, [isWebGazerPL, t]);

  // ── Initialize and manage the test ──
  const startTest = useCallback(() => {
    const begin = () => {
      SoundManager.init();
      const nAlt = getAlternativeCount(testType);
      pestRef.current = new BestPEST(nAlt);
      trialRef.current = 0;
      recordsRef.current = [];
      setTrialRecords([]);
      setWebGazerMessage('');

      // Get canvas dimensions for stroke bounds
      strokeBoundsRef.current = getStrokeBounds(window.innerWidth, window.innerHeight);

      setPhase('isi');
      runNextTrial();
    };

    if (!isWebGazerPL) {
      begin();
      return;
    }

    setWebGazerStatus('starting');
    setWebGazerMessage(t('acuity.wgStarting'));
    ensureWebGazerReady()
      .then(() => {
        setWebGazerStatus('ready');
        begin();
      })
      .catch((err) => {
        setWebGazerStatus('error');
        console.error(err);
        alert(t('acuity.wgFailed'));
      });
  }, [ensureWebGazerReady, isWebGazerPL, testType, t]);

  const drawStimulus = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prepared = prepareAcuityCanvas(canvas);
    if (!prepared) return;

    const { ctx, width, height } = prepared;
    clearCanvas(ctx, width, height, getAcuityBackground(testType));

    const cx = width / 2;
    const cy = height / 2;
    const strokePx = currentStrokePxRef.current;
    const alt = currentAlternativeRef.current;
    gratingRegionsRef.current = null;

    switch (testType) {
      case 'landolt':
        drawLandoltC(ctx, cx, cy, strokePx, alt as LandoltDirection);
        break;
      case 'tumblingE':
        drawTumblingE(ctx, cx, cy, strokePx, (alt * 2) as EDirection);
        break;
      case 'letters':
        drawSloanLetter(ctx, cx, cy, strokePx, alt as SloanLetterIndex);
        break;
      case 'pictures':
        drawPictureOptotype(ctx, cx, cy, strokePx, alt as PictureIndex);
        break;
      case 'gratings': {
        const pixPerDeg = pixelFromDegree(1);
        // spatial frequency based on stroke size
        const cpd = 30 / Math.pow(10, logMARFromStrokePixels(strokePx));
        const diameter = Math.min(height * 0.58, width * 0.34);
        const orient: GratingOrientation = alt === 0 ? 'left' : 'right';
        const margin = 24;
        const maxOffset = Math.max(0, width / 2 - diameter / 2 - margin);
        const baseOffset = Math.min(width * 0.24, maxOffset);
        const leftX = cx - baseOffset;
        const rightX = cx + baseOffset;
        const gratingX = orient === 'left' ? leftX : rightX;
        const gratingColors = getBalancedGratingColors();

        drawGrating(ctx, gratingX, cy, diameter, cpd, orient, pixPerDeg, gratingColors);
        drawGratingApertureRing(ctx, leftX, cy, diameter);
        drawGratingApertureRing(ctx, rightX, cy, diameter);
        gratingRegionsRef.current = {
          left: { x: leftX, y: cy, radius: diameter / 2 },
          right: { x: rightX, y: cy, radius: diameter / 2 },
        };
        break;
      }
    }

    const snellen = formatSnellenFraction(decVAFromStrokePixels(strokePx));

    ctx.fillStyle = '#9CA3AF';
    ctx.font = `${ACUITY_OVERLAY_FONT_SIZE}px Inter, sans-serif`;
    ctx.fillText(snellen, 12, 20);
  }, [testType]);

  const runNextTrial = useCallback(() => {
    const pest = pestRef.current;
    if (!pest) return;

    trialRef.current += 1;
    if (trialRef.current > totalTrials) {
      setTrialRecords([...recordsRef.current]);
      SoundManager.destroy();
      setPhase('results');
      return;
    }

    // Get next stimulus from BestPEST
    const tPest = pest.nextStim2apply();
    const { strokeMin, strokeMax } = strokeBoundsRef.current;
    const strokePx = stimDeviceFromThresholder(tPest, strokeMin, strokeMax);
    currentStrokePxRef.current = strokePx;

    // Generate random alternative
    currentAlternativeRef.current = randomAlternative(testType);

    // ISI phase (blank screen)
    setPhase('isi');
    const canvas = canvasRef.current;
    if (canvas) {
      const prepared = prepareAcuityCanvas(canvas);
      if (prepared) clearCanvas(
        prepared.ctx,
        prepared.width,
        prepared.height,
        getAcuityBackground(testType),
      );
    }

    // Show stimulus after ISI delay
    setTimeout(() => {
      drawStimulus();
      setPhase('stimulus');
    }, 300);
  }, [testType, totalTrials, drawStimulus]);

  // ── Handle response ──
  const handleResponse = useCallback((responseIdx: number, meta: GazeDecisionMeta = { mode: 'keyboard' }) => {
    if (phaseRef.current !== 'stimulus') return;

    const pest = pestRef.current;
    if (!pest) return;

    const presented = currentAlternativeRef.current;
    const correct = responseIdx === presented;
    const strokePx = currentStrokePxRef.current;
    const { strokeMin, strokeMax } = strokeBoundsRef.current;

    // Record
    const logMAR = logMARFromStrokePixels(strokePx);
    const record: TrialRecord = {
      trial: trialRef.current,
      presented,
      responded: responseIdx,
      correct,
      strokePx,
      logMAR,
      responseMode: meta.mode,
      gazeLeftSamples: meta.leftSamples,
      gazeRightSamples: meta.rightSamples,
      gazeTotalSamples: meta.totalSamples,
    };
    recordsRef.current.push(record);

    // Feed back to BestPEST
    const tPest = stimThresholderFromDevice(strokePx, strokeMin, strokeMax);
    pest.enterTrialOutcome(tPest, correct);

    // Audio feedback
    if (getSetting('auditoryFeedbackEnabled')) {
      if (correct) {
        SoundManager.playCorrect();
      } else {
        SoundManager.playIncorrect();
      }
    }

    // Next trial
    runNextTrial();
  }, [runNextTrial]);

  useEffect(() => {
    if (!isWebGazerPL || phase !== 'stimulus') return;

    const extension = gazeExtensionRef.current;
    const regions = gratingRegionsRef.current;
    if (!extension || !regions) return;

    let cancelled = false;
    let timerId: number | undefined;
    const startedAt = performance.now();
    const samples = { left: 0, right: 0, total: 0 };

    const classifyPrediction = (prediction: { x?: number; y?: number } | null | undefined) => {
      if (
        !prediction ||
        !Number.isFinite(prediction.x) ||
        !Number.isFinite(prediction.y)
      ) {
        return null;
      }

      const { x, y } = prediction as { x: number; y: number };
      const leftDistance = Math.hypot(x - regions.left.x, y - regions.left.y);
      const rightDistance = Math.hypot(x - regions.right.x, y - regions.right.y);
      const radius = Math.max(regions.left.radius, regions.right.radius) * 1.25;

      if (leftDistance <= radius || rightDistance <= radius) {
        return leftDistance <= rightDistance ? 0 : 1;
      }

      return x < window.innerWidth / 2 ? 0 : 1;
    };

    const finishFromSamples = () => {
      const responseIdx = samples.right > samples.left ? 1 : 0;
      handleResponse(responseIdx, {
        mode: 'webgazer',
        leftSamples: samples.left,
        rightSamples: samples.right,
        totalSamples: samples.total,
      });
    };

    const tick = () => {
      if (cancelled || phaseRef.current !== 'stimulus') return;

      extension.getCurrentPrediction()
        .then((prediction: { x?: number; y?: number } | null) => {
          if (cancelled || phaseRef.current !== 'stimulus') return;

          const side = classifyPrediction(prediction);
          if (side === 0) {
            samples.left += 1;
            samples.total += 1;
          } else if (side === 1) {
            samples.right += 1;
            samples.total += 1;
          }

          const elapsed = performance.now() - startedAt;
          const margin = Math.abs(samples.left - samples.right);
          if ((elapsed >= 700 && samples.total >= 8 && margin >= 3) || elapsed >= 1600) {
            finishFromSamples();
            return;
          }

          timerId = window.setTimeout(tick, 90);
        })
        .catch(() => {
          if (cancelled || phaseRef.current !== 'stimulus') return;
          timerId = window.setTimeout(tick, 120);
        });
    };

    timerId = window.setTimeout(tick, 350);

    return () => {
      cancelled = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [phase, isWebGazerPL, handleResponse]);

  // ── Keyboard handler ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (phaseRef.current === 'intro') {
        if (e.key === ' ' || e.key === 'Enter') {
          startTest();
        }
        return;
      }
      if (phaseRef.current !== 'stimulus') return;

      if (e.key === 'Escape') {
        navigate('/assessment');
        return;
      }

      if (isWebGazerPL) return;

      let responseIdx = -1;

      switch (testType) {
        case 'landolt':
          // Numpad ONLY for Landolt C
          const landoltKeyMap: Record<string, number> = {
            '6': 0, '9': 1, '8': 2, '7': 3, '4': 4, '1': 5, '2': 6, '3': 7,
          };
          responseIdx = landoltKeyMap[e.key] ?? -1;
          break;

        case 'tumblingE':
          // Arrow keys ONLY for Tumbling E
          const tumblingEKeyMap: Record<string, number> = {
            ArrowRight: 0, ArrowUp: 1, ArrowLeft: 2, ArrowDown: 3,
          };
          responseIdx = tumblingEKeyMap[e.key] ?? -1;
          break;

        case 'pictures':
          const picturesKeyMap: Record<string, number> = {
            '1': 0, '2': 1, '3': 2, '4': 3,
          };
          responseIdx = picturesKeyMap[e.key] ?? -1;
          break;

        case 'letters':
          const letterMap: Record<string, number> = {
            c: 0, C: 0, d: 1, D: 1, h: 2, H: 2, k: 3, K: 3, n: 4, N: 4,
            o: 5, O: 5, r: 6, R: 6, s: 7, S: 7, v: 8, V: 8, z: 9, Z: 9,
          };
          responseIdx = letterMap[e.key] ?? -1;
          break;

        case 'gratings':
          const gratingMap: Record<string, number> = {
            ArrowLeft: 0, '4': 0,
            ArrowRight: 1, '6': 1,
          };
          responseIdx = gratingMap[e.key] ?? -1;
          break;
      }

      if (responseIdx >= 0) {
        handleResponse(responseIdx);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [testType, startTest, handleResponse, navigate, isWebGazerPL]);

  // ── Resize handler ──
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const prepared = prepareAcuityCanvas(canvas);
      if (!prepared) return;
      strokeBoundsRef.current = getStrokeBounds(prepared.width, prepared.height);
      if (phaseRef.current === 'stimulus') {
        drawStimulus();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawStimulus]);

  useEffect(() => () => {
    SoundManager.destroy();
    try {
      gazeExtensionRef.current?.pause?.();
      gazeExtensionRef.current?.hidePredictions?.();
    } catch {
      // WebGazer cleanup should not block navigation.
    }
  }, []);

  // ── Intro Phase ──
  if (phase === 'intro') {
    return (
      <div className="experiment-container">
        <div className="acuity-intro">
          <h1>{getTestTitle(testType, t)}</h1>
          <p>{getTestInstruction(testType, t)}</p>
          {isWebGazerPL ? (
            <div className="webgazer-pl-intro">
              <h3>{t('acuity.plWgMethod')}</h3>
              <p>{t('acuity.plWgInst')}</p>
            </div>
          ) : (
            <div className="acuity-intro-keys">
              {getKeyHints(testType, t)}
            </div>
          )}
          <button
            className="btn btn-primary btn-lg"
            onClick={startTest}
            disabled={webGazerStatus === 'starting'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            {webGazerStatus === 'starting' ? t('acuity.startingWg') : t('btn.startTest')}
          </button>
          {webGazerMessage && (
            <p className={`webgazer-pl-message ${webGazerStatus === 'error' ? 'error' : ''}`}>
              {webGazerMessage}
            </p>
          )}
          <p className="acuity-intro-hint">
            {t('acuity.kbInst')}
          </p>
        </div>
      </div>
    );
  }

  // ── Running Phase (ISI + Stimulus) ──
  if (phase === 'isi' || phase === 'stimulus') {
    return (
      <div className="experiment-container acuity-test-container">
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            background: getAcuityBackground(testType),
          }}
        />
        {isWebGazerPL && phase === 'stimulus' && (
          <div className="webgazer-pl-badge">{t('acuity.wgSampling')}</div>
        )}
        {!isWebGazerPL && (
          <div className="acuity-touch-controls">
            {renderTouchButtons(testType, handleResponse, t)}
          </div>
        )}
        {/* Abort button */}
        <button
          className="acuity-abort-btn"
          onClick={() => navigate('/assessment')}
          title={t('btn.cancel')}
        >
          ✕
        </button>
      </div>
    );
  }

  // ── Results Phase ──
  const records = trialRecords;
  const finalStrokePx = records.length > 0 ? records[records.length - 1].strokePx : 10;
  const finalLogMAR = logMARFromStrokePixels(finalStrokePx);
  const finalDecVA = decVAFromStrokePixels(finalStrokePx);
  const finalSnellen = formatSnellenFraction(finalDecVA);
  const finalLetterScore = Math.round(lettersFromLogMAR(finalLogMAR));
  const correctCount = records.filter((r) => r.correct).length;
  const correctRate = records.length > 0 ? correctCount / records.length : 0;
  const decimalAcuity = finalDecVA.toFixed(2);

  const downloadCSV = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false }).replace(/:/g, '');
    const prefix = getSetting('downloadDirectory');

    const headers = [
      t('exp.csv.user'),
      t('exp.csv.date'),
      t('exp.csv.time'),
      t('acuity.csv.test'),
      t('acuity.csv.trial'),
      t('acuity.csv.presented'),
      t('acuity.csv.response'),
      t('acuity.csv.correct'),
      t('acuity.csv.logmar'),
      t('acuity.csv.strokePx'),
      t('acuity.csv.responseMode'),
      t('acuity.csv.gazeLeft'),
      t('acuity.csv.gazeRight'),
      t('acuity.csv.gazeTotal'),
    ];
    const rows = records.map((r) => [
      userName, dateStr, timeStr, testType, r.trial,
      r.presented, r.responded, r.correct ? '✓' : '✗',
      r.logMAR.toFixed(3), r.strokePx.toFixed(2),
      r.responseMode ?? 'keyboard',
      r.gazeLeftSamples ?? '',
      r.gazeRightSamples ?? '',
      r.gazeTotalSamples ?? '',
    ]);
    rows.push([]);
    rows.push([t('acuity.csv.finalResult')]);
    rows.push([t('acuity.csv.decimalAcuity'), finalLogMAR.toFixed(2)]);
    rows.push([t('acuity.decimalAcuity'), finalDecVA.toFixed(2)]);
    rows.push([t('acuity.csv.snellen'), finalSnellen]);
    rows.push([t('acuity.csv.letterScore'), String(finalLetterScore)]);
    rows.push([t('acuity.csv.accuracy'), `${(correctRate * 100).toFixed(1)}%`]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCsvFile(
      csv,
      `${prefix ? prefix + '_' : ''}${userName}_acuity_${testType}_${dateStr}.csv`,
    );
  };

  return (
    <div className="experiment-container" style={{ overflowY: 'auto' }}>
      <div className="acuity-results">
        <h1 style={{ fontSize: 32 }}>{t('acuity.done')}</h1>

        <div className="acuity-result-cards">
          <div className="acuity-result-card">
            <div className="acuity-result-label">{t('acuity.logmar')}</div>
            <div className="acuity-result-value">{finalLogMAR.toFixed(2)}</div>
          </div>
          <div className="acuity-result-card">
            <div className="test-hint fade-in">{t('acuity.kbInst')}</div>
            <div className="acuity-result-value">{finalDecVA.toFixed(2)}</div>
          </div>
          <div className="acuity-result-card">
            <div className="acuity-result-label">{t('acuity.snellen')}</div>
            <div className="acuity-result-value">{finalSnellen}</div>
          </div>
          <div className="acuity-result-card">
            <div className="acuity-result-label">{t('acuity.letterScore')}</div>
            <div className="acuity-result-value">{finalLetterScore}</div>
          </div>
        </div>

        <div className="acuity-result-meta">
          <span>{t('assess.config.test')} <b>{getTestTitle(testType, t)}</b></span>
          <span>{t('acuity.decimalAcuity')}: <b style={{ color: 'var(--accent)' }}>{decimalAcuity}</b></span>
          <span>{t('acuity.csv.accuracy')}: <b style={{ color: 'var(--accent)' }}>{correctCount}/{records.length}</b></span>
          <span>{t('assess.config.user')} <b>{userName}</b></span>
          {testType === 'gratings' && (
            <span>{t('assess.plMethodTitle')}: <b>{responseMode === 'webgazer' ? t('assess.wgMode') : t('assess.kbMode')}</b></span>
          )}
        </div>

        {/* Trial history */}
        <table className="results-table">
          <thead>
            <tr>
              <th>{t('acuity.csv.trial')}</th>
              <th>{t('acuity.csv.presented')}</th>
              <th>{t('acuity.csv.response')}</th>
              <th>{t('acuity.csv.correct')}</th>
              <th>{t('acuity.logmar')}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i}>
                <td>{r.trial}</td>
                <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                  {formatAlternative(testType, r.presented, t)}
                </td>
                <td>{formatAlternative(testType, r.responded, t)}</td>
                <td style={{ color: r.correct ? 'var(--success)' : 'var(--error)' }}>
                  {r.correct ? '✓' : '✗'}
                </td>
                <td>{r.logMAR.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="results-actions">
          {!isTrialMode && (
            <button className="btn btn-primary btn-lg" onClick={downloadCSV}>
              {t('acuity.downloadCsv')}
            </button>
          )}
          <button className="btn btn-secondary btn-lg" onClick={() => navigate('/assessment')}>
            {t('acuity.backAssess')}
          </button>
        </div>

        <p className="acuity-disclaimer-footer">
          {t('assess.disclaimer')}
        </p>
      </div>
    </div>
  );
}

// ── Helpers ──

function getTestTitle(t: TestType, tFunc: any): string {
  const map: Record<TestType, string> = {
    landolt: tFunc('assess.landolt.title'),
    tumblingE: tFunc('assess.tumblingE.title'),
    letters: tFunc('assess.sloan.title'),
    pictures: tFunc('assess.shapes.title'),
    gratings: tFunc('assess.pl.title'),
    contrast: tFunc('assess.contrast.title'),
  };
  return map[t];
}

function getTestInstruction(t: TestType, tFunc: any): string {
  switch (t) {
    case 'landolt':
      return tFunc('acuity.inst.landolt');
    case 'tumblingE':
      return tFunc('acuity.inst.tumbling');
    case 'letters':
      return tFunc('acuity.inst.sloan');
    case 'pictures':
      return tFunc('acuity.inst.shapes');
    case 'gratings':
      return tFunc('acuity.inst.pl');
    case 'contrast':
      return tFunc('acuity.inst.landolt');
    default:
      return '';
  }
}

function getKeyHints(t: TestType, tFunc: any): React.ReactNode {
  switch (t) {
    case 'landolt':
    case 'contrast':
      return (
        <div className="key-hints-grid-8">
          {([3, 2, 1, 4, -1, 0, 5, 6, 7] as number[]).map((dir, i) => (
            <div key={i} className={`key-hint ${dir === -1 ? 'key-hint-empty' : ''}`}>
              {dir >= 0 ? LANDOLT_DIRECTION_LABELS[dir as LandoltDirection] : ''}
            </div>
          ))}
        </div>
      );
    case 'tumblingE':
      return (
        <div className="key-hints-grid-4">
          <div className="key-hint" style={{ gridColumn: 2, gridRow: 1 }}>↑</div>
          <div className="key-hint" style={{ gridColumn: 1, gridRow: 2 }}>←</div>
          <div className="key-hint" style={{ gridColumn: 3, gridRow: 2 }}>→</div>
          <div className="key-hint" style={{ gridColumn: 2, gridRow: 3 }}>↓</div>
        </div>
      );
    case 'pictures':
      return (
        <div className="key-hints-pictures">
          {PICTURE_NAMES.map((name, idx) => (
            <div key={name} className="picture-key-hint">
              <span className="picture-key-number">{PICTURE_KEY_LABELS[idx]}</span>
              <span>{name}</span>
            </div>
          ))}
        </div>
      );
    case 'letters':
      return (
        <div className="key-hints-letters">
          {SLOAN_LETTERS.map((l) => (
            <div key={l} className="key-hint">{l}</div>
          ))}
        </div>
      );
    case 'gratings':
      return (
        <div className="key-hints-grid-4">
          <div className="key-hint" style={{ gridColumn: 1, gridRow: 2 }}>← {tFunc('acuity.lbl.left')}</div>
          <div className="key-hint" style={{ gridColumn: 3, gridRow: 2 }}>{tFunc('acuity.lbl.right')} →</div>
        </div>
      );
  }
}

function renderTouchButtons(testType: TestType, onResponse: (idx: number) => void, tFunc: any): React.ReactNode {
  switch (testType) {
    case 'landolt':
    case 'contrast':
      return (
        <div className="touch-btn-ring">
          {([0, 1, 2, 3, 4, 5, 6, 7] as LandoltDirection[]).map((dir) => {
            const angle = -(dir / 8) * 2 * Math.PI;
            const r = 38; // % from center
            const left = 50 + Math.cos(angle) * r;
            const top = 50 + Math.sin(angle) * r;
            return (
              <button
                key={dir}
                className="direction-btn"
                style={{ left: `${left}%`, top: `${top}%` }}
                onClick={() => onResponse(dir)}
              >
                {LANDOLT_DIRECTION_LABELS[dir]}
              </button>
            );
          })}
        </div>
      );
    case 'tumblingE':
      return (
        <div className="touch-btn-cross">
          <button className="direction-btn dir-up" onClick={() => onResponse(1)}>↑</button>
          <button className="direction-btn dir-left" onClick={() => onResponse(2)}>←</button>
          <button className="direction-btn dir-right" onClick={() => onResponse(0)}>→</button>
          <button className="direction-btn dir-down" onClick={() => onResponse(3)}>↓</button>
        </div>
      );
    case 'pictures':
      return (
        <div className="touch-btn-pictures">
          {PICTURE_NAMES.map((name, idx) => (
            <button
              key={name}
              className="picture-choice-btn"
              onClick={() => onResponse(idx)}
            >
              <span className="picture-choice-key">{PICTURE_KEY_LABELS[idx]}</span>
              <span className="picture-choice-name">{name}</span>
            </button>
          ))}
        </div>
      );
    case 'letters':
      return (
        <div className="touch-btn-letters">
          {SLOAN_LETTERS.map((l, i) => (
            <button key={l} className="direction-btn letter-btn" onClick={() => onResponse(i)}>
              {l}
            </button>
          ))}
        </div>
      );
    case 'gratings':
      return (
        <div className="touch-btn-cross">
          <button className="direction-btn dir-left" onClick={() => onResponse(0)}>← {tFunc('acuity.lbl.left')}</button>
          <button className="direction-btn dir-right" onClick={() => onResponse(1)}>{tFunc('acuity.lbl.right')} →</button>
        </div>
      );
  }
}

function formatAlternative(testType: TestType, idx: number, tFunc: any): string {
  switch (testType) {
    case 'landolt':
    case 'contrast':
      return LANDOLT_DIRECTION_LABELS[idx as LandoltDirection] || String(idx);
    case 'tumblingE':
      return E_DIRECTION_LABELS[(idx * 2) as EDirection] || String(idx);
    case 'letters':
      return SLOAN_LETTERS[idx] || String(idx);
    case 'pictures':
      return PICTURE_NAMES[idx] ? `${idx + 1} ${PICTURE_NAMES[idx]}` : String(idx);
    case 'gratings':
      return idx === 0 ? tFunc('acuity.lbl.left') : tFunc('acuity.lbl.right');
    default:
      return String(idx);
  }
}
