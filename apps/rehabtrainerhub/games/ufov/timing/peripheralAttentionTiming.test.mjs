import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function ImportTypeScriptModule(relativePath) {
  const sourceUrl = new URL(relativePath, import.meta.url);
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
    `Unable to transpile ${relativePath}`,
  );

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const timing = await ImportTypeScriptModule('./peripheralAttentionTiming.ts');
const pageSource = await readFile(new URL('../PeripheralAttentionPage.tsx', import.meta.url), 'utf8');
const {
  EvaluatePeripheralAttentionFrameSync,
  GetPeripheralAttentionSyncRecoveryAction,
  ShouldCountPeripheralAttentionTrial,
  peripheralAttentionSyncPolicy,
} = timing;

function CreateTimestamps(refreshHz, frameCount) {
  const refreshMs = 1000 / refreshHz;
  return Array.from({ length: frameCount + 1 }, (_, index) => index * refreshMs);
}

function EvaluateAtRefreshRate(refreshHz, frameCount = 12, overrides = {}) {
  const refreshMs = 1000 / refreshHz;
  return EvaluatePeripheralAttentionFrameSync({
    requestedFrameCount: frameCount,
    refreshMs,
    refreshMeasured: true,
    refreshStandardDeviationMs: 0.15,
    frameTimestamps: CreateTimestamps(refreshHz, frameCount),
    ...overrides,
  });
}

test('accepts stable per-trial rAF timing across common display refresh rates', () => {
  for (const refreshHz of [60, 90, 120, 144]) {
    for (const frameCount of [1, 12]) {
      const result = EvaluateAtRefreshRate(refreshHz, frameCount);
      assert.equal(result.syncValid, true, `${refreshHz} Hz / ${frameCount} frame should synchronize`);
      assert.equal(result.syncReason, 'synchronized');
      assert.equal(result.actualFrameCount, frameCount);
      assert.equal(result.estimatedDisplayFrameCount, frameCount);
      assert.equal(result.droppedFrameCount, 0);
      assert.ok(Math.abs(result.measuredRefreshHz - refreshHz) < 1e-8);
    }
  }
});

test('rejects a dropped presentation frame', () => {
  const refreshMs = 1000 / 60;
  const result = EvaluatePeripheralAttentionFrameSync({
    requestedFrameCount: 4,
    refreshMs,
    refreshMeasured: true,
    refreshStandardDeviationMs: 0.1,
    frameTimestamps: [0, refreshMs, refreshMs * 2, refreshMs * 4, refreshMs * 5],
  });

  assert.equal(result.syncValid, false);
  assert.equal(result.syncReason, 'dropped-frame');
  assert.equal(result.droppedFrameCount, 1);
});

test('rejects unstable calibration, frame jitter, refresh shifts, and visibility interruptions', () => {
  assert.equal(EvaluateAtRefreshRate(60, 8, {
    refreshStandardDeviationMs: 5,
  }).syncReason, 'unstable-refresh-measurement');

  const refreshMs = 1000 / 60;
  const jitteredIntervals = [12, 21.3, 12, 21.3, 12, 21.3, 12, 21.3];
  const jitteredTimestamps = [0];
  jitteredIntervals.forEach((interval) => jitteredTimestamps.push(jitteredTimestamps.at(-1) + interval));
  assert.equal(EvaluatePeripheralAttentionFrameSync({
    requestedFrameCount: jitteredIntervals.length,
    refreshMs,
    refreshMeasured: true,
    refreshStandardDeviationMs: 0.1,
    frameTimestamps: jitteredTimestamps,
  }).syncReason, 'excessive-frame-jitter');

  assert.equal(EvaluateAtRefreshRate(60, 8, {
    frameTimestamps: CreateTimestamps(120, 8),
  }).syncReason, 'refresh-rate-shift');

  assert.equal(EvaluateAtRefreshRate(60, 8, {
    visibilityInterrupted: true,
  }).syncReason, 'visibility-interrupted');

  assert.equal(EvaluateAtRefreshRate(60, 8, {
    refreshMeasured: false,
  }).syncReason, 'refresh-measurement-unavailable');
});

test('formal policy excludes unsynchronized attempts and pauses after finite automatic retries', () => {
  assert.equal(ShouldCountPeripheralAttentionTrial('formal', false), false);
  assert.equal(ShouldCountPeripheralAttentionTrial('formal', true), true);
  assert.equal(ShouldCountPeripheralAttentionTrial('practice', false), true);

  for (let attempt = 1; attempt <= peripheralAttentionSyncPolicy.maxAutomaticRetries; attempt += 1) {
    assert.equal(GetPeripheralAttentionSyncRecoveryAction(attempt), 'retry');
  }
  assert.equal(
    GetPeripheralAttentionSyncRecoveryAction(peripheralAttentionSyncPolicy.maxAutomaticRetries + 1),
    'pause',
  );
});

test('UFOV experiment integrates per-trial measurement before formal result and staircase updates', () => {
  for (const marker of [
    'MeasureDisplayRefreshRate({ ...peripheralAttentionTrialRefreshOptions, signal: abortSignal })',
    'ShouldCountPeripheralAttentionTrial(config.mode, attempt.timingAttempt.syncValid)',
    'invalidTimingAttemptCount += 1',
    'await this.waitForSynchronizationResume(displayElement, labels, abortSignal)',
    'timing_attempts: timingAttempts',
    'allFormalTrialsSynchronized',
    'Frame_Sync_Valid',
  ]) {
    assert.ok(pageSource.includes(marker), `UFOV synchronization contract missing: ${marker}`);
  }

  const exclusion = pageSource.indexOf('if (!shouldCountTrial)');
  const acceptedTrial = pageSource.indexOf('trials.push(record)', exclusion);
  const staircaseUpdate = pageSource.indexOf('adaptiveState = this.updateAdaptiveState', exclusion);
  assert.ok(exclusion >= 0 && acceptedTrial > exclusion, 'formal timing rejection must precede result insertion');
  assert.ok(staircaseUpdate > acceptedTrial, 'formal timing rejection must precede adaptive staircase updates');
});

test('UFOV aborts startup, per-trial rAF, waits, and stale jsPsych completion', () => {
  for (const marker of [
    'const runAbortControllerRef = useRef<AbortController | null>(null)',
    'const runGenerationRef = useRef(0)',
    'MeasureDisplayRefreshRate({ signal: abortSignal })',
    'experimentRunAbortSignals.set(jsPsych, abortSignal)',
    'if (!isCurrentRun()) return',
    'runAbortControllerRef.current?.abort()',
    "abortSignal?.addEventListener('abort', abortPresentation, { once: true })",
    'window.cancelAnimationFrame(frameId)',
    'ThrowIfPeripheralAttentionRunAborted(abortSignal)',
    'WaitMs(this.jsPsych, fixationMs, abortSignal)',
  ]) {
    assert.ok(pageSource.includes(marker), `UFOV cancellation contract missing: ${marker}`);
  }
});
