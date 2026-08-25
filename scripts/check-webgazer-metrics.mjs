#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const sourceUrl = new URL(
  '../apps/rehabtrainerhub/training-runtimes/vision/src/utils/webgazerMetrics.ts',
  import.meta.url,
);
const source = await readFile(sourceUrl, 'utf8');
const { diagnostics = [], outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
  reportDiagnostics: true,
});

assert.deepEqual(
  diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error),
  [],
  'Unable to transpile webgazerMetrics.ts',
);

const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
const metrics = await import(moduleUrl);

function AssertNearlyEqual(actual, expected, message, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function CreateLandmarks() {
  return Array.from({ length: 468 }, () => undefined);
}

function SetEyeLandmarks(landmarks, offsetX, indexes) {
  landmarks[indexes.corners[0]] = [offsetX, 0, 0];
  landmarks[indexes.corners[1]] = [offsetX + 10, 0, 0];
  landmarks[indexes.vertical[0][0]] = [offsetX + 3, -1.5, 0];
  landmarks[indexes.vertical[0][1]] = [offsetX + 3, 1.5, 0];
  landmarks[indexes.vertical[1][0]] = [offsetX + 7, -1.5, 0];
  landmarks[indexes.vertical[1][1]] = [offsetX + 7, 1.5, 0];
}

function CreateEyePatch(width, height, darkPixels) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const value = darkPixels.has(index) ? 0 : 255;
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = 255;
  }
  return { data, width, height };
}

test('classifies head distance from MediaPipe cheek landmarks', () => {
  const landmarks = CreateLandmarks();
  const options = { tooFarBelowRatio: 0.25, tooCloseAboveRatio: 0.45 };
  landmarks[234] = [400, 200, 0];
  landmarks[454] = [600, 200, 0];
  assert.equal(metrics.CalculateFaceWidthRatio(landmarks, 1000), 0.2);
  assert.equal(metrics.ClassifyHeadDistance(landmarks, 1000, options), 'too-far');

  landmarks[454] = [750, 200, 0];
  assert.equal(metrics.ClassifyHeadDistance(landmarks, 1000, options), 'ready');

  landmarks[454] = [900, 200, 0];
  assert.equal(metrics.ClassifyHeadDistance(landmarks, 1000, options), 'too-close');

  const normalizedLandmarks = CreateLandmarks();
  normalizedLandmarks[234] = [0.2, 0.5, 0];
  normalizedLandmarks[454] = [0.4, 0.5, 0];
  AssertNearlyEqual(
    metrics.CalculateFaceWidthRatio(normalizedLandmarks, 1000),
    0.2,
    'normalized face width ratio',
  );
  assert.equal(metrics.ClassifyHeadDistance(normalizedLandmarks, 1000, options), 'too-far');
  normalizedLandmarks[454] = [0.55, 0.5, 0];
  assert.equal(metrics.ClassifyHeadDistance(normalizedLandmarks, 1000, options), 'ready');
  normalizedLandmarks[454] = [0.7, 0.5, 0];
  assert.equal(metrics.ClassifyHeadDistance(normalizedLandmarks, 1000, options), 'too-close');

  assert.equal(metrics.ClassifyHeadDistance(null, 1000, options), 'unavailable');
  assert.equal(metrics.ClassifyHeadDistance(landmarks, 0, options), 'unavailable');
});

test('calculates eye aspect ratio and counts only completed blink transitions', () => {
  const landmarks = CreateLandmarks();
  SetEyeLandmarks(landmarks, 0, {
    corners: [33, 133],
    vertical: [[159, 145], [158, 153]],
  });
  SetEyeLandmarks(landmarks, 20, {
    corners: [362, 263],
    vertical: [[386, 374], [385, 380]],
  });
  AssertNearlyEqual(metrics.CalculateEyeAspectRatio(landmarks), 0.3, 'eye aspect ratio');
  assert.equal(metrics.CalculateEyeAspectRatio(null), null);

  let state = metrics.CreateBlinkDetectorState();
  let update = metrics.UpdateBlinkDetector(state, 0.3, 0);
  state = update.state;
  assert.equal(update.blinkEvent, 0);
  update = metrics.UpdateBlinkDetector(state, null, 50);
  state = update.state;
  assert.equal(update.blinkEvent, 0);
  update = metrics.UpdateBlinkDetector(state, 0.1, 100);
  state = update.state;
  assert.equal(state.isClosed, true);
  update = metrics.UpdateBlinkDetector(state, 0.1, 140);
  state = update.state;
  update = metrics.UpdateBlinkDetector(state, 0.27, 180);
  state = update.state;
  assert.equal(update.blinkEvent, 1);
  assert.equal(state.blinkCount, 1);
  assert.equal(state.isClosed, false);

  update = metrics.UpdateBlinkDetector(state, 0.1, 200);
  state = update.state;
  update = metrics.UpdateBlinkDetector(state, 0.27, 230);
  assert.equal(update.blinkEvent, 0, 'a closure shorter than 60 ms is not a blink');
  assert.equal(update.state.blinkCount, 1);
});

test('estimates pupil size from camera-pixel eye patches and preserves nulls', () => {
  const darkPixels = new Set();
  for (let y = 3; y <= 5; y += 1) {
    for (let x = 3; x <= 5; x += 1) darkPixels.add(y * 9 + x);
  }
  const pupilPatch = CreateEyePatch(9, 9, darkPixels);
  const uniformPatch = CreateEyePatch(9, 9, new Set());
  const estimate = metrics.EstimatePupilSizePx({
    left: { patch: pupilPatch },
    right: { patch: pupilPatch },
  });
  AssertNearlyEqual(estimate, 2 * Math.sqrt(9 / Math.PI), 'camera-pixel pupil estimate');
  assert.equal(metrics.EstimatePupilSizePx({ left: { patch: uniformPatch } }), null);
  assert.equal(metrics.EstimatePupilSizePx(null), null);
});

test('creates compact samples and summarizes distance, TTFF, pupil, blink, and AOI', () => {
  const first = metrics.CreateOculomotorGazeSample(
    100,
    { x: 3, y: 4 },
    { x: 0, y: 0 },
    2,
    0,
  );
  assert.deepEqual(first, [100, 3, 4, 0, 0, 5, 2, 0, 0]);
  assert.deepEqual(metrics.oculomotorGazeSampleColumns, [
    't_ms',
    'gaze_x',
    'gaze_y',
    'target_x',
    'target_y',
    'distance_px',
    'pupil_size_px_estimate',
    'blink_event',
    'fixation_segment',
  ]);

  const samples = [
    first,
    metrics.CreateOculomotorGazeSample(200, { x: 0, y: 4 }, { x: 0, y: 0 }, null, 1),
    metrics.CreateOculomotorGazeSample(300, { x: 0, y: 15 }, { x: 0, y: 0 }, 4, 0),
  ];
  const summary = metrics.SummarizeOculomotorGazeSamples(samples, {
    fixationRadiusPx: 6,
    minimumFixationDurationMs: 100,
  });
  assert.equal(summary.gazeSampleCount, 3);
  assert.equal(summary.meanDistancePx, 8);
  AssertNearlyEqual(
    summary.distanceStandardDeviationPx,
    Math.sqrt(74 / 3),
    'population distance standard deviation',
  );
  assert.equal(summary.timeToFirstFixationMs, 100);
  assert.equal(summary.averagePupilSizePx, 3);
  assert.equal(summary.blinkCount, 1);
  assert.equal(summary.aoiSampleCount, 2);
  assert.equal(summary.aoiScore, 67);

  const pauseSegmentSummary = metrics.SummarizeOculomotorGazeSamples([
    metrics.CreateOculomotorGazeSample(100, { x: 0, y: 4 }, { x: 0, y: 0 }, null, 0, 0),
    metrics.CreateOculomotorGazeSample(150, { x: 0, y: 4 }, { x: 0, y: 0 }, null, 0, 1),
    metrics.CreateOculomotorGazeSample(250, { x: 0, y: 4 }, { x: 0, y: 0 }, null, 0, 1),
  ], {
    fixationRadiusPx: 6,
    minimumFixationDurationMs: 100,
  });
  assert.equal(
    pauseSegmentSummary.timeToFirstFixationMs,
    150,
    'a pause segment must break fixation continuity',
  );

  assert.deepEqual(
    metrics.SummarizeOculomotorGazeSamples([], { fixationRadiusPx: 6 }),
    {
      aoiSampleCount: 0,
      aoiScore: null,
      averagePupilSizePx: null,
      blinkCount: 0,
      distanceStandardDeviationPx: null,
      gazeSampleCount: 0,
      meanDistancePx: null,
      timeToFirstFixationMs: null,
    },
  );
});
