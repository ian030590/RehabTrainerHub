#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const compilerOptions = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
};

async function ImportTypeScriptModule(relativePath, transformSource = (source) => source) {
  const sourceUrl = new URL(relativePath, import.meta.url);
  const source = transformSource(await readFile(sourceUrl, 'utf8'));
  const { diagnostics = [], outputText } = ts.transpileModule(source, {
    compilerOptions,
    fileName: sourceUrl.pathname,
    reportDiagnostics: true,
  });

  assert.deepEqual(
    diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error),
    [],
    `Unable to transpile ${relativePath}`,
  );

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  return import(moduleUrl);
}

const [rendering, cameraRig, timing, inputCapabilities, displayTiming] = await Promise.all([
  ImportTypeScriptModule(
    '../apps/rehabtrainerhub/training-modules/vision/experiment/plugins/driving/driving-rendering.ts',
  ),
  ImportTypeScriptModule(
    '../apps/rehabtrainerhub/training-modules/vision/experiment/plugins/driving/driving-camera.ts',
  ),
  ImportTypeScriptModule(
    '../apps/rehabtrainerhub/training-modules/vision/experiment/plugins/driving/driving-timing.ts',
  ),
  ImportTypeScriptModule(
    '../apps/rehabtrainerhub/training-modules/vision/experiment/plugins/driving/driving-input.ts',
  ),
  ImportTypeScriptModule('../packages/ui/src/displayTiming.ts'),
]);

const {
  CalculateDrivingViewport,
  CaptureDrivingRendererPassState,
  CreateDrivingRenderQuality,
  DrivingViewportController,
  RestoreDrivingRendererPassState,
} = rendering;
const { CalculateDrivingCameraPose } = cameraRig;
const {
  CalculateDrivingFixedSteps,
  CalculateEstimatedPresentationTime,
  CalculateFrameAlignedReactionTime,
  NormalizeDrivingInputTimestamp,
  SummarizeReactionTimes,
} = timing;
const {
  CreateDrivingWheelCalibration,
  FindDrivingWheelGamepad,
  IsDrivingControlModeAvailable,
  IsDrivingWheelCalibrationCompatible,
  IsDrivingWheelGamepad,
  ParseDrivingWheelCalibration,
  ReadDrivingWheelInput,
} = inputCapabilities;
const { MeasureDisplayRefreshRate } = displayTiming;

function AssertNearlyEqual(actual, expected, message, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

async function WithFakeDisplayTimingEnvironment(timestamps, run) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const frameCallbacks = new Map();
  const timeoutCallbacks = new Map();
  const visibilityListeners = new Set();
  const pendingTimestamps = [...timestamps];
  let nextFrameId = 1;
  let nextTimeoutId = 1;

  const fakeDocument = {
    visibilityState: 'visible',
    addEventListener(type, listener) {
      if (type === 'visibilitychange') visibilityListeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === 'visibilitychange') visibilityListeners.delete(listener);
    },
  };
  const fakeWindow = {
    cancelAnimationFrame(id) {
      frameCallbacks.delete(id);
    },
    clearTimeout(id) {
      timeoutCallbacks.delete(id);
    },
    requestAnimationFrame(callback) {
      const id = nextFrameId;
      nextFrameId += 1;
      frameCallbacks.set(id, callback);
      return id;
    },
    setTimeout(callback, delay) {
      const id = nextTimeoutId;
      nextTimeoutId += 1;
      timeoutCallbacks.set(id, { callback, delay });
      return id;
    },
  };

  const harness = {
    dispatchVisibility(state) {
      fakeDocument.visibilityState = state;
      for (const listener of [...visibilityListeners]) listener();
    },
    runFrames(limit = Number.POSITIVE_INFINITY) {
      let count = 0;
      while (count < limit && pendingTimestamps.length > 0 && frameCallbacks.size > 0) {
        const [id, callback] = frameCallbacks.entries().next().value;
        frameCallbacks.delete(id);
        callback(pendingTimestamps.shift());
        count += 1;
      }
      return count;
    },
    runSoonestTimeout() {
      const next = [...timeoutCallbacks.entries()]
        .sort((left, right) => left[1].delay - right[1].delay)[0];
      assert.ok(next, 'Expected a pending display timing timeout.');
      timeoutCallbacks.delete(next[0]);
      next[1].callback();
    },
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: fakeWindow,
    writable: true,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: fakeDocument,
    writable: true,
  });

  try {
    return await run(harness);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  }
}

function CreateRendererMock(initialState = {}) {
  const calls = {
    pixelRatios: [],
    sizes: [],
    targets: [],
    viewports: [],
    scissors: [],
    scissorTests: [],
  };
  const state = {
    renderTarget: initialState.renderTarget ?? null,
    viewport: { ...(initialState.viewport ?? { x: 0, y: 0, z: 1, w: 1 }) },
    scissor: { ...(initialState.scissor ?? { x: 0, y: 0, z: 1, w: 1 }) },
    scissorTest: initialState.scissorTest ?? false,
  };
  let defaultViewport = { ...state.viewport };
  let defaultScissor = { ...state.scissor };

  const ReadVectorArguments = (first, y, width, height) => (
    typeof first === 'object'
      ? { x: first.x, y: first.y, z: first.z, w: first.w }
      : { x: first, y, z: width, w: height }
  );

  return {
    calls,
    domElement: { dataset: {} },
    getRenderTarget: () => state.renderTarget,
    getScissor(target) {
      return Object.assign(target, state.scissor);
    },
    getScissorTest: () => state.scissorTest,
    getViewport(target) {
      return Object.assign(target, state.viewport);
    },
    setPixelRatio(value) {
      calls.pixelRatios.push(value);
    },
    setRenderTarget(value) {
      state.renderTarget = value;
      if (value === null) {
        state.viewport = { ...defaultViewport };
        state.scissor = { ...defaultScissor };
      }
      calls.targets.push(value);
    },
    setScissor(first, y, width, height) {
      state.scissor = ReadVectorArguments(first, y, width, height);
      defaultScissor = { ...state.scissor };
      calls.scissors.push({ ...state.scissor });
    },
    setScissorTest(value) {
      state.scissorTest = value;
      calls.scissorTests.push(value);
    },
    setSize(width, height, updateStyle) {
      calls.sizes.push([width, height, updateStyle]);
      defaultViewport = { x: 0, y: 0, z: width, w: height };
      defaultScissor = { x: 0, y: 0, z: width, w: height };
      if (state.renderTarget === null) {
        state.viewport = { ...defaultViewport };
        state.scissor = { ...defaultScissor };
      }
    },
    setViewport(first, y, width, height) {
      state.viewport = ReadVectorArguments(first, y, width, height);
      defaultViewport = { ...state.viewport };
      calls.viewports.push({ ...state.viewport });
    },
    snapshot() {
      return {
        renderTarget: state.renderTarget,
        viewport: { ...state.viewport },
        scissor: { ...state.scissor },
        scissorTest: state.scissorTest,
      };
    },
  };
}

test('3:2 high-quality viewport separates logical CSS pixels from its DPR 1.5 buffer', () => {
  const quality = CreateDrivingRenderQuality('high');
  const viewport = CalculateDrivingViewport(1920, 1280, 1.5, quality.pixelRatioCap);

  assert.deepEqual(viewport, {
    cssWidth: 1920,
    cssHeight: 1280,
    aspect: 1.5,
    pixelRatio: 1.5,
    bufferWidth: 2880,
    bufferHeight: 1920,
  });
});

test('viewport calculation is stable across aspect ratios and render qualities', () => {
  const displays = [
    { name: '4:3', width: 1600, height: 1200, dpr: 1.25 },
    { name: '3:2', width: 1920, height: 1280, dpr: 1.5 },
    { name: '16:9', width: 2560, height: 1440, dpr: 2 },
    { name: '21:9', width: 3440, height: 1440, dpr: 1.75 },
    { name: 'portrait 9:16', width: 1080, height: 1920, dpr: 3 },
    { name: 'square', width: 1200, height: 1200, dpr: 1 },
  ];

  for (const qualityName of ['low', 'medium', 'high']) {
    const quality = CreateDrivingRenderQuality(qualityName);
    for (const display of displays) {
      const viewport = CalculateDrivingViewport(
        display.width,
        display.height,
        display.dpr,
        quality.pixelRatioCap,
      );
      const expectedPixelRatio = Math.max(0.5, Math.min(display.dpr, quality.pixelRatioCap));

      assert.equal(viewport.cssWidth, display.width, `${qualityName}/${display.name} CSS width`);
      assert.equal(viewport.cssHeight, display.height, `${qualityName}/${display.name} CSS height`);
      AssertNearlyEqual(
        viewport.aspect,
        display.width / display.height,
        `${qualityName}/${display.name} aspect`,
      );
      assert.equal(viewport.pixelRatio, expectedPixelRatio, `${qualityName}/${display.name} DPR`);
      assert.equal(
        viewport.bufferWidth,
        Math.floor(display.width * expectedPixelRatio),
        `${qualityName}/${display.name} buffer width`,
      );
      assert.equal(
        viewport.bufferHeight,
        Math.floor(display.height * expectedPixelRatio),
        `${qualityName}/${display.name} buffer height`,
      );
    }
  }

  const firstHighProfile = CreateDrivingRenderQuality('high');
  firstHighProfile.pixelRatioCap = 0.5;
  assert.notEqual(
    CreateDrivingRenderQuality('high').pixelRatioCap,
    firstHighProfile.pixelRatioCap,
    'Quality callers must receive independent profile objects.',
  );
  assert.equal(CreateDrivingRenderQuality('unsupported').level, 'high');

  assert.deepEqual(CalculateDrivingViewport(1001, 667, 1.5, 1.5), {
    cssWidth: 1001,
    cssHeight: 667,
    aspect: 1001 / 667,
    pixelRatio: 1.5,
    bufferWidth: 1501,
    bufferHeight: 1000,
  });
});

test('main render and pass restoration keep logical viewport dimensions at DPR 1.5', () => {
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { devicePixelRatio: 1.5 },
  });

  try {
    const renderer = CreateRendererMock();
    const camera = {
      aspect: 1,
      projectionUpdates: 0,
      updateProjectionMatrix() {
        this.projectionUpdates += 1;
      },
    };
    const root = {
      clientHeight: 1280,
      clientWidth: 1920,
      dataset: {},
      getBoundingClientRect: () => ({ width: 1920, height: 1280 }),
    };
    const controller = new DrivingViewportController({
      renderer,
      camera,
      root,
      pixelRatioCap: CreateDrivingRenderQuality('high').pixelRatioCap,
    });

    const metrics = controller.prepareMainRender();
    assert.equal(metrics.bufferWidth, 2880);
    assert.equal(metrics.bufferHeight, 1920);
    assert.deepEqual(renderer.calls.pixelRatios, [1.5]);
    assert.deepEqual(renderer.calls.sizes, [[1920, 1280, false]]);
    assert.deepEqual(renderer.snapshot().viewport, { x: 0, y: 0, z: 1920, w: 1280 });
    assert.deepEqual(renderer.snapshot().scissor, { x: 0, y: 0, z: 1920, w: 1280 });
    assert.equal(camera.aspect, 1.5);
    assert.equal(camera.projectionUpdates, 1);

    const savedMainPass = CaptureDrivingRendererPassState(
      renderer,
      () => ({ x: 0, y: 0, z: 0, w: 0 }),
    );
    const mirrorTarget = { name: 'rear-view-mirror' };
    renderer.setRenderTarget(mirrorTarget);
    renderer.setViewport(0, 0, 900, 240);
    renderer.setScissor(0, 0, 900, 240);
    renderer.setScissorTest(true);

    RestoreDrivingRendererPassState(renderer, savedMainPass);
    assert.deepEqual(renderer.snapshot(), {
      renderTarget: null,
      viewport: { x: 0, y: 0, z: 1920, w: 1280 },
      scissor: { x: 0, y: 0, z: 1920, w: 1280 },
      scissorTest: false,
    });
    assert.notEqual(
      renderer.snapshot().viewport.z,
      metrics.bufferWidth,
      'Restoring the 2880px physical width would apply DPR twice and skew the camera.',
    );

    renderer.setRenderTarget(mirrorTarget);
    assert.throws(
      () => CaptureDrivingRendererPassState(
        renderer,
        () => ({ x: 0, y: 0, z: 0, w: 0 }),
      ),
      /main framebuffer/,
    );
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
  }
});

test('camera pose and FOV do not depend on aspect ratio, DPR, or quality', () => {
  const baseInput = {
    vehicleX: 4.25,
    vehicleZ: -17.5,
    vehicleHeading: Math.PI / 7,
  };
  const displayVariants = [
    { aspect: 4 / 3, devicePixelRatio: 1, pixelRatio: 1, quality: 'low', renderQuality: 'low' },
    { aspect: 3 / 2, devicePixelRatio: 1.5, pixelRatio: 1.5, quality: 'high', renderQuality: 'high' },
    { aspect: 16 / 9, devicePixelRatio: 2, pixelRatio: 1.5, quality: 'medium', renderQuality: 'medium' },
    { aspect: 9 / 16, devicePixelRatio: 3, pixelRatio: 1.5, quality: 'high', renderQuality: 'high' },
  ];

  for (const mode of ['first-person', 'third-person']) {
    const baseline = CalculateDrivingCameraPose({ ...baseInput, mode });
    for (const display of displayVariants) {
      assert.deepEqual(
        CalculateDrivingCameraPose({ ...baseInput, mode, ...display }),
        baseline,
        `${mode} pose changed for ${JSON.stringify(display)}`,
      );
    }
  }
});

test('camera always faces vehicle-forward with a fixed world-up vector', () => {
  const headings = [0, Math.PI / 2, -Math.PI / 2, Math.PI, Math.PI / 5];

  for (const mode of ['first-person', 'third-person']) {
    const expectedFov = CalculateDrivingCameraPose({
      vehicleX: 0,
      vehicleZ: 0,
      vehicleHeading: 0,
      mode,
    }).fov;

    for (const vehicleHeading of headings) {
      const vehicleX = 13;
      const vehicleZ = -29;
      const pose = CalculateDrivingCameraPose({ vehicleX, vehicleZ, vehicleHeading, mode });
      const forward = { x: Math.sin(vehicleHeading), z: -Math.cos(vehicleHeading) };
      const view = {
        x: pose.lookAt.x - pose.position.x,
        z: pose.lookAt.z - pose.position.z,
      };
      const cameraFromVehicle = {
        x: pose.position.x - vehicleX,
        z: pose.position.z - vehicleZ,
      };
      const targetFromVehicle = {
        x: pose.lookAt.x - vehicleX,
        z: pose.lookAt.z - vehicleZ,
      };
      const CrossWithForward = (vector) => vector.x * forward.z - vector.z * forward.x;

      AssertNearlyEqual(CrossWithForward(view), 0, `${mode} view yaw at heading ${vehicleHeading}`);
      AssertNearlyEqual(
        CrossWithForward(cameraFromVehicle),
        0,
        `${mode} camera lateral offset at heading ${vehicleHeading}`,
      );
      AssertNearlyEqual(
        CrossWithForward(targetFromVehicle),
        0,
        `${mode} target lateral offset at heading ${vehicleHeading}`,
      );
      assert.ok(view.x * forward.x + view.z * forward.z > 0, `${mode} must face forward`);
      assert.deepEqual(pose.up, { x: 0, y: 1, z: 0 });
      assert.equal(pose.fov, expectedFov, `${mode} FOV changed with heading`);
    }
  }
});

test('display refresh measurement resolves reliable 59.94-360 Hz rAF samples', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

  for (const refreshHz of [59.94, 120, 360]) {
    const refreshMs = 1000 / refreshHz;
    const timestamps = Array.from(
      { length: 21 },
      (_, index) => 100 + index * refreshMs,
    );
    const result = await WithFakeDisplayTimingEnvironment(timestamps, async (harness) => {
      const measurement = MeasureDisplayRefreshRate({
        sampleCount: 20,
        minimumSampleCount: 12,
        minSampleMs: 1,
        maxSampleMs: 100,
        timeoutMs: 2_000,
      });
      assert.equal(harness.runFrames(), 21, `${refreshHz} Hz sampled frame count`);
      return measurement;
    });

    assert.equal(result.measured, true, `${refreshHz} Hz measured flag`);
    assert.equal(result.isFallback, false, `${refreshHz} Hz fallback flag`);
    assert.equal(result.sampleCount, 16, `${refreshHz} Hz trimmed sample count`);
    AssertNearlyEqual(result.refreshMs, refreshMs, `${refreshHz} Hz frame duration`, 1e-8);
    AssertNearlyEqual(result.refreshHz, refreshHz, `${refreshHz} Hz refresh rate`, 1e-8);
  }

  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'window'), originalWindow);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'document'), originalDocument);
});

test('display refresh measurement rejects insufficient and invalid rAF samples', async () => {
  const cases = [
    {
      label: 'insufficient valid samples',
      timestamps: [100, 116, 132, 148, 164, 180],
      minimumSampleCount: 6,
    },
    {
      label: 'out-of-range samples',
      timestamps: [100, 100.5, 250, 250.5, 400, 400.5],
      minimumSampleCount: 1,
    },
  ];

  for (const scenario of cases) {
    const result = await WithFakeDisplayTimingEnvironment(
      scenario.timestamps,
      async (harness) => {
        const measurement = MeasureDisplayRefreshRate({
          sampleCount: 12,
          minimumSampleCount: scenario.minimumSampleCount,
          minSampleMs: 1,
          maxSampleMs: 100,
          timeoutMs: 1,
        });
        assert.equal(
          harness.runFrames(),
          scenario.timestamps.length,
          `${scenario.label} sampled frame count`,
        );
        harness.runSoonestTimeout();
        return measurement;
      },
    );

    assert.equal(result.measured, false, `${scenario.label} measured flag`);
    assert.equal(result.isFallback, true, `${scenario.label} fallback flag`);
    assert.equal(result.sampleCount, 0, `${scenario.label} reliable sample count`);
    AssertNearlyEqual(result.refreshHz, 60, `${scenario.label} fallback refresh rate`);
  }
});

test('display refresh measurement pauses across hidden visibility gaps', async () => {
  const refreshMs = 1000 / 120;
  const timestamps = [
    100,
    100 + refreshMs,
    100 + refreshMs * 2,
    1_000,
    ...Array.from({ length: 6 }, (_, index) => 1_000 + refreshMs * (index + 1)),
  ];

  const result = await WithFakeDisplayTimingEnvironment(timestamps, async (harness) => {
    const measurement = MeasureDisplayRefreshRate({
      sampleCount: 8,
      minimumSampleCount: 8,
      minSampleMs: 1,
      maxSampleMs: 2_000,
      timeoutMs: 2_000,
    });
    assert.equal(harness.runFrames(3), 3, 'visible frames before pause');
    harness.dispatchVisibility('hidden');
    assert.equal(harness.runFrames(), 0, 'hidden document must not schedule rAF');
    harness.dispatchVisibility('visible');
    assert.equal(harness.runFrames(), 7, 'visible frames after resume');
    return measurement;
  });

  assert.equal(result.measured, true);
  assert.equal(result.isFallback, false);
  assert.equal(result.sampleCount, 8);
  AssertNearlyEqual(result.refreshHz, 120, 'visibility-resumed refresh rate', 1e-8);
  assert.ok(
    result.standardDeviationMs < 1e-8,
    `Hidden interval leaked into samples: standard deviation ${result.standardDeviationMs}`,
  );
});

test('display refresh measurement cancels pending rAF work on abort', async () => {
  const result = await WithFakeDisplayTimingEnvironment([100, 116.67, 133.33], async () => {
    const controller = new AbortController();
    const measurement = MeasureDisplayRefreshRate({
      sampleCount: 20,
      minimumSampleCount: 8,
      timeoutMs: 2_000,
      signal: controller.signal,
    });
    controller.abort();
    return measurement;
  });

  assert.equal(result.measured, false);
  assert.equal(result.isFallback, true);
  assert.equal(result.sampleCount, 0);
});

test('reaction times align to the measured 59.94-360 Hz display frame grid', () => {
  const frameCount = 12;
  const expectedRoundedRt = new Map([
    [59.94, 200],
    [60, 200],
    [90, 133],
    [120, 100],
    [144, 83],
    [165, 73],
    [240, 50],
    [360, 33],
  ]);
  const alignedValues = [];

  for (const [refreshRate, expectedRtMs] of expectedRoundedRt) {
    const refreshMs = 1000 / refreshRate;
    const presentedAt = 4123.75;
    const respondedAt = presentedAt + frameCount * refreshMs;
    const result = CalculateFrameAlignedReactionTime(presentedAt, respondedAt, refreshMs);

    assert.equal(result.frameCount, frameCount, `${refreshRate} Hz frame count`);
    assert.equal(result.rtMs, expectedRtMs, `${refreshRate} Hz rounded RT`);
    AssertNearlyEqual(
      result.rawRtMs,
      frameCount * refreshMs,
      `${refreshRate} Hz raw RT`,
      1e-8,
    );

    const jittered = CalculateFrameAlignedReactionTime(
      presentedAt,
      respondedAt + refreshMs * 0.2,
      refreshMs,
    );
    assert.equal(jittered.frameCount, frameCount, `${refreshRate} Hz timestamp jitter`);
    assert.equal(jittered.rtMs, expectedRtMs, `${refreshRate} Hz jittered RT`);
    alignedValues.push(result.rtMs);
  }

  assert.deepEqual(alignedValues, [200, 200, 133, 100, 83, 73, 50, 33]);
  assert.deepEqual(SummarizeReactionTimes(alignedValues), { averageMs: 109, medianMs: 92 });
});

test('reaction-time zero/fallback handling and summaries remain deterministic', () => {
  assert.deepEqual(CalculateFrameAlignedReactionTime(200, 200, 1000 / 144), {
    rtMs: 0,
    rawRtMs: 0,
    frameCount: 0,
  });
  assert.deepEqual(CalculateFrameAlignedReactionTime(200, 175, 1000 / 60), {
    rtMs: 0,
    rawRtMs: 0,
    frameCount: 0,
  });
  const fallback = CalculateFrameAlignedReactionTime(100, 123.6, Number.NaN);
  assert.equal(fallback.rtMs, 24);
  AssertNearlyEqual(fallback.rawRtMs, 23.6, 'Fallback raw RT');
  assert.equal(fallback.frameCount, 0);

  const source = [200, null, 100, Number.NaN, 167, undefined, 133];
  assert.deepEqual(SummarizeReactionTimes(source), { averageMs: 150, medianMs: 150 });
  assert.deepEqual(source, [200, null, 100, Number.NaN, 167, undefined, 133]);
  assert.deepEqual(SummarizeReactionTimes([undefined, null, Number.NaN]), {
    averageMs: 0,
    medianMs: 0,
  });
});

test('presentation estimates account for the measured frame grid and missed deadlines', () => {
  const refreshMs = 1000 / 120;
  assert.equal(CalculateEstimatedPresentationTime(1000, 1002, refreshMs), 1000 + refreshMs);
  assert.equal(CalculateEstimatedPresentationTime(1000, 1010, refreshMs), 1000 + refreshMs * 2);
  assert.equal(CalculateEstimatedPresentationTime(1000, 1007, Number.NaN), 1007);
});

test('input timestamps reject zero, stale, and future gamepad clocks', () => {
  assert.equal(NormalizeDrivingInputTimestamp(0, 500), 500);
  assert.equal(NormalizeDrivingInputTimestamp(200, 1_500), 1_500);
  assert.equal(NormalizeDrivingInputTimestamp(1_500.001, 1_500), 1_500);
  assert.equal(NormalizeDrivingInputTimestamp(1_601, 1_500), 1_500);
  assert.equal(NormalizeDrivingInputTimestamp(1_499, 1_500), 1_499);
});

test('fixed-step simulation remains refresh-independent from 24 to 360 Hz', () => {
  const fixedStepMs = 1000 / 120;
  for (const refreshHz of [24, 30, 59.94, 60, 90, 120, 144, 165, 240, 360]) {
    let accumulatorMs = 0;
    let simulatedMs = 0;
    const frameDurationMs = 1000 / refreshHz;
    const frameCount = Math.round(refreshHz * 10);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const result = CalculateDrivingFixedSteps(
        accumulatorMs,
        frameDurationMs,
        fixedStepMs,
        250,
      );
      accumulatorMs = result.nextAccumulatorMs;
      simulatedMs += result.simulatedMs;
    }
    const elapsedMs = frameCount * frameDurationMs;
    assert.ok(
      Math.abs((simulatedMs + accumulatorMs) - elapsedMs) < 0.001,
      `${refreshHz} Hz lost simulation time`,
    );
    assert.ok(accumulatorMs < fixedStepMs, `${refreshHz} Hz accumulator overflow`);
  }

  const droppedFrame = CalculateDrivingFixedSteps(0, 1000, fixedStepMs, 250);
  assert.equal(droppedFrame.stepCount, 30);
  AssertNearlyEqual(droppedFrame.simulatedMs, 250, 'Dropped-frame simulated time');
  assert.equal(droppedFrame.droppedMs, 750);
});

test('control modes follow the keyboard, wheel, and touch capability matrix', () => {
  const modes = ['arrow', 'wasd', 'wheel', 'touch'];
  const unavailable = {
    keyboardConfirmed: false,
    touchAvailable: false,
    wheelApiSupported: false,
    wheelDevice: null,
  };
  const cases = [
    { name: 'no input', capabilities: unavailable, available: [] },
    {
      name: 'keyboard',
      capabilities: { ...unavailable, keyboardConfirmed: true },
      available: ['arrow', 'wasd'],
    },
    {
      name: 'touchscreen',
      capabilities: { ...unavailable, touchAvailable: true },
      available: ['touch'],
    },
    {
      name: 'Gamepad API without a connected wheel',
      capabilities: { ...unavailable, wheelApiSupported: true },
      available: [],
    },
    {
      name: 'connected wheel',
      capabilities: {
        ...unavailable,
        wheelApiSupported: true,
        wheelDevice: { id: 'USB Steering Wheel', index: 1 },
      },
      available: ['wheel'],
    },
    {
      name: 'all inputs',
      capabilities: {
        keyboardConfirmed: true,
        touchAvailable: true,
        wheelApiSupported: true,
        wheelDevice: { id: 'USB Steering Wheel', index: 1 },
      },
      available: modes,
    },
  ];

  for (const capabilityCase of cases) {
    for (const mode of modes) {
      assert.equal(
        IsDrivingControlModeAvailable(mode, capabilityCase.capabilities),
        capabilityCase.available.includes(mode),
        `${capabilityCase.name}: ${mode}`,
      );
    }
  }

  assert.equal(IsDrivingControlModeAvailable('unsupported', cases.at(-1).capabilities), false);
});

test('wheel detection rejects ordinary gamepads and selects a recognized steering wheel', () => {
  const xboxController = {
    connected: true,
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
    index: 0,
  };
  const playstationController = {
    connected: true,
    id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
    index: 1,
  };
  const wheel = {
    connected: true,
    id: 'Logitech G29 Driving Force Racing Wheel USB',
    index: 2,
  };

  assert.equal(IsDrivingWheelGamepad(xboxController), false);
  assert.equal(IsDrivingWheelGamepad(playstationController), false);
  assert.equal(IsDrivingWheelGamepad({ ...wheel, connected: false }), false);
  assert.equal(IsDrivingWheelGamepad(wheel), true);
  assert.equal(
    FindDrivingWheelGamepad([xboxController, null, playstationController, wheel]),
    wheel,
  );
  assert.equal(FindDrivingWheelGamepad([xboxController, playstationController]), null);
});

test('wheel calibration discovers per-device axes and normalizes their endpoints', () => {
  const neutral = { axes: [0, 1, 1, 0], buttons: [0, 0, 0] };
  const result = CreateDrivingWheelCalibration({
    deviceId: 'Logitech G29 Driving Force Racing Wheel USB',
    neutral,
    left: [{ axes: [-1, 1, 1, 0], buttons: [0, 0, 0] }],
    right: [{ axes: [1, 1, 1, 0], buttons: [0, 0, 0] }],
    throttle: [{ axes: [0, -1, 1, 0], buttons: [0, 0, 0] }],
    brake: [{ axes: [0, 1, -1, 0], buttons: [0, 0, 0] }],
  });
  assert.equal(result.error, null);
  assert.ok(result.calibration);
  assert.deepEqual(result.calibration.steering, { axis: 0, center: 0, left: -1, right: 1 });
  assert.deepEqual(result.calibration.throttle, {
    source: 'axis', index: 1, releasedValue: 1, pressedValue: -1,
  });
  assert.deepEqual(result.calibration.brake, {
    source: 'axis', index: 2, releasedValue: 1, pressedValue: -1,
  });

  const input = ReadDrivingWheelInput({
    id: result.calibration.deviceId,
    axes: [0.5, 0, -1, 0],
    buttons: [{ value: 0 }, { value: 0 }, { value: 0 }],
  }, result.calibration);
  assert.deepEqual(input, { steering: 0.5, throttle: 0.5, brake: 1 });
  assert.equal(IsDrivingWheelCalibrationCompatible({
    id: result.calibration.deviceId,
    axes: [0.5, 0, -1, 0],
    buttons: [{ value: 0 }, { value: 0 }, { value: 0 }],
  }, result.calibration), true);
  assert.equal(IsDrivingWheelCalibrationCompatible({
    id: result.calibration.deviceId,
    axes: [0.5],
    buttons: [],
  }, result.calibration), false);
  assert.equal(ReadDrivingWheelInput({
    id: result.calibration.deviceId,
    axes: [0.5],
    buttons: [],
  }, result.calibration), null);
  assert.deepEqual(ParseDrivingWheelCalibration(JSON.stringify(result.calibration)), result.calibration);
  assert.equal(ParseDrivingWheelCalibration('{broken'), null);

  const incomplete = CreateDrivingWheelCalibration({
    deviceId: result.calibration.deviceId,
    neutral,
    left: [{ axes: [-1, 1, 1, 0], buttons: [0, 0, 0] }],
    right: [{ axes: [0, 1, 1, 0], buttons: [0, 0, 0] }],
    throttle: [],
    brake: [],
  });
  assert.deepEqual(incomplete, { calibration: null, error: 'steering' });
});
