#!/usr/bin/env node

const options = ParseArguments(process.argv.slice(2));
const debuggerBaseUrl = `http://127.0.0.1:${options.debugPort}`;
const trainingUrlFragment = '/runtimes/vision/#/training?module=oculomotor-training';
const deadline = Date.now() + options.timeoutMs;

const target = await FindTrainingTarget();
const cdp = await ConnectCdp(target.webSocketDebuggerUrl);
const observed = {
  calibration: false,
  calibrationDone: false,
  cameraLabels: new Set(),
  formalPreviewHidden: false,
  gazePoint: false,
  init: false,
  initPreview: false,
  recalibration: false,
  validation: false,
};
const browserErrors = [];
let previousStage = '';

cdp.On('Runtime.exceptionThrown', (params) => {
  const details = params.exceptionDetails;
  browserErrors.push(details.exception?.description || details.text || 'Unknown browser exception');
});
cdp.On('Log.entryAdded', (params) => {
  if (params.entry.level === 'error') browserErrors.push(params.entry.text);
});
await cdp.Send('Runtime.enable');
await cdp.Send('Log.enable');

try {
  while (Date.now() < deadline) {
    const snapshot = await ReadSnapshot(cdp);
    UpdateObserved(snapshot);
    const stage = GetStage(snapshot);
    if (stage !== previousStage) {
      previousStage = stage;
      console.log(`WebGazer acceptance stage: ${stage}`);
    }

    if (snapshot.record) {
      const acceptance = ValidateAcceptance(snapshot, observed, browserErrors);
      console.log(JSON.stringify(acceptance, null, 2));
      if (!acceptance.passed) process.exitCode = 1;
      break;
    }

    await Delay(200);
  }

  if (!previousStage || Date.now() >= deadline) {
    throw new Error(`Timed out after ${options.timeoutMs} ms while waiting for the real-camera result.`);
  }
} finally {
  cdp.Close();
}

function ParseArguments(args) {
  const parsed = {
    debugPort: 9331,
    timeoutMs: 10 * 60 * 1000,
  };
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    const value = args[index + 1];
    if (name === '--debug-port') {
      parsed.debugPort = ParsePositiveInteger(value, name);
      index += 1;
    } else if (name === '--timeout-ms') {
      parsed.timeoutMs = ParsePositiveInteger(value, name);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${name}`);
    }
  }
  return parsed;
}

function ParsePositiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return number;
}

async function FindTrainingTarget() {
  while (Date.now() < deadline) {
    const response = await fetch(`${debuggerBaseUrl}/json/list`);
    if (!response.ok) throw new Error(`Unable to list browser targets: HTTP ${response.status}`);
    const targets = await response.json();
    const match = targets.find((candidate) => (
      candidate.type === 'page'
      && candidate.url.includes(trainingUrlFragment)
    ));
    if (match) return match;
    await Delay(200);
  }
  throw new Error('The real-camera WebGazer training tab was not found.');
}

async function ConnectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const handler = pending.get(message.id);
      if (!handler) return;
      pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message));
      else handler.resolve(message.result);
      return;
    }
    for (const listener of listeners.get(message.method) || []) {
      listener(message.params || {});
    }
  });

  return {
    Close() {
      socket.close();
    },
    On(method, listener) {
      const methodListeners = listeners.get(method) || [];
      methodListeners.push(listener);
      listeners.set(method, methodListeners);
    },
    Send(method, params = {}) {
      const id = nextId;
      nextId += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { reject, resolve }));
    },
  };
}

async function ReadSnapshot(cdp) {
  const result = await cdp.Send('Runtime.evaluate', {
    expression: `(${BrowserSnapshot.toString()})()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value || {};
}

async function BrowserSnapshot() {
  const permission = await navigator.permissions
    ?.query?.({ name: 'camera' })
    .then((status) => status.state)
    .catch(() => 'unavailable');
  const videoTracks = Array.from(document.querySelectorAll('video'))
    .flatMap((video) => Array.from(video.srcObject?.getVideoTracks?.() || []))
    .map((track) => ({
      enabled: track.enabled,
      label: track.label,
      muted: track.muted,
      readyState: track.readyState,
    }));
  const gazeDot = document.querySelector('#webgazerGazeDot');
  const gazePointVisible = Boolean(gazeDot) && getComputedStyle(gazeDot).display !== 'none';
  const videoContainer = document.querySelector('#webgazerVideoContainer');
  const videoVisible = Boolean(videoContainer) && getComputedStyle(videoContainer).display !== 'none';
  const formalTrial = Boolean(document.querySelector('.oculomotor-training-trial canvas'));
  const record = document.querySelector('.results-score')
    ? await new Promise((resolve) => {
        const request = indexedDB.open('rehabtrainerhub.vision.training-records');
        request.onerror = () => resolve(null);
        request.onupgradeneeded = () => {
          request.transaction?.abort();
          resolve(null);
        };
        request.onsuccess = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains('records')) {
            database.close();
            resolve(null);
            return;
          }
          const transaction = database.transaction('records', 'readonly');
          const recordsRequest = transaction.objectStore('records').getAll();
          recordsRequest.onerror = () => resolve(null);
          recordsRequest.onsuccess = () => {
            database.close();
            const records = recordsRequest.result || [];
            records.sort((left, right) => String(right.savedAt).localeCompare(String(left.savedAt)));
            const latest = records.find((candidate) => candidate.moduleId === 'oculomotor-training');
            if (!latest) {
              resolve(null);
              return;
            }
            const trial = latest.results?.find(
              (candidate) => candidate.trial_type === 'pixi-oculomotor-training',
            );
            resolve({
              config: latest.config,
              id: latest.id,
              result: trial,
              savedAt: latest.savedAt,
            });
          };
        };
      })
    : null;

  return {
    calibration: Boolean(document.querySelector('#webgazer-calibrate-container')),
    calibrationDone: Boolean(document.querySelector('[data-webgazer-step="calibration_done"]')),
    cameraPermission: permission || 'unavailable',
    formalPreviewHidden: formalTrial && !videoVisible,
    gazePointVisible,
    init: Boolean(document.querySelector('#webgazer-init-container')),
    initPreviewVisible: Boolean(document.querySelector('#webgazer-init-container')) && videoVisible,
    recalibration: Boolean(document.querySelector('[data-webgazer-step="recalibrate_instructions"]')),
    record,
    results: Boolean(document.querySelector('.results-score')),
    validation: Boolean(document.querySelector('#webgazer-validate-container')),
    videoTracks,
    webgazerApi: {
      begin: typeof window.webgazer?.begin,
      faceMeshSolutionPath: window.webgazer?.params?.faceMeshSolutionPath || null,
      prediction: typeof window.webgazer?.getCurrentPrediction,
    },
  };
}

function UpdateObserved(snapshot) {
  if (snapshot.init) observed.init = true;
  if (snapshot.initPreviewVisible) observed.initPreview = true;
  if (snapshot.calibration) observed.calibration = true;
  if (snapshot.calibrationDone) observed.calibrationDone = true;
  if (snapshot.recalibration) observed.recalibration = true;
  if (snapshot.validation) observed.validation = true;
  if (snapshot.formalPreviewHidden) observed.formalPreviewHidden = true;
  if (snapshot.gazePointVisible) observed.gazePoint = true;
  for (const track of snapshot.videoTracks || []) {
    if (track.label) observed.cameraLabels.add(track.label);
  }
}

function GetStage(snapshot) {
  if (snapshot.record) return 'results-saved';
  if (snapshot.results) return 'results-rendered';
  if (snapshot.calibrationDone) return 'calibration-done';
  if (snapshot.recalibration) return 'recalibration-instructions';
  if (snapshot.validation) return 'validation';
  if (snapshot.calibration) return 'calibration';
  if (snapshot.init) return snapshot.initPreviewVisible ? 'head-position-with-preview' : 'head-position';
  if (snapshot.gazePointVisible) return 'training-with-gazepoint';
  return 'loading-or-training';
}

function ValidateAcceptance(snapshot, state, errors) {
  const trial = snapshot.record?.result;
  const samples = Array.isArray(trial?.gaze_samples) ? trial.gaze_samples : [];
  const nativeSamples = Array.isArray(trial?.webgazer_data) ? trial.webgazer_data : [];
  const pointPairsValid = samples.length > 0 && samples.every((sample) => (
    Array.isArray(sample)
    && sample.length >= 9
    && sample.slice(0, 6).every(Number.isFinite)
    && (sample[6] === null || Number.isFinite(sample[6]))
    && (sample[7] === 0 || sample[7] === 1)
    && Number.isFinite(sample[8])
  ));
  const checks = {
    calibrationDoneSeen: state.calibrationDone,
    calibrationStageSeen: state.calibration,
    cameraPermissionGranted: snapshot.cameraPermission === 'granted',
    cameraTrackSeen: state.cameraLabels.size > 0,
    formalPreviewHidden: state.formalPreviewHidden,
    gazePointSeen: state.gazePoint,
    initStageSeen: state.init,
    initPreviewSeen: state.initPreview,
    meanDistanceCalculated: Number.isFinite(trial?.mean_target_distance_px),
    nativeWebGazerApi: snapshot.webgazerApi?.begin === 'function'
      && snapshot.webgazerApi?.prediction === 'function'
      && typeof snapshot.webgazerApi?.faceMeshSolutionPath === 'string'
      && /\/mediapipe\/face_mesh\/?$/.test(snapshot.webgazerApi.faceMeshSolutionPath),
    nativeWebGazerDataRetained: nativeSamples.length > 0
      && nativeSamples.length === trial?.webgazer_sample_count
      && nativeSamples.every((sample) => (
        Number.isFinite(sample?.x)
        && Number.isFinite(sample?.y)
        && Number.isFinite(sample?.t)
      )),
    noBrowserErrors: errors.length === 0,
    officialCoordinateSource: trial?.gaze_coordinate_source === 'jspsych-webgazer-extension',
    pointPairsValid,
    pupilSizeCalculated: Number.isFinite(trial?.average_pupil_size_px),
    pupilSizeStandardDeviationCalculated: Number.isFinite(trial?.pupil_size_sd_px),
    resultSaved: Boolean(snapshot.record?.id),
    standardDeviationCalculated: Number.isFinite(trial?.target_distance_sd_px),
    timeToFirstFixationCalculated: Object.hasOwn(trial || {}, 'time_to_first_fixation_ms'),
    blinkCountCalculated: Number.isFinite(trial?.blink_count),
    nativeValidationStageSeen: state.validation,
    webGazerEnabledInRecord: snapshot.record?.config?.oculomotorEnableWebgazer === true,
    webGazerNativeDataConsumed: trial?.webgazer_data_consumed === true,
    gazePointEnabledInRecord: snapshot.record?.config?.oculomotorShowGazepoint === true,
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    cameraLabels: [...state.cameraLabels],
    recalibrationSeen: state.recalibration,
    metrics: {
      averagePupilSizePx: trial?.average_pupil_size_px ?? null,
      blinkCount: trial?.blink_count ?? null,
      gazeSampleCount: samples.length,
      nativeWebGazerSampleCount: nativeSamples.length,
      meanTargetDistancePx: trial?.mean_target_distance_px ?? null,
      pupilSizeSdPx: trial?.pupil_size_sd_px ?? null,
      targetDistanceSdPx: trial?.target_distance_sd_px ?? null,
      timeToFirstFixationMs: trial?.time_to_first_fixation_ms ?? null,
    },
    browserErrors: errors,
  };
}

function Delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
