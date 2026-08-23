import WebGazerCalibratePlugin from '@jspsych/plugin-webgazer-calibrate';
import { ParameterType } from 'jspsych';
import type { JsPsych, JsPsychPlugin, TrialType } from 'jspsych';
import { SetSetting } from './settings';

export interface WebGazerCalibrationCopy {
  buttonText: string;
  instruction1: string;
  instruction2: string;
  instruction3: string;
  title: string;
  loadingText?: string;
  waitingFaceText?: string;
  readyText?: string;
  timeoutText?: string;
  retryText?: string;
  errorText?: string;
}

interface WebGazerExtensionLike {
  isInitialized?: () => boolean;
  start?: () => Promise<void>;
  faceDetected?: () => boolean;
  showVideo?: () => void;
  hideVideo?: () => void;
  pause?: () => void;
  resume?: () => void;
}

let activeInitCameraCleanup: (() => void) | undefined;

const initCameraInfo = {
  name: 'webgazer-init-camera-trainer',
  version: '1.0.0',
  parameters: {
    instructions: {
      type: ParameterType.HTML_STRING,
      default: '',
    },
    button_text: {
      type: ParameterType.STRING,
      default: 'Start calibration',
    },
    loading_text: {
      type: ParameterType.STRING,
      default: 'Starting the camera...',
    },
    waiting_face_text: {
      type: ParameterType.STRING,
      default: 'Center your face in the camera view. The button will unlock when tracking is ready.',
    },
    ready_text: {
      type: ParameterType.STRING,
      default: 'Face detected. You can start calibration.',
    },
    timeout_text: {
      type: ParameterType.STRING,
      default: 'Eye tracking did not become ready. Check camera permission and lighting, then retry.',
    },
    retry_text: {
      type: ParameterType.STRING,
      default: 'Retry',
    },
    error_text: {
      type: ParameterType.STRING,
      default: 'The eye tracker could not start. Check camera permission and retry.',
    },
    ready_timeout_ms: {
      type: ParameterType.INT,
      default: 20000,
    },
    ready_stable_ms: {
      type: ParameterType.INT,
      default: 350,
    },
  },
  data: {
    load_time: { type: ParameterType.INT },
    webgazer_status: { type: ParameterType.STRING },
  },
} as const;

type InitCameraInfo = typeof initCameraInfo;

function WithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`WebGazer initialization timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function IsFaceReady(extension: WebGazerExtensionLike): boolean {
  let detected = false;
  try {
    detected = extension.faceDetected?.() === true;
  } catch {
    detected = false;
  }
  if (!detected) return false;

  const feedbackBox = document.querySelector<HTMLElement>('#webgazerFaceFeedbackBox');
  return !feedbackBox || feedbackBox.style.borderColor === 'green';
}

class WebGazerInitCameraPlugin implements JsPsychPlugin<InitCameraInfo> {
  static readonly info = initCameraInfo;

  constructor(private readonly jsPsych: JsPsych) {}

  async trial(
    displayElement: HTMLElement,
    trial: TrialType<InitCameraInfo>,
    onLoad?: () => void,
  ) {
    const extension = this.jsPsych.extensions?.webgazer as WebGazerExtensionLike | undefined;
    const startedAt = performance.now();
    const readyTimeoutMs = Math.max(5000, Number(trial.ready_timeout_ms) || 20000);
    const readyStableMs = Math.max(100, Number(trial.ready_stable_ms) || 350);
    const buttonText = trial.button_text ?? 'Start calibration';
    const loadingText = trial.loading_text ?? 'Starting the camera...';
    const waitingFaceText = trial.waiting_face_text ?? 'Center your face in the camera view. The button will unlock when tracking is ready.';
    const readyText = trial.ready_text ?? 'Face detected. You can start calibration.';
    const timeoutText = trial.timeout_text ?? 'Eye tracking did not become ready. Check camera permission and lighting, then retry.';
    const retryText = trial.retry_text ?? 'Retry';
    const errorText = trial.error_text ?? 'The eye tracker could not start. Check camera permission and retry.';
    let pollId: number | undefined;
    let timeoutId: number | undefined;
    let stableSince: number | undefined;
    let attempt = 0;
    let disposed = false;
    let loaded = false;
    let resolveTrial: (() => void) | undefined;
    const trialComplete = new Promise<void>((resolve) => {
      resolveTrial = resolve;
    });

    displayElement.innerHTML = `
      <div id="webgazer-init-container" class="webgazer-init-container">
        <div class="webgazer-init-content">
          ${trial.instructions}
          <p id="webgazer-init-status" role="status" aria-live="polite"></p>
          <button id="jspsych-wg-cont" class="jspsych-btn" disabled type="button"></button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.id = 'webgazer-center-style';
    style.textContent = '#webgazerVideoContainer { top: 20px !important; left: 50% !important; transform: translateX(-50%) !important; }';
    document.querySelector('#webgazer-center-style')?.remove();
    document.head.appendChild(style);

    const statusElement = displayElement.querySelector<HTMLElement>('#webgazer-init-status');
    const button = displayElement.querySelector<HTMLButtonElement>('#jspsych-wg-cont');
    if (!statusElement || !button) {
      style.remove();
      this.jsPsych.finishTrial({ webgazer_status: 'render_error' });
      return;
    }
    button.textContent = buttonText;

    const clearWaiters = () => {
      if (pollId !== undefined) window.clearInterval(pollId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      pollId = undefined;
      timeoutId = undefined;
      stableSince = undefined;
    };

    const setStatus = (text: string, isError = false) => {
      statusElement.textContent = text;
      statusElement.classList.toggle('error', isError);
    };

    const disposeTrial = () => {
      if (disposed) return;
      disposed = true;
      attempt += 1;
      clearWaiters();
      extension?.pause?.();
      extension?.hideVideo?.();
      style.remove();
      activeInitCameraCleanup = undefined;
      resolveTrial?.();
    };

    const abortTrial = () => {
      disposeTrial();
    };

    const finish = () => {
      if (disposed) return;
      this.jsPsych.finishTrial({
        load_time: Math.round(performance.now() - startedAt),
        webgazer_status: 'ready',
      });
      disposeTrial();
    };

    const runAttempt = async () => {
      const currentAttempt = ++attempt;
      clearWaiters();
      button.disabled = true;
      button.textContent = buttonText;
      setStatus(loadingText);

      try {
        if (!extension) throw new Error('WebGazer extension is not available');
        if (!extension.isInitialized?.()) {
          if (!extension.start) throw new Error('WebGazer extension cannot start');
          await WithTimeout(extension.start(), readyTimeoutMs);
        }
        if (currentAttempt !== attempt || disposed) return;
        if (!loaded) {
          loaded = true;
          onLoad?.();
        }
        extension.showVideo?.();
        extension.resume?.();
        setStatus(waitingFaceText);

        await new Promise<void>((resolve, reject) => {
          const startedWaitingAt = performance.now();
          pollId = window.setInterval(() => {
            if (currentAttempt !== attempt || disposed) return;
            if (IsFaceReady(extension)) {
              stableSince ??= performance.now();
              if (performance.now() - stableSince >= readyStableMs) {
                clearWaiters();
                resolve();
              }
            } else {
              stableSince = undefined;
            }
          }, 100);
          timeoutId = window.setTimeout(() => {
            clearWaiters();
            reject(new Error(`WebGazer face detection timed out after ${Math.round(performance.now() - startedWaitingAt)}ms`));
          }, readyTimeoutMs);
        });

        if (currentAttempt !== attempt || disposed) return;
        button.disabled = false;
        button.textContent = buttonText;
        setStatus(readyText);
      } catch (error) {
        if (currentAttempt !== attempt || disposed) return;
        extension?.pause?.();
        extension?.hideVideo?.();
        button.disabled = false;
        button.textContent = retryText;
        setStatus(
          error instanceof Error && error.message.includes('timed out')
            ? timeoutText
            : errorText,
          true,
        );
      }
    };

    button.addEventListener('click', () => {
      if (!button.disabled && button.textContent === buttonText && IsFaceReady(extension ?? {})) {
        finish();
      } else if (!button.disabled) {
        void runAttempt();
      }
    });

    activeInitCameraCleanup = abortTrial;

    await runAttempt();
    // Keep the async plugin promise pending until the participant clicks the
    // ready button and jsPsych advances the timeline.
    await trialComplete;
  }
}

const desktopCalibrationPoints = [
  [10, 10], [50, 10], [90, 10],
  [10, 50], [50, 50], [90, 50],
  [10, 90], [50, 90], [90, 90],
] as const;

const touchCalibrationPoints = [
  [14, 16], [50, 16], [86, 16],
  [14, 50], [50, 50], [86, 50],
  [14, 84], [50, 84], [86, 84],
] as const;

function IsTouchCalibrationViewport() {
  return typeof window !== 'undefined'
    && Boolean(window.matchMedia?.('(any-pointer: coarse)').matches);
}

export async function ResetWebGazerCalibrationData() {
  const webgazer = (window as Window & {
    webgazer?: { clearData?: () => void | Promise<void> };
  }).webgazer;
  await webgazer?.clearData?.();
}

/** Stop the global WebGazer runtime when a jsPsych host is unmounted/cancelled. */
export function CleanupWebGazerRuntime() {
  activeInitCameraCleanup?.();
  activeInitCameraCleanup = undefined;

  const webgazer = (window as Window & {
    webgazer?: {
      pause?: () => void;
      showVideo?: (show: boolean) => void;
      showFaceOverlay?: (show: boolean) => void;
      showFaceFeedbackBox?: (show: boolean) => void;
      stopVideo?: () => void;
      end?: () => void;
    };
  }).webgazer;

  try {
    webgazer?.pause?.();
    webgazer?.showVideo?.(false);
    webgazer?.showFaceOverlay?.(false);
    webgazer?.showFaceFeedbackBox?.(false);
    webgazer?.stopVideo?.();
    webgazer?.end?.();
  } catch {
    // A partially initialized runtime must not prevent the host from closing.
  }
  document.querySelector('#webgazer-center-style')?.remove();
}

export function CreateWebGazerCalibrationTimeline(copy: WebGazerCalibrationCopy): object[] {
  const touchViewport = IsTouchCalibrationViewport();

  return [
    {
      type: WebGazerInitCameraPlugin,
      instructions: `
        <div class="webgazer-jspsych-instructions">
          <h2>${copy.title}</h2>
          <p>${copy.instruction1}</p>
          <p>${copy.instruction2}</p>
          <p>${copy.instruction3}</p>
        </div>
      `,
      button_text: copy.buttonText,
      loading_text: copy.loadingText,
      waiting_face_text: copy.waitingFaceText,
      ready_text: copy.readyText,
      timeout_text: copy.timeoutText,
      retry_text: copy.retryText,
      error_text: copy.errorText,
      ready_timeout_ms: 20000,
      ready_stable_ms: 350,
    },
    {
      type: WebGazerCalibratePlugin,
      calibration_points: touchViewport ? touchCalibrationPoints : desktopCalibrationPoints,
      calibration_mode: 'click',
      repetitions_per_point: 2,
      randomize_calibration_order: true,
      point_size: touchViewport ? 48 : 28,
      on_finish: () => SetSetting('webGazerCalibrationAt', new Date().toISOString()),
    },
  ];
}
