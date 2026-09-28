// Based on TobiiOculomotor/wwwroot/app.js. The jsPsych experiment, timing,
// calibration, validation, stimulus geometry and WebGazer sampling are retained.
// Browser-only adaptation: settings and scores cross the first-party iframe boundary.
"use strict";
(() => {
  const { ParameterType } = jsPsychModule;
  const EYE_SOURCE_OFF = "off";
  const EYE_SOURCE_WEBGAZER = "webgazer";
  const WEBGAZER_COMPONENTS_AVAILABLE = Boolean(window.webgazer && window.jsPsychExtensionWebgazer && window.jsPsychWebgazerInitCamera && window.jsPsychWebgazerCalibrate);
  let subjectId = "";
  const AppState = {
    calibration: null,
    pending: null,
    lastSession: null,
    interactions: [],
    webgazerActiveTrial: null,
    eyeTracking: {
      source: EYE_SOURCE_OFF,
      available: WEBGAZER_COMPONENTS_AVAILABLE,
      enabled: false,
      initialized: false,
      calibrated: false,
      calibrationRequested: false,
      needsRecalibration: false,
      calibratedAt: null,
      calibrationViewport: null,
      lastValidation: null,
      lastError: null
    }
  };
    const RAD_PER_ARCMIN = Math.PI / 10800;
    const ARCMIN_PER_RAD = 10800 / Math.PI;
    const RAD_PER_ARCSEC = Math.PI / 648000;
    const ARCSEC_PER_RAD = 648000 / Math.PI;
    const EVALUATION = "evaluation";
    const PREDICTABLE = "predictable";
    const RANDOM = "random";
    const MODULES = {
      vor: {
        code: "VOR",
        name: "Vestibulo-Ocular Reflex",
        short: "Central target recognition",
        description: "Keep your gaze on the center target while its color and number change."
      },
      pursuit: {
        code: "PURSUIT",
        name: "Smooth Pursuit",
        short: "Linear target tracking",
        description: "Follow a target moving at a constant speed from the center toward selected screen-edge positions."
      },
      saccade: {
        code: "SACCADE",
        name: "Saccade",
        short: "Grid jumps",
        description: "Shift your gaze as the target jumps between selected positions in the 3 × 3 grid."
      },
      fixation: {
        code: "FIXATION",
        name: "Fixation",
        short: "Movement and edge hold",
        description: "Follow the target to the screen edge and keep your gaze fixed while it remains there."
      }
    };

    const ALL_DIRECTIONS = [
      "leftUp", "middleUp", "rightUp",
      "leftMiddle", "rightMiddle",
      "leftDown", "middleDown", "rightDown"
    ];

    const NINE_GRID_SLOTS = [
      { type: "dir", key: "leftUp",      label: "Top-Left",     arrow: "↖" },
      { type: "dir", key: "middleUp",    label: "Up",           arrow: "↑" },
      { type: "dir", key: "rightUp",     label: "Top-Right",    arrow: "↗" },
      { type: "dir", key: "leftMiddle",  label: "Left",         arrow: "←" },
      { type: "center", key: "all",      label: "Select All",   arrow: "ALL" },
      { type: "dir", key: "rightMiddle", label: "Right",        arrow: "→" },
      { type: "dir", key: "leftDown",    label: "Bottom-Left",  arrow: "↙" },
      { type: "dir", key: "middleDown",  label: "Down",         arrow: "↓" },
      { type: "dir", key: "rightDown",   label: "Bottom-Right", arrow: "↘" }
    ];

    const STIMULUS_TYPES = {
      white_dot: { id: "white_dot", name: "White dot", meta: "Standard solid white dot" },
      red_in_white: { id: "red_in_white", name: "Red in White", meta: "White circle with red center" },
      numbers_dot: { id: "numbers_dot", name: "Numbers dot", meta: "Dynamic color & number target" }
    };

    const MODULE_DEFAULTS = {
      vor: { ballArcmin: 60, changeMs: 500, totalSec: 30 },
      pursuit: { mode: PREDICTABLE, stimulusType: "white_dot", ballArcmin: 60, speedArcminSec: 300, totalSec: 45, directions: [...ALL_DIRECTIONS] },
      saccade: { mode: PREDICTABLE, stimulusType: "white_dot", ballArcmin: 60, dwellMs: 500, totalSec: 45, directions: [...ALL_DIRECTIONS] },
      fixation: { mode: PREDICTABLE, stimulusType: "white_dot", ballArcmin: 60, speedArcminSec: 300, holdSec: 2, totalSec: 60, directions: [...ALL_DIRECTIONS] }
    };

    const EDGE_SEQUENCE = [
      "rightUp", "leftUp", "rightDown", "leftDown",
      "middleUp", "middleDown", "leftMiddle", "rightMiddle"
    ];

    const SACCADE_SEQUENCE = [
      "rightUp", "leftUp", "rightUp", "leftUp",
      "rightDown", "leftDown", "rightDown", "leftDown",
      "rightMiddle", "leftMiddle", "rightMiddle", "leftMiddle",
      "middleUp", "middleDown", "middleUp", "middleDown",
      "rightUp", "rightDown", "rightUp", "rightDown",
      "leftUp", "leftDown", "leftUp", "leftDown"
    ];

    const DIRECTION_LABELS = {
      rightUp: "Upper Right",
      leftUp: "Upper Left",
      rightDown: "Lower Right",
      leftDown: "Lower Left",
      rightMiddle: "Right",
      leftMiddle: "Left",
      middleUp: "Up",
      middleDown: "Down",
      center: "Center"
    };

    const GRID_KEYS = [
      "leftUp", "middleUp", "rightUp",
      "leftMiddle", "center", "rightMiddle",
      "leftDown", "middleDown", "rightDown"
    ];

    const VOR_COLORS = [
      "#63e6ff", "#b9f66d", "#ffd166", "#ff8295",
      "#c7a7ff", "#ff9f5b", "#76f2c6", "#f4f7fb"
    ];


    const round = (value, digits = 2) => {
      const factor = 10 ** digits;
      return Math.round(value * factor) / factor;
    };

    const formatNumber = (value, digits = 1) =>
      Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits
      });

    const visualAngleArcmin = (sizeCm, distanceCm) =>
      2 * Math.atan(sizeCm / (2 * distanceCm)) * ARCMIN_PER_RAD;

    const physicalSizeForArcmin = (arcmin, distanceCm) =>
      2 * distanceCm * Math.tan((arcmin * RAD_PER_ARCMIN) / 2);

    const currentScreenPixels = () => ({
      width: Math.max(1, Number(window.screen && window.screen.width) || window.innerWidth || 1),
      height: Math.max(1, Number(window.screen && window.screen.height) || window.innerHeight || 1)
    });

    function createCalibration(values) {
      const screenPixels = currentScreenPixels();
      const screenWidthCm = Number(values.screenWidthCm);
      const screenHeightCm = Number(values.screenHeightCm);
      const viewingDistanceCm = Number(values.viewingDistanceCm);
      const physicalRatio = screenWidthCm / screenHeightCm;
      const pixelRatio = screenPixels.width / screenPixels.height;
      return {
        screenWidthCm,
        screenHeightCm,
        viewingDistanceCm,
        screenWidthPx: screenPixels.width,
        screenHeightPx: screenPixels.height,
        devicePixelRatio: Number(window.devicePixelRatio) || 1,
        horizontalArcmin: visualAngleArcmin(screenWidthCm, viewingDistanceCm),
        verticalArcmin: visualAngleArcmin(screenHeightCm, viewingDistanceCm),
        aspectMismatchPercent: Math.abs(physicalRatio / pixelRatio - 1) * 100,
        createdAt: new Date().toISOString()
      };
    }


    function stimulusPixels(arcmin, calibration, screenPixels = currentScreenPixels()) {
      const diameterCm = physicalSizeForArcmin(arcmin, calibration.viewingDistanceCm);
      return {
        width: diameterCm * screenPixels.width / calibration.screenWidthCm,
        height: diameterCm * screenPixels.height / calibration.screenHeightCm,
        diameterCm
      };
    }


    function currentViewportSignature() {
      return {
        width: Math.round(window.innerWidth),
        height: Math.round(window.innerHeight),
        screenWidth: Math.round(Number(window.screen && window.screen.width) || 0),
        screenHeight: Math.round(Number(window.screen && window.screen.height) || 0),
        devicePixelRatio: Number(window.devicePixelRatio) || 1,
        fullscreen: Boolean(fullscreenElement())
      };
    }

    function viewportSignaturesMatch(left, right) {
      if (!left || !right) return false;
      if (left.fullscreen && right.fullscreen &&
          left.screenWidth === right.screenWidth &&
          left.screenHeight === right.screenHeight &&
          Math.abs(left.devicePixelRatio - right.devicePixelRatio) < 0.01) {
        return true;
      }
      return Math.abs(left.width - right.width) <= 8 &&
        Math.abs(left.height - right.height) <= 8 &&
        left.screenWidth === right.screenWidth &&
        left.screenHeight === right.screenHeight &&
        Math.abs(left.devicePixelRatio - right.devicePixelRatio) < 0.01 &&
        left.fullscreen === right.fullscreen;
    }

    async function stopEyeTrackingRuntime() {
      const extension = window.jsPsychInstance && window.jsPsychInstance.extensions
        ? window.jsPsychInstance.extensions.webgazer
        : null;
      AppState.eyeTracking.enabled = false;
      AppState.eyeTracking.source = EYE_SOURCE_OFF;
      AppState.eyeTracking.initialized = false;
      AppState.eyeTracking.calibrated = false;
      AppState.eyeTracking.calibrationRequested = false;
      AppState.eyeTracking.calibratedAt = null;
      AppState.eyeTracking.calibrationViewport = null;
      if (extension) {
        try { extension.pause(); } catch (error) { /* Continue releasing the camera. */ }
        try { extension.hideVideo(); } catch (error) { /* Continue releasing the camera. */ }
        try { extension.hidePredictions(); } catch (error) { /* Continue releasing the camera. */ }
      }
      try {
        if (window.webgazer && typeof window.webgazer.end === "function") {
          await Promise.resolve(window.webgazer.end());
        }
      } catch (error) { /* Media tracks are also stopped by the browser when the page closes. */ }
      if (extension && Object.prototype.hasOwnProperty.call(extension, "initialized")) {
        extension.initialized = false;
      }
    }


    function beginWebGazerTrial(sessionId) {
      AppState.webgazerActiveTrial = {
        sessionId,
        startedPerformance: performance.now(),
        samples: [],
        lastAcceptedClock: null,
        downsampled: 0,
        overflow: 0,
        lastSampleTsUs: null,
        totalBlinkMs: 0,
        totalValidMs: 0,
        totalInThreshMs: 0,
        synchronousRecords: [],
        onSample: null
      };
      return AppState.webgazerActiveTrial;
    }

    function finishWebGazerTrial(sessionId) {
      const active = AppState.webgazerActiveTrial;
      AppState.webgazerActiveTrial = null;
      if (!active || active.sessionId !== sessionId) {
        return { samples: [], downsampled: 0, overflow: 0, synchronousRecords: [], totalBlinkMs: 0, totalValidMs: 0, totalInThreshMs: 0, accuracyRate: 0 };
      }
      const validMs = active.totalValidMs || 0;
      const inThreshMs = active.totalInThreshMs || 0;
      const accRate = validMs > 0 ? round((inThreshMs / validMs) * 100, 2) : 0;
      return {
        samples: active.samples,
        downsampled: active.downsampled,
        overflow: active.overflow,
        synchronousRecords: active.synchronousRecords || [],
        totalBlinkMs: round(active.totalBlinkMs || 0, 2),
        totalValidMs: round(validMs, 2),
        totalInThreshMs: round(inThreshMs, 2),
        accuracyRate: accRate
      };
    }


    function fullscreenElement() {
      return document.fullscreenElement || window.parent.document.fullscreenElement || null;
    }

    function exitFullscreenSafely() {
      try {
        if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
          return Promise.resolve(document.exitFullscreen()).catch(() => undefined);
        }
        if (document.webkitFullscreenElement && typeof document.webkitExitFullscreen === "function") {
          return Promise.resolve(document.webkitExitFullscreen()).catch(() => undefined);
        }
      } catch (error) {
        return Promise.resolve();
      }
      return Promise.resolve();
    }

    function edgePoint(direction, geometry) {
      const { viewportWidth: width, viewportHeight: height, targetWidth, targetHeight } = geometry;
      const left = targetWidth / 2;
      const right = width - targetWidth / 2;
      const top = targetHeight / 2;
      const bottom = height - targetHeight / 2;
      const centerX = width / 2;
      const centerY = height / 2;
      const points = {
        rightUp: { x: right, y: top },
        leftUp: { x: left, y: top },
        rightDown: { x: right, y: bottom },
        leftDown: { x: left, y: bottom },
        rightMiddle: { x: right, y: centerY },
        leftMiddle: { x: left, y: centerY },
        middleUp: { x: centerX, y: top },
        middleDown: { x: centerX, y: bottom }
      };
      return points[direction];
    }

    function gridPoint(direction, geometry) {
      const { viewportWidth: width, viewportHeight: height } = geometry;
      const xs = { left: width / 6, middle: width / 2, right: width * 5 / 6 };
      const ys = { up: height / 6, middle: height / 2, down: height * 5 / 6 };
      const points = {
        leftUp: { x: xs.left, y: ys.up },
        middleUp: { x: xs.middle, y: ys.up },
        rightUp: { x: xs.right, y: ys.up },
        leftMiddle: { x: xs.left, y: ys.middle },
        center: { x: xs.middle, y: ys.middle },
        rightMiddle: { x: xs.right, y: ys.middle },
        leftDown: { x: xs.left, y: ys.down },
        middleDown: { x: xs.middle, y: ys.down },
        rightDown: { x: xs.right, y: ys.down }
      };
      return points[direction];
    }

    function movementDurationMs(from, to, speedArcminSec, calibration, screenPixels) {
      const dxCm = (to.x - from.x) * calibration.screenWidthCm / screenPixels.width;
      const dyCm = (to.y - from.y) * calibration.screenHeightCm / screenPixels.height;
      const pathCm = Math.hypot(dxCm, dyCm);
      const cmPerArcminAtCenter = calibration.viewingDistanceCm * Math.tan(RAD_PER_ARCMIN);
      return pathCm / (speedArcminSec * cmPerArcminAtCenter) * 1000;
    }

    function makePicker(mode, sequence, evaluationRepetitions = 1, randomChoices = sequence) {
      const evaluationItems = Array.from({ length: evaluationRepetitions }, () => sequence).flat();
      const predictableStart = 0;
      let cursor = 0;
      return {
        predictableStart,
        evaluationTotal: mode === EVALUATION ? evaluationItems.length : null,
        next(currentKey = null, avoidRepeat = false) {
          if (mode === EVALUATION) return evaluationItems[cursor++];
          if (mode === PREDICTABLE) return sequence[(predictableStart + cursor++) % sequence.length];
          const candidates = avoidRepeat ? randomChoices.filter((key) => key !== currentKey) : randomChoices;
          const choices = candidates.length > 0 ? candidates : randomChoices;
          cursor += 1;
          return choices[Math.floor(Math.random() * choices.length)];
        }
      };
    }

    function buildSaccadeSequence(selectedDirs, mode) {
      const enabledDirections = [...new Set(
        selectedDirs.filter((direction) => ALL_DIRECTIONS.includes(direction))
      )];
      const availableDirections = enabledDirections.length > 0 ? enabledDirections : [...ALL_DIRECTIONS];
      const filteredSequence = SACCADE_SEQUENCE.filter((direction) => availableDirections.includes(direction));
      const baseSequence = filteredSequence.length >= 2 ? filteredSequence : availableDirections;

      // Evaluation used to finish after only four targets when just left and right
      // were enabled. Keep its fixed 24-target protocol while restricting every
      // target to the selected directions.
      if (mode !== EVALUATION) return baseSequence;
      return Array.from(
        { length: SACCADE_SEQUENCE.length },
        (_, index) => baseSequence[index % baseSequence.length]
      );
    }

    function contrastingText(hex) {
      const value = hex.replace("#", "");
      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 154 ? "#061018" : "#ffffff";
    }

    class OptionalWebGazerCameraPlugin {
      constructor(jsPsych) { this.jsPsych = jsPsych; }

      trial(displayElement, trial, onLoad) {
        const extension = this.jsPsych.extensions.webgazer;
        const startedAt = performance.now();
        let finished = false;
        let faceTimer = null;
        let onLoadSent = false;

        const signalLoad = () => {
          if (onLoadSent) return;
          onLoadSent = true;
          if (typeof onLoad === "function") onLoad();
        };

        const clean = () => {
          if (faceTimer !== null) window.clearInterval(faceTimer);
          try { extension.pause(); } catch (error) { /* Continue cleanup. */ }
          try { extension.hideVideo(); } catch (error) { /* Continue cleanup. */ }
          try { extension.hidePredictions(); } catch (error) { /* Continue cleanup. */ }
        };

        const finish = (ready, error = null) => {
          if (finished) return;
          finished = true;
          clean();
          this.jsPsych.finishTrial({
            ready,
            error,
            load_time: Math.round(performance.now() - startedAt)
          });
        };

        const showCamera = () => {
          displayElement.innerHTML = `
            <section class="app-page">
              <div class="app-shell" style="max-width:760px">
                <p class="eyebrow">WebGazer setup</p>
                <h1>Camera positioning</h1>
                <p class="lede">Keep your head still and position your face until the camera guide indicates that tracking is ready. The next screen contains the calibration points.</p>
                <div class="webgazer-camera-actions">
                  <button id="webgazer-camera-continue" class="primary-button" type="button" disabled>Continue to calibration</button>
                  <button id="webgazer-camera-skip" class="secondary-button" type="button">Continue without eye tracking</button>
                </div>
              </div>
            </section>`;
          try { extension.showVideo(); } catch (error) { finish(false, "Camera preview could not be displayed."); return; }
          try { extension.resume(); } catch (error) { finish(false, "Eye tracking could not be resumed."); return; }
          const continueButton = displayElement.querySelector("#webgazer-camera-continue");
          const skipButton = displayElement.querySelector("#webgazer-camera-skip");
          const updateFaceState = () => {
            let detected = false;
            try { detected = Boolean(extension.faceDetected()); } catch (error) { detected = false; }
            continueButton.disabled = !detected;
          };
          continueButton.addEventListener("click", () => finish(true));
          skipButton.addEventListener("click", () => finish(false, "Skipped by the user."));
          updateFaceState();
          faceTimer = window.setInterval(updateFaceState, 200);
          signalLoad();
        };

        const showFailure = (error) => {
          const message = error && error.message ? error.message : String(error || "Camera access failed.");
          displayElement.innerHTML = `
            <section class="app-page">
              <div class="app-shell" style="max-width:760px">
                <p class="eyebrow">WebGazer setup</p>
                <h1>Eye tracking unavailable</h1>
                <p class="lede">The camera could not be initialized. You can continue this training session without eye tracking.</p>
                <div class="webgazer-camera-actions">
                  <button id="webgazer-camera-fallback" class="primary-button" type="button">Continue without eye tracking</button>
                </div>
              </div>
            </section>`;
          displayElement.querySelector("#webgazer-camera-fallback").addEventListener("click", () => finish(false, message));
          signalLoad();
        };

        const start = extension && extension.isInitialized()
          ? Promise.resolve()
          : extension && typeof extension.start === "function"
            ? extension.start()
            : Promise.reject(new Error("The jsPsych WebGazer extension is unavailable."));
        Promise.resolve(start).then(showCamera).catch(showFailure);
      }
    }

    OptionalWebGazerCameraPlugin.info = {
      name: "optional-webgazer-camera",
      version: "1.0.0",
      parameters: {},
      data: {
        ready: { type: ParameterType.BOOL },
        error: { type: ParameterType.STRING },
        load_time: { type: ParameterType.INT }
      }
    };

    class GazeValidationPlugin {
      constructor(jsPsych) { this.jsPsych = jsPsych; }

      trial(displayElement, trial, onLoad) {
        if (typeof onLoad === "function") onLoad();
        const activeSource = (AppState.pending && AppState.pending.eyeTrackingSource) || AppState.eyeTracking.source;
        const isWebGazer = activeSource === EYE_SOURCE_WEBGAZER;
        const extension = this.jsPsych.extensions && this.jsPsych.extensions.webgazer;
        const calibration = AppState.calibration || { screenWidthCm: 50, screenHeightCm: 28, viewingDistanceCm: 60 };
        const screenPixels = currentScreenPixels();
        const cmPerPxX = calibration.screenWidthCm / screenPixels.width;
        const cmPerPxY = calibration.screenHeightCm / screenPixels.height;
        const viewingDist = calibration.viewingDistanceCm;

        if (isWebGazer) {
          try {
            if (extension) {
              extension.hideVideo();
              extension.hidePredictions();
              extension.resume();
            }
          } catch (e) {}
        }

        const validationPoints = [
          { xRatio: 0.50, yRatio: 0.50, label: "Center" },
          { xRatio: 0.20, yRatio: 0.20, label: "Top-Left" },
          { xRatio: 0.80, yRatio: 0.20, label: "Top-Right" },
          { xRatio: 0.20, yRatio: 0.80, label: "Bottom-Left" },
          { xRatio: 0.80, yRatio: 0.80, label: "Bottom-Right" }
        ];

        let pointIndex = 0;
        let pointResults = [];
        let currentSamples = [];
        let pointTimer = null;
        let isCollecting = false;
        let countdownInterval = null;
        let ended = false;
        let rafId = null;

        let unsubscribe = null;
        if (isWebGazer && extension && typeof extension.onGazeUpdate === "function") {
          unsubscribe = extension.onGazeUpdate((prediction) => {
            if (ended || !isCollecting) return;
            if (prediction && Number.isFinite(prediction.x) && Number.isFinite(prediction.y)) {
              currentSamples.push({ x: prediction.x, y: prediction.y });
            }
          });
        }

        const pollGaze = async () => {
          if (ended) return;
          if (isWebGazer && isCollecting && window.webgazer) {
            try {
              const pred = await window.webgazer.getCurrentPrediction();
              if (pred && Number.isFinite(pred.x) && Number.isFinite(pred.y)) {
                currentSamples.push({ x: pred.x, y: pred.y });
              }
            } catch (e) {}
          }
          if (!ended) rafId = requestAnimationFrame(pollGaze);
        };
        if (isWebGazer) {
          rafId = requestAnimationFrame(pollGaze);
        }

        const cleanUp = () => {
          ended = true;
          if (pointTimer !== null) clearTimeout(pointTimer);
          if (countdownInterval !== null) clearInterval(countdownInterval);
          if (rafId !== null) cancelAnimationFrame(rafId);
          if (unsubscribe) {
            try { unsubscribe(); } catch (e) {}
            unsubscribe = null;
          }
          document.removeEventListener("keydown", onKeyDown);
        };

        const onKeyDown = (e) => {
          if (e.key === "Escape") {
            cleanUp();
            void exitFullscreenSafely();
            AppState.pending = null;
            AppState.eyeTracking.needsRecalibration = false;
            this.jsPsych.finishTrial({ action: "validation_aborted", aborted: true });
            window.parent.postMessage({ type: "oculomotor:abort" }, window.location.origin);
          }
        };
        document.addEventListener("keydown", onKeyDown);

        const runPoint = (idx) => {
          if (idx >= validationPoints.length) {
            showResults();
            return;
          }
          pointIndex = idx;
          currentSamples = [];
          isCollecting = false;
          const pt = validationPoints[idx];
          const tx = Math.round(window.innerWidth * pt.xRatio);
          const ty = Math.round(window.innerHeight * pt.yRatio);

          displayElement.innerHTML = `
            <div id="webgazer-validate-container">
              <div class="webgazer-validate-instruction">
                Gaze Accuracy Validation: Look directly at the target (${idx + 1} / 5)
              </div>
              <div class="webgazer-validate-target" style="left: ${tx}px; top: ${ty}px;">
                <div class="webgazer-validate-target-inner"></div>
              </div>
            </div>`;

          pointTimer = setTimeout(() => {
            isCollecting = true;
            pointTimer = setTimeout(() => {
              isCollecting = false;
              if (currentSamples.length > 0) {
                const xs = currentSamples.map((s) => s.x).sort((a, b) => a - b);
                const ys = currentSamples.map((s) => s.y).sort((a, b) => a - b);
                const medX = xs[Math.floor(xs.length / 2)];
                const medY = ys[Math.floor(ys.length / 2)];
                const distPx = Math.hypot(medX - tx, medY - ty);
                const dxCm = Math.abs(medX - tx) * cmPerPxX;
                const dyCm = Math.abs(medY - ty) * cmPerPxY;
                const dCm = Math.hypot(dxCm, dyCm);
                const distDeg = 2 * Math.atan(dCm / (2 * viewingDist)) * (180 / Math.PI);
                pointResults.push({
                  label: pt.label,
                  tx,
                  ty,
                  medX,
                  medY,
                  distPx: round(distPx, 1),
                  distDeg: round(distDeg, 2),
                  sampleCount: currentSamples.length
                });
              } else {
                pointResults.push({
                  label: pt.label,
                  tx,
                  ty,
                  medX: null,
                  medY: null,
                  distPx: null,
                  distDeg: 9.9,
                  sampleCount: 0
                });
              }
              runPoint(idx + 1);
            }, 1050);
          }, 350);
        };

        const showResults = () => {
          cleanUp();
          const validPoints = pointResults.filter((p) => p.sampleCount >= 3);
          const meanErrorDeg = validPoints.length > 0
            ? round(validPoints.reduce((sum, p) => sum + p.distDeg, 0) / validPoints.length, 2)
            : 9.99;
          const PASS_THRESHOLD_DEG = 3.5;
          const passed = validPoints.length >= 3 && meanErrorDeg <= PASS_THRESHOLD_DEG;
          const dynamicThresholdDeg = round(Math.max(0.5, meanErrorDeg * 2), 2);
          const dynamicThresholdArcmin = round(dynamicThresholdDeg * 60, 1);

          const isCalibrateOnly = Boolean(AppState.pending && AppState.pending.calibrateOnly);
          const sourceName = "WebGazer";

          let actionButtonsHtml = "";
          let noticeHtml = "";

          if (isCalibrateOnly) {
            if (passed) {
              noticeHtml = `<p style="color:var(--lime, #63e6ff); font-size:14px; margin-bottom:18px;">Validation passed. Gaze tracking precision verified and ready.</p>`;
              actionButtonsHtml = `
                <button class="primary-button" type="button" data-val-action="done">Complete & Return to Menu</button>
                <button class="secondary-button" type="button" data-val-action="recalib">Recalibrate</button>`;
            } else {
              noticeHtml = `<p style="color:#f87171; font-size:14px; margin-bottom:18px;">Average angular error (${meanErrorDeg}°) exceeds target threshold (${PASS_THRESHOLD_DEG}°). Recalibration is recommended.</p>`;
              actionButtonsHtml = `
                <button class="primary-button" type="button" data-val-action="recalib">Recalibrate</button>
                <button class="secondary-button" type="button" data-val-action="done">Skip & Return to Menu</button>`;
            }
          } else {
            if (passed) {
              noticeHtml = `<p style="color:var(--lime, #63e6ff); font-size:14px; margin-bottom:18px;">Validation passed. Dynamic hit threshold set to 2× angular error (${dynamicThresholdDeg}°). Starting training...</p>`;
              actionButtonsHtml = `
                <button class="primary-button" type="button" data-val-action="proceed">Start Training (<span id="val-cd-num">3</span>s)</button>
                <button class="secondary-button" type="button" data-val-action="recalib">Recalibrate</button>`;
            } else {
              noticeHtml = `<p style="color:#f87171; font-size:14px; margin-bottom:18px;">Validation error higher than recommended (${meanErrorDeg}° > ${PASS_THRESHOLD_DEG}°). You may re-validate or proceed with the measured threshold.</p>`;
              actionButtonsHtml = `
                <button class="primary-button" type="button" data-val-action="recalib">Recalibrate</button>
                <button class="secondary-button" type="button" data-val-action="proceed">Proceed Anyway</button>`;
            }
          }

          displayElement.innerHTML = `
            <div id="webgazer-validate-container">
              <div class="webgazer-validate-card">
                <p class="eyebrow" style="color:var(--cyan, #63e6ff); text-transform:uppercase; font-size:12px; font-weight:700; letter-spacing:0.08em; margin-bottom:6px;">${sourceName} Validation</p>
                <h2>Gaze Tracking Accuracy</h2>
                <p style="margin-bottom:16px;">5-point fixation accuracy assessment completed:</p>
                ${noticeHtml}
                <div class="webgazer-validate-stat-grid">
                  <div class="webgazer-validate-stat-item">
                    <span class="webgazer-validate-stat-label">Mean Angular Error</span>
                    <span class="webgazer-validate-stat-value ${passed ? "pass" : "fail"}">${meanErrorDeg}°</span>
                  </div>
                  <div class="webgazer-validate-stat-item">
                    <span class="webgazer-validate-stat-label">Dynamic Hit Threshold (2× Error)</span>
                    <span class="webgazer-validate-stat-value pass">${dynamicThresholdDeg}° (${dynamicThresholdArcmin}')</span>
                  </div>
                  <div class="webgazer-validate-stat-item">
                    <span class="webgazer-validate-stat-label">Accuracy Status</span>
                    <span class="webgazer-validate-stat-value ${passed ? "pass" : "fail"}">${passed ? "Passed" : "Needs Attention"}</span>
                  </div>
                </div>

                <div style="font-size:13px; color:var(--muted, #94a3b8); margin-bottom:24px; background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.06);">
                  <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span>Center: <strong>${pointResults[0] ? pointResults[0].distDeg + "°" : "-"}</strong></span>
                    <span>Top-Left: <strong>${pointResults[1] ? pointResults[1].distDeg + "°" : "-"}</strong></span>
                    <span>Top-Right: <strong>${pointResults[2] ? pointResults[2].distDeg + "°" : "-"}</strong></span>
                  </div>
                  <div style="display:flex; justify-content:space-between; padding:4px 0;">
                    <span>Bottom-Left: <strong>${pointResults[3] ? pointResults[3].distDeg + "°" : "-"}</strong></span>
                    <span>Bottom-Right: <strong>${pointResults[4] ? pointResults[4].distDeg + "°" : "-"}</strong></span>
                    <span></span>
                  </div>
                </div>

                <div class="webgazer-validate-actions">
                  ${actionButtonsHtml}
                </div>
              </div>
            </div>`;

          const doneBtn = displayElement.querySelector("[data-val-action='done']");
          const proceedBtn = displayElement.querySelector("[data-val-action='proceed']");
          const recalibBtn = displayElement.querySelector("[data-val-action='recalib']");

          const finishSuccess = async (action) => {
            if (countdownInterval !== null) clearInterval(countdownInterval);
            AppState.eyeTracking.calibrated = true;
            AppState.eyeTracking.needsRecalibration = false;
            AppState.eyeTracking.calibrationRequested = false;
            AppState.eyeTracking.calibratedAt = AppState.eyeTracking.calibratedAt || new Date().toISOString();
            AppState.eyeTracking.calibrationViewport = currentViewportSignature();
            AppState.eyeTracking.lastValidation = {
              source: activeSource,
              meanErrorDeg,
              dynamicThresholdDeg,
              passed,
              timestamp: new Date().toISOString()
            };
            if (isCalibrateOnly) {
              AppState.pending = null;
              await exitFullscreenSafely();
            }
            this.jsPsych.finishTrial({
              action,
              passed,
              mean_error_deg: meanErrorDeg,
              dynamic_threshold_deg: dynamicThresholdDeg,
              point_results: pointResults
            });
          };

          const requestRecalibration = () => {
            if (countdownInterval !== null) clearInterval(countdownInterval);
            AppState.eyeTracking.calibrated = false;
            AppState.eyeTracking.needsRecalibration = true;
            AppState.eyeTracking.calibrationRequested = true;
            this.jsPsych.finishTrial({
              action: "recalibration_requested",
              passed,
              mean_error_deg: meanErrorDeg,
              dynamic_threshold_deg: dynamicThresholdDeg,
              point_results: pointResults
            });
          };

          if (doneBtn) doneBtn.addEventListener("click", () => finishSuccess("validation_done"));
          if (proceedBtn) proceedBtn.addEventListener("click", () => finishSuccess("validation_proceed"));
          if (recalibBtn) recalibBtn.addEventListener("click", requestRecalibration);

          if (!isCalibrateOnly && passed) {
            let remainSec = 3;
            countdownInterval = setInterval(() => {
              remainSec -= 1;
              const cdNum = displayElement.querySelector("#val-cd-num");
              if (cdNum) cdNum.textContent = String(remainSec);
              if (remainSec <= 0) {
                clearInterval(countdownInterval);
                finishSuccess("validation_auto_proceed");
              }
            }, 1000);
          }
        };

        runPoint(0);
      }
    }

    GazeValidationPlugin.info = {
      name: "gaze-validation",
      version: "1.0.0",
      parameters: {},
      data: {
        action: { type: ParameterType.STRING },
        passed: { type: ParameterType.BOOL },
        mean_error_deg: { type: ParameterType.FLOAT },
        dynamic_threshold_deg: { type: ParameterType.FLOAT }
      }
    };

    const WebGazerValidationPlugin = GazeValidationPlugin;

    const DIRECTION_ENGLISH_LABELS = {
      rightUp: "Top-Right",
      leftUp: "Top-Left",
      rightDown: "Bottom-Right",
      leftDown: "Bottom-Left",
      middleUp: "Up",
      middleDown: "Down",
      leftMiddle: "Left",
      rightMiddle: "Right",
      center: "Center"
    };
    const DIRECTION_CHINESE_LABELS = DIRECTION_ENGLISH_LABELS;

    function csvEscape(value) {
      if (value === null || value === undefined) return '""';
      const str = String(value);
      return `"${str.replace(/"/g, '""')}"`;
    }

    function triggerFileDownload(filename, textContent) {
      try {
        const blob = new Blob(["\uFEFF" + textContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (link.parentNode) link.parentNode.removeChild(link);
          URL.revokeObjectURL(url);
        }, 1500);
      } catch (error) {
        console.error("Failed to download CSV:", error);
      }
    }

    function exportTrialCsvs(trialData) {
      const {
        sessionId,
        subjectId,
        moduleKey,
        settings,
        calibration,
        screenPixels,
        geometry,
        ballArcmin,
        ballArcsec,
        targetSize,
        stimulusType,
        selectedDirs,
        isTimed,
        sessionStart,
        endedAt,
        reason,
        completedTargets,
        normalFrameMedian,
        eyeTrackingSource,
        gazeCapture: inputGazeCapture
      } = trialData;

      const gazeCapture = inputGazeCapture || {};

      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      const timeStr = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      const isoDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const isoTime = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      const moduleCode = (MODULES[moduleKey] && MODULES[moduleKey].code) ? MODULES[moduleKey].code : moduleKey.toUpperCase();
      const moduleName = (MODULES[moduleKey] && MODULES[moduleKey].name) || moduleKey;

      const thresholdDeg = trialData.thresholdDeg !== undefined
        ? trialData.thresholdDeg
        : round((Number(settings.distanceThresholdArcmin) || 90) / 60, 2);
      const thresholdArcmin = trialData.thresholdArcmin !== undefined
        ? trialData.thresholdArcmin
        : round(thresholdDeg * 60, 2);
      const thresholdPx = trialData.thresholdPx !== undefined
        ? trialData.thresholdPx
        : round((thresholdArcmin / ballArcmin) * (geometry.targetWidth / 2), 1);
      const actualDurationMs = sessionStart === null ? 0 : endedAt - sessionStart;

      const totalValidMs = gazeCapture.totalValidMs || 0;
      const totalInThreshMs = gazeCapture.totalInThreshMs || 0;
      const totalBlinkMs = gazeCapture.totalBlinkMs || 0;
      const accuracyRate = gazeCapture.accuracyRate !== undefined ? gazeCapture.accuracyRate : 0;
      const records = gazeCapture.synchronousRecords || [];

      const deviceName = eyeTrackingSource === EYE_SOURCE_WEBGAZER ? "WebGazer (Webcam Eye Tracking)" : "None (Untracked)";

      const samplingRateText = eyeTrackingSource === EYE_SOURCE_WEBGAZER ? "~30 Hz (Dynamic Webcam Sampling)" : "N/A";

      const sourceTag = eyeTrackingSource === EYE_SOURCE_WEBGAZER ? "WebGazer" : "Untracked";

      // File name: {SubjectID}_{Date8}_{Time6}_{ModuleCode}_{TrackerType}_gaze_record.csv
      const csvFilename = `${subjectId || "SUBJ"}_${dateStr}_${timeStr}_${moduleCode}_${sourceTag}_gaze_record.csv`;

      const selectedDirectionLabels = (selectedDirs || []).map(
        (dirKey) => DIRECTION_ENGLISH_LABELS[dirKey] || dirKey
      );

      // Metadata Headers
      const metaLines = [
        `# -- Oculomotor Practice Session Record --`,
        `# Subject ID: ${subjectId || "-"}`,
        `# Session ID: ${sessionId}`,
        `# Test Date: ${isoDate}`,
        `# Test Time: ${isoTime}`,
        `# Training Module: ${moduleName} (${moduleCode})`,
        `# Test Mode: ${settings.mode === EVALUATION ? "Evaluation" : settings.mode === RANDOM ? "Random" : "Predictable"}`,
        `# Display Physical Width: ${round(calibration.screenWidthCm, 2)} cm`,
        `# Display Physical Height: ${round(calibration.screenHeightCm, 2)} cm`,
        `# Screen Resolution: ${screenPixels.width} x ${screenPixels.height} px`,
        `# Viewing Distance: ${round(calibration.viewingDistanceCm, 2)} cm`,
        `# Stimulus Type: ${(STIMULUS_TYPES[stimulusType] && STIMULUS_TYPES[stimulusType].name) || stimulusType}`,
        `# Stimulus Size: ${round(ballArcmin, 2)} arcmin (${(ballArcmin / 60).toFixed(2)} deg)`,
        `# Movement Speed: ${settings.speedArcminSec ? settings.speedArcminSec + " arcmin/s" : "N/A"}`,
        `# Hit Distance Threshold: ${thresholdDeg} deg (${thresholdArcmin} arcmin / approx. ${thresholdPx} px screen radius)`,
        `# Total Test Duration: ${(actualDurationMs / 1000).toFixed(2)} s`,
        `# Valid Gaze Duration (Denominator): ${(totalValidMs / 1000).toFixed(2)} s`,
        `# Blink Duration (Excluded): ${(totalBlinkMs / 1000).toFixed(2)} s`,
        `# On-Target Duration (Numerator): ${(totalInThreshMs / 1000).toFixed(2)} s`,
        `# Gaze Accuracy Rate: ${accuracyRate} %`,
        `# Enabled Directions: ${selectedDirectionLabels.join(", ") || "All"}`,
        `# Completed Targets: ${completedTargets}`,
        `# Test Termination Reason: ${reason}`,
        `# Eye Tracker Hardware: ${deviceName}`,
        `# Sampling Frequency: ${samplingRateText}`,
        `# Total Gaze Samples: ${records.length}`,
        `# ------------------------------------------------------------`
      ];

      const tableHeaders = [
        "sample_index",
        "trial_time_ms",
        "device_timestamp_us",
        "delta_t_ms",
        "instant_hz",
        "gaze_valid",
        "gaze_x_px",
        "gaze_y_px",
        "stimulus_x_px",
        "stimulus_y_px",
        "distance_error_px",
        "distance_error_deg",
        "is_within_threshold",
        "phase",
        "direction"
      ];

      const rowLines = records.map(r => [
        r.sample_index,
        r.trial_time_ms,
        r.device_timestamp_us,
        r.delta_t_ms,
        r.instant_hz,
        r.gaze_valid,
        r.gaze_x_px,
        r.gaze_y_px,
        r.stimulus_x_px,
        r.stimulus_y_px,
        r.distance_error_px,
        r.distance_error_deg,
        r.is_within_threshold,
        csvEscape(r.phase),
        csvEscape(DIRECTION_ENGLISH_LABELS[r.direction] || r.direction)
      ].join(","));

      const fullCsvContent = [
        ...metaLines,
        tableHeaders.join(","),
        ...rowLines
      ].join("\r\n");

      triggerFileDownload(csvFilename, fullCsvContent);
    }

    class EyeTrainingPlugin {
      constructor(jsPsych) { this.jsPsych = jsPsych; }

      trial(displayElement, trial) {
        const moduleKey = trial.module;
        const settings = trial.settings;
        const calibration = trial.calibration;
        const eyeTracking = trial.eye_tracking || { source: EYE_SOURCE_OFF, enabled: false, calibrated: false, calibratedAt: null };
        const module = MODULES[moduleKey];
        const isTimed = moduleKey === "vor" || settings.mode !== EVALUATION;
        const plannedDurationMs = isTimed ? settings.totalSec * 1000 : null;
        const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const usesWebGazer = eyeTracking.source === EYE_SOURCE_WEBGAZER;
        const usesGazeTracking = usesWebGazer;
        let activeTrialCapture = usesWebGazer ? beginWebGazerTrial(sessionId) : null;

        let unsubscribeWebgazer = null;
        if (usesWebGazer) {
          try { if (window.webgazer) window.webgazer.resume(); } catch (e) {}
          const extension = this.jsPsych.extensions && this.jsPsych.extensions.webgazer;
          if (extension) {
            if (!extension.__handleGazeDataUpdateWrapped) {
              const origHandle = extension.handleGazeDataUpdate;
              extension.handleGazeDataUpdate = function(e, i) {
                origHandle.call(extension, e, i);
                if (e === null && extension.gazeUpdateCallbacks) {
                  for (var a = 0; a < extension.gazeUpdateCallbacks.length; a++) {
                    try { extension.gazeUpdateCallbacks[a](null); } catch (err) {}
                  }
                }
              };
              extension.__handleGazeDataUpdateWrapped = true;
            }

            if (typeof extension.onGazeUpdate === "function") {
              unsubscribeWebgazer = extension.onGazeUpdate((prediction) => {
                if (ended || sessionStart === null || !activeTrialCapture || !activeTrialCapture.onSample) return;
                const nowUs = Math.round(performance.now() * 1000);
                if (prediction && Number.isFinite(prediction.x) && Number.isFinite(prediction.y)) {
                  activeTrialCapture.onSample({
                    valid: true,
                    x: prediction.x,
                    y: prediction.y,
                    device_timestamp_us: nowUs
                  });
                } else {
                  activeTrialCapture.onSample({
                    valid: false,
                    x: null,
                    y: null,
                    device_timestamp_us: nowUs
                  });
                }
              });
            }
          }
        }
        const screenPixels = currentScreenPixels();
        const stimulusType = moduleKey === "vor" ? "numbers_dot" : (settings.stimulusType || "white_dot");
        const selectedDirs = (Array.isArray(settings.directions) && settings.directions.length > 0)
          ? settings.directions
          : [...ALL_DIRECTIONS];
        const ballArcsec = Number(settings.ballArcsec) || (settings.ballArcmin ? settings.ballArcmin * 60 : 3600);
        const ballArcmin = ballArcsec / 60;

        let ended = false;
        let finishSent = false;
        let sessionStart = null;
        let deadline = null;
        let rafId = null;
        let frameCount = 0;
        let lastFrameAt = null;
        let maxFrameGapMs = 0;
        let completedTargets = 0;
        let currentDirection = null;
        let phase = "idle";
        let viewportSettlesAt = null;
        const sampledFrameGaps = [];
        const events = [];
        const frameCoordinates = [];

        displayElement.innerHTML = `
          <section id="training-stage" class="training-stage" role="application" aria-label="${module.code} ${module.name} training in progress">
            <div id="training-stimulus" class="stimulus"><span id="stimulus-number" class="stimulus-number"></span></div>
            <span class="sr-only">Training has started. Press Escape to stop.</span>
          </section>`;

        const stage = displayElement.querySelector("#training-stage");
        const stimulus = displayElement.querySelector("#training-stimulus");
        const number = displayElement.querySelector("#stimulus-number");
        const readStageViewport = () => {
          const bounds = stage.getBoundingClientRect();
          return {
            width: bounds.width || window.innerWidth,
            height: bounds.height || window.innerHeight
          };
        };
        const initialViewport = readStageViewport();
        const targetSize = stimulusPixels(ballArcmin, calibration, screenPixels);
        const geometry = {
          viewportWidth: initialViewport.width,
          viewportHeight: initialViewport.height,
          targetWidth: targetSize.width,
          targetHeight: targetSize.height
        };
        const center = { x: geometry.viewportWidth / 2, y: geometry.viewportHeight / 2 };
        const currentCenter = { x: center.x, y: center.y };

        let saccadeOnsetMs = null;
        let thresholdDeg;
        let thresholdArcmin;
        if (usesGazeTracking && AppState.eyeTracking.lastValidation?.dynamicThresholdDeg) {
          thresholdDeg = AppState.eyeTracking.lastValidation.dynamicThresholdDeg;
          thresholdArcmin = round(thresholdDeg * 60, 2);
        } else {
          thresholdArcmin = Number(settings.distanceThresholdArcmin) || 90;
          thresholdDeg = round(thresholdArcmin / 60, 2);
        }
        const thresholdRadiusPx = (thresholdArcmin / ballArcmin) * (geometry.targetWidth / 2);
        const pxPerDeg = (geometry.targetWidth / ballArcmin) * 60;

        if (activeTrialCapture) {
          activeTrialCapture.onSample = (sample) => {
            if (ended || sessionStart === null) return;
            const nowPerf = performance.now();
            const active = activeTrialCapture;
            if (!active) return;

            const currentTsUs = sample.device_timestamp_us || (Math.round(sample.browser_received_unix_ms * 1000));
            let deltaMs = 30.3;
            if (active.lastSampleTsUs !== null && currentTsUs > active.lastSampleTsUs) {
              deltaMs = (currentTsUs - active.lastSampleTsUs) / 1000;
            }
            active.lastSampleTsUs = currentTsUs;

            // Frame loss protection (intervals > 100ms clamped to nominal 30.3ms)
            const effectiveDeltaMs = deltaMs > 100 ? 30.3 : deltaMs;

            // Saccade 200ms physiological latency grace window
            let isSaccadeLatency = false;
            if (moduleKey === "saccade" && phase === "dwell" && saccadeOnsetMs !== null) {
              if (nowPerf - saccadeOnsetMs < 200) {
                isSaccadeLatency = true;
              }
            }

            let isWithin = 0;
            let distPx = null;
            let distDeg = null;

            if (!sample.valid) {
              active.totalBlinkMs += effectiveDeltaMs;
            } else {
              distPx = Math.hypot(sample.x - currentCenter.x, sample.y - currentCenter.y);
              distDeg = pxPerDeg > 0 ? (distPx / pxPerDeg) : 0;

              if (!isSaccadeLatency) {
                active.totalValidMs += effectiveDeltaMs;
                if (distPx <= thresholdRadiusPx) {
                  isWithin = 1;
                  active.totalInThreshMs += effectiveDeltaMs;
                }
              }
            }

            active.synchronousRecords.push({
              sample_index: active.synchronousRecords.length + 1,
              trial_time_ms: round(nowPerf - sessionStart, 2),
              device_timestamp_us: currentTsUs,
              delta_t_ms: round(deltaMs, 2),
              instant_hz: deltaMs > 0 ? round(1000 / deltaMs, 1) : 33.0,
              gaze_valid: sample.valid ? 1 : 0,
              gaze_x_px: sample.valid ? round(sample.x, 2) : "",
              gaze_y_px: sample.valid ? round(sample.y, 2) : "",
              stimulus_x_px: round(currentCenter.x, 2),
              stimulus_y_px: round(currentCenter.y, 2),
              distance_error_px: distPx !== null ? round(distPx, 2) : "",
              distance_error_deg: distDeg !== null ? round(distDeg, 3) : "",
              is_within_threshold: isWithin,
              phase: isSaccadeLatency ? "saccade_latency" : phase,
              direction: currentDirection || currentGridKey || "center"
            });
          };
        }

        stimulus.style.width = `${geometry.targetWidth}px`;
        stimulus.style.height = `${geometry.targetHeight}px`;
        stimulus.style.setProperty("--cross-thickness", `${Math.max(1.5, Math.min(geometry.targetWidth, geometry.targetHeight) * 0.085)}px`);
        number.style.fontSize = `${Math.max(1, Math.min(geometry.targetWidth, geometry.targetHeight) * 0.55)}px`;

        const logEvent = (event, now, detail = {}) => {
          events.push({ event, actual_ms: sessionStart === null ? 0 : round(now - sessionStart, 3), ...detail });
        };

        const setPosition = (point) => {
          currentCenter.x = point.x;
          currentCenter.y = point.y;
          const x = point.x - geometry.targetWidth / 2;
          const y = point.y - geometry.targetHeight / 2;
          stimulus.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        };

        const refreshViewportGeometry = () => {
          const nextViewport = readStageViewport();
          geometry.viewportWidth = nextViewport.width;
          geometry.viewportHeight = nextViewport.height;
          center.x = nextViewport.width / 2;
          center.y = nextViewport.height / 2;
          if (phase === "idle" || phase === "cross" || moduleKey === "vor") {
            setPosition(center);
          }
        };

        const showCross = () => {
          stimulus.className = "stimulus is-cross";
          stimulus.style.removeProperty("--ball-color");
          number.textContent = "";
          setPosition(center);
        };

        const showWhiteDot = () => {
          stimulus.className = "stimulus is-ball";
          stimulus.style.setProperty("--ball-color", "#ffffff");
          number.textContent = "";
        };

        const showRedInWhite = () => {
          stimulus.className = "stimulus is-ball is-red-in-white";
          stimulus.style.setProperty("--ball-color", "#ffffff");
          number.textContent = "";
        };

        const showNumbersDot = (color, digit) => {
          stimulus.className = "stimulus is-ball";
          stimulus.style.setProperty("--ball-color", color);
          number.style.setProperty("--number-color", contrastingText(color));
          number.textContent = String(digit);
        };

        let currentDynamicColor = null;
        let currentDynamicDigit = null;
        let lastDynamicNumberTime = -1;
        const dynamicNumberInterval = settings.changeMs || 500;

        const updateDynamicNumber = (now, force = false) => {
          if (force || lastDynamicNumberTime < 0 || now - lastDynamicNumberTime >= dynamicNumberInterval) {
            let color;
            let digit;
            do color = VOR_COLORS[Math.floor(Math.random() * VOR_COLORS.length)]; while (color === currentDynamicColor);
            do digit = Math.floor(Math.random() * 10); while (digit === currentDynamicDigit);
            currentDynamicColor = color;
            currentDynamicDigit = digit;
            lastDynamicNumberTime = now;
            showNumbersDot(color, digit);
          }
        };

        const showActiveStimulus = (now, forceNewNumber = false) => {
          if (stimulusType === "red_in_white") {
            showRedInWhite();
          } else if (stimulusType === "numbers_dot") {
            updateDynamicNumber(now, forceNewNumber);
          } else {
            showWhiteDot();
          }
        };

        const geometryIsValid = () => {
          if (!Number.isFinite(geometry.targetWidth) || !Number.isFinite(geometry.targetHeight)) return false;
          if (geometry.targetWidth >= geometry.viewportWidth || geometry.targetHeight >= geometry.viewportHeight) return false;
          if (moduleKey === "saccade" && (geometry.targetWidth > geometry.viewportWidth / 3 || geometry.targetHeight > geometry.viewportHeight / 3)) return false;
          return true;
        };

        const onVisibilityChange = () => {
          if (document.visibilityState === "hidden") endTrial("visibility_hidden");
        };

        const onFullscreenChange = () => {
          if (trial.fullscreen_entered && !fullscreenElement() && !ended) endTrial("fullscreen_exit");
        };

        const onViewportChange = () => {
          const now = performance.now();
          if (sessionStart === null || (viewportSettlesAt !== null && now < viewportSettlesAt)) {
            refreshViewportGeometry();
            return;
          }
          const nextViewport = readStageViewport();
          const widthChanged = Math.abs(nextViewport.width - geometry.viewportWidth) > 1;
          const heightChanged = Math.abs(nextViewport.height - geometry.viewportHeight) > 1;
          if ((widthChanged || heightChanged) && !ended) endTrial("viewport_changed");
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        document.addEventListener("fullscreenchange", onFullscreenChange);
        document.addEventListener("webkitfullscreenchange", onFullscreenChange);
        window.addEventListener("resize", onViewportChange);
        window.addEventListener("orientationchange", onViewportChange);
        if (window.visualViewport) window.visualViewport.addEventListener("resize", onViewportChange);

        const keyboardListener = this.jsPsych.pluginAPI.getKeyboardResponse({
          callback_function: () => endTrial("escape"),
          valid_responses: ["Escape"],
          rt_method: "performance",
          persist: false,
          allow_held_key: false
        });

        const median = (values) => {
          if (!values.length) return null;
          const sorted = [...values].sort((a, b) => a - b);
          const middle = Math.floor(sorted.length / 2);
          return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
        };

        const finish = (data) => {
          if (finishSent) return;
          finishSent = true;
          this.jsPsych.finishTrial(data);
          void exitFullscreenSafely();
        };

        const endTrial = (reason) => {
          if (ended) return;
          ended = true;
          const endedAt = performance.now();
          if (rafId !== null) cancelAnimationFrame(rafId);
          this.jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
          this.jsPsych.pluginAPI.clearAllTimeouts();
          document.removeEventListener("visibilitychange", onVisibilityChange);
          document.removeEventListener("fullscreenchange", onFullscreenChange);
          document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
          window.removeEventListener("resize", onViewportChange);
          window.removeEventListener("orientationchange", onViewportChange);
          if (window.visualViewport) window.visualViewport.removeEventListener("resize", onViewportChange);
          if (unsubscribeWebgazer) {
            try { unsubscribeWebgazer(); } catch (e) {}
            unsubscribeWebgazer = null;
          }
          if (usesWebGazer && window.webgazer) {
            try { window.webgazer.pause(); } catch (e) {}
          }
          const gazeCapture = usesWebGazer
            ? finishWebGazerTrial(sessionId)
            : { samples: [], downsampled: 0, overflow: 0, synchronousRecords: [], totalBlinkMs: 0, totalValidMs: 0, totalInThreshMs: 0, accuracyRate: 0 };
          const normalFrameMedian = median(sampledFrameGaps.filter((gap) => gap > 4 && gap < 100));

          // Automatically export synchronous CSV record
          exportTrialCsvs({
            sessionId,
            subjectId,
            moduleKey,
            settings,
            calibration,
            screenPixels,
            geometry,
            ballArcmin,
            ballArcsec,
            targetSize,
            stimulusType,
            selectedDirs,
            isTimed,
            sessionStart,
            endedAt,
            reason,
            completedTargets,
            frameCoordinates,
            normalFrameMedian,
            eyeTrackingSource: eyeTracking.source,
            thresholdDeg,
            thresholdArcmin,
            thresholdPx: round(thresholdRadiusPx, 1),
            gazeCapture
          });

          const data = {
            session_id: sessionId,
            module: moduleKey,
            mode: moduleKey === "vor" ? "continuous" : settings.mode,
            settings: { ...settings },
            calibration: { ...calibration },
            end_reason: reason,
            completed_targets: completedTargets,
            actual_duration_ms: round(sessionStart === null ? 0 : endedAt - sessionStart, 3),
            accuracy_rate: gazeCapture.accuracyRate,
            in_threshold_sec: round((gazeCapture.totalInThreshMs || 0) / 1000, 2),
            valid_sec: round((gazeCapture.totalValidMs || 0) / 1000, 2),
            blink_sec: round((gazeCapture.totalBlinkMs || 0) / 1000, 2),
            threshold_deg: thresholdDeg,
            threshold_arcmin: thresholdArcmin,
            planned_duration_ms: plannedDurationMs,
            fullscreen_entered: Boolean(trial.fullscreen_entered),
            eye_tracking: {
              source: eyeTracking.source || EYE_SOURCE_OFF,
              enabled: eyeTracking.source !== EYE_SOURCE_OFF,
              calibrated: Boolean(eyeTracking.calibrated),
              calibrated_at: eyeTracking.calibratedAt || null,
              library: usesWebGazer ? "WebGazer via jsPsych extension-webgazer" : null,
              provider: usesWebGazer ? "WebGazer" : null,
              provider_mode: usesWebGazer ? "webcam" : null,
              sampling_interval_ms: usesWebGazer ? 34 : null
            },
            gaze_path: JSON.stringify(gazeCapture.samples || []),
            gaze_records: gazeCapture.synchronousRecords || [],
            gaze_sample_count: (gazeCapture.synchronousRecords || []).length,
            gaze_downsampled_count: gazeCapture.downsampled || 0,
            gaze_overflow_count: gazeCapture.overflow || 0,
            viewport: { width: geometry.viewportWidth, height: geometry.viewportHeight },
            stimulus: {
              arcsec: ballArcsec,
              arcmin: round(ballArcmin, 2),
              type: stimulusType,
              selected_directions: selectedDirs,
              width_px: round(geometry.targetWidth, 4),
              height_px: round(geometry.targetHeight, 4),
              diameter_cm: round(targetSize.diameterCm, 6)
            },
            timing: {
              clock: "performance.now",
              animation: "requestAnimationFrame",
              frame_count: frameCount,
              median_frame_gap_ms: normalFrameMedian === null ? null : round(normalFrameMedian, 3),
              max_frame_gap_ms: round(maxFrameGapMs, 3),
              estimated_refresh_hz: normalFrameMedian ? round(1000 / normalFrameMedian, 2) : null
            },
            predictable_start_index: picker && picker.predictableStart !== undefined ? picker.predictableStart : null,
            event_log: events,
            interaction_log: [...AppState.interactions],
            ended_at: new Date().toISOString()
          };
          finish(data);
        };

        let picker = null;
        let phaseStart = 0;
        let phaseEnd = 0;
        let arrivalFrame = -1;
        let movementFrom = null;
        let movementTo = null;
        let movementDuration = 0;
        let vorIndex = -1;
        let lastVorColor = null;
        let lastVorDigit = null;
        let currentGridKey = "center";

        const updateVor = (index, now) => {
          let color;
          let digit;
          do color = VOR_COLORS[Math.floor(Math.random() * VOR_COLORS.length)]; while (color === lastVorColor);
          do digit = Math.floor(Math.random() * 10); while (digit === lastVorDigit);
          const skipped = vorIndex < 0 ? 0 : Math.max(0, index - vorIndex - 1);
          vorIndex = index;
          lastVorColor = color;
          lastVorDigit = digit;
          showNumbersDot(color, digit);
          setPosition(center);
          logEvent("vor_change", now, {
            index,
            planned_ms: round(index * settings.changeMs, 3),
            color,
            digit,
            skipped_intervals: skipped
          });
        };

        const beginExcursion = (now) => {
          currentDirection = picker.next(currentDirection, settings.mode === RANDOM);
          phase = "cross";
          phaseStart = now;
          phaseEnd = now + 1000;
          showCross();
          logEvent("cross_onset", now, {
            target_number: completedTargets + 1,
            direction: currentDirection,
            direction_label: DIRECTION_LABELS[currentDirection] || currentDirection
          });
        };

        const beginMovement = (now) => {
          phase = "movement";
          phaseStart = now;
          movementFrom = center;
          movementTo = edgePoint(currentDirection, geometry);
          movementDuration = movementDurationMs(movementFrom, movementTo, settings.speedArcminSec, calibration, screenPixels);
          phaseEnd = now + movementDuration;
          showActiveStimulus(now, true);
          setPosition(center);
          logEvent("movement_onset", now, {
            target_number: completedTargets + 1,
            direction: currentDirection,
            duration_ms: round(movementDuration, 3)
          });
        };

        const finishMovementAtEdge = (now) => {
          setPosition(movementTo);
          logEvent("edge_arrival", now, {
            target_number: completedTargets + 1,
            direction: currentDirection
          });
          if (moduleKey === "fixation") {
            phase = "hold";
            phaseStart = now;
            phaseEnd = now + settings.holdSec * 1000;
            showActiveStimulus(now);
            logEvent("fixation_onset", now, {
              target_number: completedTargets + 1,
              direction: currentDirection,
              planned_hold_ms: settings.holdSec * 1000
            });
          } else {
            completedTargets += 1;
            phase = "arrival_frame";
            arrivalFrame = frameCount;
          }
        };

        const showNextSaccadeTarget = (now) => {
          const nextKey = picker.next(currentGridKey, settings.mode === RANDOM);
          currentGridKey = nextKey;
          const point = gridPoint(nextKey, geometry);
          showActiveStimulus(now, true);
          setPosition(point);
          phase = "dwell";
          phaseStart = now;
          phaseEnd = now + settings.dwellMs;
          saccadeOnsetMs = now;
          logEvent("saccade_onset", now, {
            target_number: completedTargets + 1,
            direction: nextKey,
            direction_label: DIRECTION_LABELS[nextKey] || nextKey,
            planned_dwell_ms: settings.dwellMs
          });
        };

        const tickVor = (now) => {
          const dueIndex = Math.floor((now - sessionStart) / settings.changeMs);
          if (dueIndex > vorIndex) updateVor(dueIndex, now);
        };

        const tickExcursion = (now) => {
          if (phase === "cross" && now >= phaseEnd) {
            beginMovement(now);
            return;
          }
          if (phase === "movement") {
            const ratio = movementDuration <= 0 ? 1 : Math.min(1, Math.max(0, (now - phaseStart) / movementDuration));
            setPosition({
              x: movementFrom.x + (movementTo.x - movementFrom.x) * ratio,
              y: movementFrom.y + (movementTo.y - movementFrom.y) * ratio
            });
            if (stimulusType === "numbers_dot") {
              updateDynamicNumber(now);
            }
            if (ratio >= 1) finishMovementAtEdge(now);
            return;
          }
          if (phase === "arrival_frame" && frameCount > arrivalFrame) {
            if (settings.mode === EVALUATION && completedTargets >= picker.evaluationTotal) endTrial("evaluation_complete");
            else beginExcursion(now);
            return;
          }
          if (phase === "hold" && now >= phaseEnd) {
            completedTargets += 1;
            logEvent("fixation_complete", now, {
              target_number: completedTargets,
              direction: currentDirection,
              actual_hold_ms: round(now - phaseStart, 3)
            });
            if (settings.mode === EVALUATION && completedTargets >= picker.evaluationTotal) endTrial("evaluation_complete");
            else beginExcursion(now);
          } else if (phase === "hold" && stimulusType === "numbers_dot") {
            updateDynamicNumber(now);
          }
        };

        const tickSaccade = (now) => {
          if (phase === "cross" && now >= phaseEnd) {
            showNextSaccadeTarget(now);
            return;
          }
          if (phase === "dwell" && now >= phaseEnd) {
            completedTargets += 1;
            logEvent("saccade_dwell_complete", now, {
              target_number: completedTargets,
              direction: currentGridKey,
              actual_dwell_ms: round(now - phaseStart, 3)
            });
            if (settings.mode === EVALUATION && completedTargets >= picker.evaluationTotal) endTrial("evaluation_complete");
            else showNextSaccadeTarget(now);
          } else if (phase === "dwell" && stimulusType === "numbers_dot") {
            updateDynamicNumber(now);
          }
        };

        const tick = (now) => {
          if (ended) return;
          frameCount += 1;
          if (lastFrameAt !== null) {
            const gap = now - lastFrameAt;
            maxFrameGapMs = Math.max(maxFrameGapMs, gap);
            if (sampledFrameGaps.length < 600) sampledFrameGaps.push(gap);
          }
          lastFrameAt = now;
          if (isTimed && deadline !== null && now >= deadline) {
            endTrial("duration_complete");
            return;
          }
          if (moduleKey === "vor") tickVor(now);
          else if (moduleKey === "saccade") tickSaccade(now);
          else tickExcursion(now);

          if (sessionStart !== null && !ended) {
            frameCoordinates.push({
              frame_index: frameCount,
              timestamp_ms: round(now - sessionStart, 3),
              time_sec: round((now - sessionStart) / 1000, 4),
              phase,
              target_number: completedTargets + 1,
              direction: currentDirection || currentGridKey || "center",
              direction_label: DIRECTION_ENGLISH_LABELS[currentDirection || currentGridKey] || currentDirection || currentGridKey || "Center",
              stimulus_center_x: round(currentCenter.x, 3),
              stimulus_center_y: round(currentCenter.y, 3),
              stimulus_center_norm_x: geometry.viewportWidth > 0 ? round(currentCenter.x / geometry.viewportWidth, 5) : 0,
              stimulus_center_norm_y: geometry.viewportHeight > 0 ? round(currentCenter.y / geometry.viewportHeight, 5) : 0,
              stimulus_type: (STIMULUS_TYPES[stimulusType] && STIMULUS_TYPES[stimulusType].name) || stimulusType,
              stimulus_color: currentDynamicColor || "#ffffff",
              stimulus_digit: currentDynamicDigit !== null && currentDynamicDigit !== undefined ? String(currentDynamicDigit) : ""
            });
          }

          if (!ended) rafId = requestAnimationFrame(tick);
        };

        const startSession = (now) => {
          if (ended) return;
          refreshViewportGeometry();
          sessionStart = now;
          // Fullscreen and dynamic viewport units can emit resize events after
          // the stage is mounted. They are layout settling, not user aborts.
          viewportSettlesAt = now + 1000;
          deadline = isTimed ? now + plannedDurationMs : null;
          if (!geometryIsValid()) {
            endTrial("invalid_geometry");
            return;
          }
          if (isTimed) {
            this.jsPsych.pluginAPI.setTimeout(() => endTrial("duration_complete"), plannedDurationMs);
          }
          if (moduleKey === "vor") {
            showActiveStimulus(now, true);
            updateVor(0, now);
          } else if (moduleKey === "saccade") {
            const saccadeSequence = buildSaccadeSequence(selectedDirs, settings.mode);
            picker = makePicker(settings.mode, saccadeSequence, 1, selectedDirs);
            phase = "cross";
            phaseStart = now;
            phaseEnd = now + 1000;
            showCross();
            logEvent("cross_onset", now, { target_number: 1, direction: "center", direction_label: "Center" });
          } else {
            const activeSequence = EDGE_SEQUENCE.filter(d => selectedDirs.includes(d));
            const excursionPool = activeSequence.length > 0 ? activeSequence : selectedDirs;
            picker = makePicker(settings.mode, excursionPool, 2, excursionPool);
            beginExcursion(now);
          }
          tick(now);
        };

        if (moduleKey === "vor") showActiveStimulus(performance.now(), true);
        else showCross();
        setPosition(center);
        rafId = requestAnimationFrame(startSession);
      }
    }

    EyeTrainingPlugin.info = {
      name: "eye-movement-training",
      version: "1.0.0",
      parameters: {
        module: { type: ParameterType.STRING },
        settings: { type: ParameterType.OBJECT },
        calibration: { type: ParameterType.OBJECT },
        eye_tracking: { type: ParameterType.OBJECT },
        fullscreen_entered: { type: ParameterType.BOOL, default: false }
      },
      data: {
        session_id: { type: ParameterType.STRING },
        module: { type: ParameterType.STRING },
        mode: { type: ParameterType.STRING },
        end_reason: { type: ParameterType.STRING },
        actual_duration_ms: { type: ParameterType.FLOAT },
        completed_targets: { type: ParameterType.INT },
        gaze_path: { type: ParameterType.STRING },
        gaze_sample_count: { type: ParameterType.INT },
        gaze_downsampled_count: { type: ParameterType.INT },
        gaze_overflow_count: { type: ParameterType.INT }
      }
    };


  const jsPsychOptions = {
    display_element: "experiment-root",
    use_webaudio: false,
    override_safe_mode: true,
    show_progress_bar: false,
    default_iti: 0,
    on_interaction_data_update(data) { AppState.interactions.push({ ...data }); },
    on_finish() { void stopEyeTrackingRuntime(); }
  };
  if (WEBGAZER_COMPONENTS_AVAILABLE) {
    jsPsychOptions.extensions = [{
      type: window.jsPsychExtensionWebgazer,
      params: { auto_initialize: false, round_predictions: true, sampling_interval: 34 }
    }];
  }
  const jsPsych = initJsPsych(jsPsychOptions);
  window.jsPsychInstance = jsPsych;

  function post(type, value = {}) {
    window.parent.postMessage({ type, ...value }, window.location.origin);
  }

  function run(config) {
    if (AppState.pending || !config || typeof config !== "object") return;
    const moduleKey = config.module;
    if (!Object.hasOwn(MODULE_DEFAULTS, moduleKey)) {
      post("oculomotor:error", { message: "Invalid activity mode." });
      return;
    }
    const settings = {
      ...MODULE_DEFAULTS[moduleKey],
      mode: config.testMode,
      stimulusType: config.stimulusType,
      ballArcmin: config.ballArcmin,
      ballArcsec: config.ballArcmin * 60,
      distanceThresholdArcmin: config.distanceThresholdArcmin,
      changeMs: config.changeMs,
      speedArcminSec: config.speedArcminSec,
      dwellMs: config.dwellMs,
      holdSec: config.holdSec,
      totalSec: config[`${moduleKey}TotalSec`],
      directions: ["middleUp", "rightUp", "rightMiddle", "rightDown", "middleDown", "leftDown", "leftMiddle", "leftUp"]
        .filter((_, index) => config[`axis${index}Enabled`])
    };
    if (moduleKey !== "vor" && !settings.directions.length) {
      post("oculomotor:error", { message: "Choose at least one direction." });
      return;
    }
    const source = config.eyeTrackingSource === EYE_SOURCE_WEBGAZER ? EYE_SOURCE_WEBGAZER : EYE_SOURCE_OFF;
    if (source === EYE_SOURCE_WEBGAZER && (!WEBGAZER_COMPONENTS_AVAILABLE || !navigator.mediaDevices?.getUserMedia)) {
      post("oculomotor:error", { message: "Camera eye tracking is unavailable in this browser." });
      return;
    }
    AppState.calibration = createCalibration(config);
    const fitError = targetFitError(moduleKey, settings, AppState.calibration);
    if (fitError) { post("oculomotor:error", { message: fitError }); return; }
    subjectId = typeof config.subjectId === "string" ? config.subjectId : "";
    AppState.eyeTracking.source = source;
    AppState.eyeTracking.enabled = source === EYE_SOURCE_WEBGAZER;
    AppState.eyeTracking.calibrationRequested = source === EYE_SOURCE_WEBGAZER;
    AppState.pending = {
      module: moduleKey,
      settings,
      calibration: AppState.calibration,
      fullscreenEntered: Boolean(fullscreenElement()),
      setupViewport: currentViewportSignature(),
      eyeTrackingEnabled: source === EYE_SOURCE_WEBGAZER,
      eyeTrackingSource: source
    };
    const trial = {
      type: EyeTrainingPlugin,
      module: () => AppState.pending.module,
      settings: () => AppState.pending.settings,
      calibration: () => AppState.pending.calibration,
      eye_tracking: () => ({
        source: AppState.pending.eyeTrackingSource,
        enabled: AppState.pending.eyeTrackingEnabled,
        calibrated: AppState.eyeTracking.calibrated,
        calibratedAt: AppState.eyeTracking.calibratedAt
      }),
      fullscreen_entered: () => AppState.pending.fullscreenEntered,
      on_finish(data) {
        AppState.lastSession = data;
        AppState.pending = null;
        const validation = AppState.eyeTracking.lastValidation;
        post("oculomotor:complete", {
          result: {
            actual_duration_ms: data.actual_duration_ms,
            completed_targets: data.completed_targets,
            accuracy_rate: data.eye_tracking.enabled ? data.accuracy_rate : null,
            in_threshold_sec: data.eye_tracking.enabled ? data.in_threshold_sec : null,
            valid_sec: data.eye_tracking.enabled ? data.valid_sec : null,
            blink_sec: data.eye_tracking.enabled ? data.blink_sec : null,
            gaze_sample_count: data.eye_tracking.enabled ? data.gaze_sample_count : null,
            threshold_deg: data.eye_tracking.enabled ? data.threshold_deg : null,
            validation_error_deg: validation?.meanErrorDeg ?? null,
            estimated_refresh_hz: data.timing?.estimated_refresh_hz ?? null,
            end_reason: data.end_reason,
            module: data.module,
            eye_tracking_source: data.eye_tracking.source
          },
          upload: data.eye_tracking.enabled && data.gaze_records.length > 0 ? {
            records: data.gaze_records,
            metadata: {
              mode: data.module,
              run_mode: data.mode,
              stimulus_type: data.stimulus.type,
              eye_tracking_source: data.eye_tracking.source,
              screen_width_px: data.calibration.screenWidthPx,
              screen_height_px: data.calibration.screenHeightPx,
              screen_width_cm: data.calibration.screenWidthCm,
              screen_height_cm: data.calibration.screenHeightCm,
              viewing_distance_cm: data.calibration.viewingDistanceCm,
              css_px_per_cm: data.calibration.screenWidthPx / data.calibration.screenWidthCm,
              css_px_per_cm_y: data.calibration.screenHeightPx / data.calibration.screenHeightCm,
              duration_ms: Math.round(data.actual_duration_ms),
              target_size_arcmin: data.stimulus.arcmin,
              speed_arcmin_sec: Number(data.settings.speedArcminSec) || 0,
              dwell_ms: Number(data.settings.dwellMs) || 0,
              hold_ms: (Number(data.settings.holdSec) || 0) * 1000,
              vor_change_ms: Number(data.settings.changeMs) || 0,
              ...(Number.isFinite(validation?.meanErrorDeg) ? { validation_error_deg: validation.meanErrorDeg } : {}),
              gaze_threshold_deg: data.threshold_deg,
              gaze_threshold_arcmin: data.threshold_arcmin,
              gaze_sampling_interval_ms: 34
            }
          } : null
        });
      }
    };
    const webgazerTrial = source === EYE_SOURCE_WEBGAZER
      ? { ...trial, extensions: [{ type: window.jsPsychExtensionWebgazer, params: { targets: ["#training-stimulus"] } }] }
      : null;
    const fallBackToUntrackedSession = (reason) => {
      if (!AppState.pending) return;
      AppState.pending.eyeTrackingEnabled = false;
      AppState.pending.eyeTrackingSource = EYE_SOURCE_OFF;
      AppState.pending.fullscreenEntered = Boolean(fullscreenElement());
      AppState.eyeTracking.lastError = reason;
      void stopEyeTrackingRuntime();
    };
    post("oculomotor:active");
    const setup = source === EYE_SOURCE_WEBGAZER ? [
      { type: OptionalWebGazerCameraPlugin, on_finish(data) {
        if (data.ready && pendingSessionGeometryIsValid()) {
          AppState.eyeTracking.initialized = true;
        } else {
          fallBackToUntrackedSession(data.error || "Camera setup failed.");
        }
      } },
      { timeline: [
      { timeline: [{
        type: window.jsPsychWebgazerCalibrate,
        calibration_points: [[10,10],[50,10],[90,10],[10,50],[50,50],[90,50],[10,90],[50,90],[90,90]],
        calibration_mode: "click", repetitions_per_point: 2, point_size: 24,
        randomize_calibration_order: true,
        on_start() {
          window.calibrationStartViewport = currentViewportSignature();
          try { jsPsych.extensions.webgazer.resetCalibration(); } catch {}
        },
        on_finish(data) {
          const viewport = currentViewportSignature();
          if (!viewportSignaturesMatch(window.calibrationStartViewport, viewport) || !pendingSessionGeometryIsValid(window.calibrationStartViewport)) {
            fallBackToUntrackedSession("Viewport changed during calibration.");
            return;
          }
          AppState.eyeTracking.calibrated = true;
          AppState.eyeTracking.calibrationRequested = false;
          AppState.eyeTracking.calibratedAt = new Date().toISOString();
          AppState.eyeTracking.calibrationViewport = viewport;
          data.webgazer_calibrated_at = AppState.eyeTracking.calibratedAt;
        }
      }], conditional_function: () => Boolean(AppState.pending?.eyeTrackingEnabled && AppState.eyeTracking.initialized) },
      { timeline: [{ type: GazeValidationPlugin }], conditional_function: () => Boolean(AppState.pending?.eyeTrackingEnabled && AppState.eyeTracking.calibrated) }
      ], loop_function: () => Boolean(AppState.pending?.eyeTrackingEnabled && AppState.eyeTracking.needsRecalibration) }
    ] : [];
    jsPsych.run([
      ...setup,
      { timeline: [trial], conditional_function: () => Boolean(AppState.pending && AppState.pending.eyeTrackingSource === EYE_SOURCE_OFF) },
      { timeline: webgazerTrial ? [webgazerTrial] : [], conditional_function: () => Boolean(AppState.pending &&
        AppState.pending.eyeTrackingSource === EYE_SOURCE_WEBGAZER &&
        AppState.eyeTracking.calibrated && viewportSignaturesMatch(AppState.eyeTracking.calibrationViewport, currentViewportSignature())) }
    ]).catch((error) => post("oculomotor:error", { message: String(error?.message || error) }));
  }

  function targetFitError(moduleKey, settings, calibration) {
    const pixels = currentScreenPixels();
    const size = stimulusPixels(settings.ballArcmin, calibration, pixels);
    if (moduleKey === "saccade" && (size.width > pixels.width / 3 || size.height > pixels.height / 3)) return "Saccade target is too large for a grid cell.";
    if (size.width >= pixels.width || size.height >= pixels.height) return "Target is too large for the screen.";
    return "";
  }

  function pendingSessionGeometryIsValid(reference = AppState.pending?.setupViewport) {
    if (!AppState.pending || !reference) return false;
    const current = currentViewportSignature();
    if (AppState.pending.fullscreenEntered && !current.fullscreen) return false;
    return viewportSignaturesMatch(reference, current);
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== "oculomotor:start") return;
    run(event.data.settings);
  });
  post("oculomotor:ready");
})();
