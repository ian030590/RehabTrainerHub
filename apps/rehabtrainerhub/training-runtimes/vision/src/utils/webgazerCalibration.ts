import WebGazerCalibratePlugin from '@jspsych/plugin-webgazer-calibrate';
import WebGazerInitCameraPlugin from '@jspsych/plugin-webgazer-init-camera';
import WebGazerValidatePlugin from '@jspsych/plugin-webgazer-validate';
import { SetSetting } from './settings';
import { ClassifyHeadDistance } from './webgazerMetrics';
import type { FaceLandmark, HeadDistanceStatus } from './webgazerMetrics';

export interface WebGazerCalibrationCopy {
  buttonText: string;
  instruction1: string;
  instruction2: string;
  instruction3: string;
  title: string;
  loadingText?: string;
  waitingFaceText?: string;
  moveCloserText?: string;
  moveFartherText?: string;
  stabilizingText?: string;
  readyText?: string;
  timeoutText?: string;
  retryText?: string;
  errorText?: string;
  validationResultTitle?: string;
  validationResultText?: string;
  validationWithinText?: string;
  validationOutsideText?: string;
  validationButtonText?: string;
}

interface WebGazerLike {
  clearData?: () => void | Promise<void>;
  getTracker?: () => {
    getPositions?: () => readonly FaceLandmark[] | null;
  };
  getVideoElementCanvas?: () => HTMLCanvasElement | null;
  pause?: () => void;
  resume?: () => void | Promise<void>;
  showVideo?: (show: boolean) => void;
  showFaceOverlay?: (show: boolean) => void;
  showFaceFeedbackBox?: (show: boolean) => void;
  stopVideo?: () => void;
  end?: () => void;
}

type HeadPositionState = 'waiting' | 'too-far' | 'too-close' | 'stabilizing' | 'ready';

const headPositionStableMs = 350;

let activeInitCameraCleanup: (() => void) | undefined;
let activeInitFailureCleanup: (() => void) | undefined;
let activeValidationCleanup: (() => void) | undefined;

function GetWebGazer(): WebGazerLike | undefined {
  return (window as Window & { webgazer?: WebGazerLike }).webgazer;
}

function IsTraditionalChineseDocument() {
  return document.documentElement.lang.toLowerCase().startsWith('zh');
}

function LocalizedFallback(zh: string, en: string) {
  return IsTraditionalChineseDocument() ? zh : en;
}

function StartInitCameraFailureRecovery(copy: WebGazerCalibrationCopy) {
  activeInitFailureCleanup?.();

  let disposed = false;
  let timeoutId: number | undefined;
  const stage = document.querySelector<HTMLElement>('.webgazer-fullscreen-stage');
  const observerTarget = stage ?? document.body;

  const showRecovery = (message: string) => {
    if (disposed || document.querySelector('#webgazer-init-recovery')) return;
    const host = stage?.querySelector<HTMLElement>('.jspsych-content') ?? stage;
    if (!host) return;

    const panel = document.createElement('section');
    panel.id = 'webgazer-init-recovery';
    panel.className = 'webgazer-init-recovery';
    panel.setAttribute('role', 'alert');

    const status = document.createElement('p');
    status.textContent = message;
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'jspsych-btn';
    retryButton.textContent = copy.retryText ?? LocalizedFallback('重新嘗試', 'Retry');
    retryButton.addEventListener('click', () => window.location.reload());
    panel.append(status, retryButton);
    host.appendChild(panel);
  };

  const detectNativeFailure = () => {
    const content = stage?.textContent ?? '';
    if (content.includes('eye tracker failed to start')) {
      showRecovery(copy.errorText ?? LocalizedFallback(
        '視線追蹤無法啟動。請確認攝影機權限後重試。',
        'The eye tracker could not start. Check camera permission, then retry.',
      ));
    }
  };

  const observer = new MutationObserver(detectNativeFailure);
  observer.observe(observerTarget, { childList: true, subtree: true });
  timeoutId = window.setTimeout(() => {
    showRecovery(copy.timeoutText ?? LocalizedFallback(
      '視線追蹤尚未就緒。請確認攝影機權限與光線後重試。',
      'Eye tracking did not become ready. Check camera permission and lighting, then retry.',
    ));
  }, 20_000);
  detectNativeFailure();

  activeInitFailureCleanup = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    activeInitFailureCleanup = undefined;
  };
}

/**
 * Estimate camera distance from MediaPipe's cheek-to-cheek landmark span.
 * The ratio is resolution independent and is intentionally broad: it only
 * rejects positions where eye tracking quality is predictably poor.
 */
function GetHeadDistanceStatus(webgazer: WebGazerLike | undefined): HeadDistanceStatus {
  try {
    const positions = webgazer?.getTracker?.()?.getPositions?.();
    const videoCanvas = webgazer?.getVideoElementCanvas?.();
    const videoWidth = Number(videoCanvas?.width)
      || Number(document.querySelector<HTMLVideoElement>('#webgazerVideoFeed')?.videoWidth);
    return ClassifyHeadDistance(positions, videoWidth, {
      tooFarBelowRatio: 0.18,
      tooCloseAboveRatio: 0.52,
    });
  } catch {
    return 'unavailable';
  }
}

function IsFaceCentered() {
  const feedbackBox = document.querySelector<HTMLElement>('#webgazerFaceFeedbackBox');
  if (!feedbackBox) return false;
  const borderColor = feedbackBox.style.borderColor
    || window.getComputedStyle(feedbackBox).borderColor;
  return borderColor === 'green' || borderColor === 'rgb(0, 128, 0)';
}

function StartHeadPositionGuidance(copy: WebGazerCalibrationCopy) {
  activeInitFailureCleanup?.();
  activeInitCameraCleanup?.();

  const webgazer = GetWebGazer();
  let stableSince: number | undefined;
  let currentState: HeadPositionState = 'waiting';
  let disposed = false;

  const text = {
    waiting: copy.waitingFaceText ?? LocalizedFallback(
      '請將臉移入綠色方框中，並直視鏡頭。',
      'Center your face in the green box and look directly at the camera.',
    ),
    tooFar: copy.moveCloserText ?? LocalizedFallback(
      '距離太遠，請往前靠近鏡頭。',
      'You are too far from the camera. Please move closer.',
    ),
    tooClose: copy.moveFartherText ?? LocalizedFallback(
      '距離太近，請往後遠離鏡頭。',
      'You are too close to the camera. Please move farther back.',
    ),
    stabilizing: copy.stabilizingText ?? LocalizedFallback(
      '頭部位置合適，請短暫保持不動。',
      'Your head position is suitable. Please hold still briefly.',
    ),
    ready: copy.readyText ?? LocalizedFallback(
      '頭部位置已就緒，可以開始校正。',
      'Head position is ready. You can start calibration.',
    ),
  };

  const ensureStatusElement = (button: HTMLButtonElement) => {
    let status = document.querySelector<HTMLElement>('#webgazer-init-status');
    if (!status) {
      status = document.createElement('p');
      status.id = 'webgazer-init-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      button.parentElement?.insertBefore(status, button);
    }
    button.setAttribute('aria-describedby', status.id);
    return status;
  };

  const update = () => {
    if (disposed) return false;
    const button = document.querySelector<HTMLButtonElement>('#jspsych-wg-cont');
    if (!button) return false;

    const status = ensureStatusElement(button);
    const headDistanceStatus = GetHeadDistanceStatus(webgazer);
    const now = performance.now();

    if (headDistanceStatus === 'unavailable') {
      currentState = 'waiting';
      stableSince = undefined;
      status.textContent = text.waiting;
    } else if (headDistanceStatus === 'too-far') {
      currentState = 'too-far';
      stableSince = undefined;
      status.textContent = text.tooFar;
    } else if (headDistanceStatus === 'too-close') {
      currentState = 'too-close';
      stableSince = undefined;
      status.textContent = text.tooClose;
    } else if (!IsFaceCentered()) {
      currentState = 'waiting';
      stableSince = undefined;
      status.textContent = text.waiting;
    } else {
      stableSince ??= now;
      if (now - stableSince >= headPositionStableMs) {
        currentState = 'ready';
        status.textContent = text.ready;
      } else {
        currentState = 'stabilizing';
        status.textContent = text.stabilizing;
      }
    }

    status.dataset.state = currentState;
    button.dataset.headPositionReady = String(currentState === 'ready');
    button.disabled = currentState !== 'ready';
    return currentState === 'ready';
  };

  // The native plugin has its own green-box observer. A capturing listener is
  // needed as well as polling so a native enable event cannot bypass distance
  // checks in the short interval before the next poll.
  const guardContinue = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('#jspsych-wg-cont')) return;
    if (!update()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  document.addEventListener('click', guardContinue, true);
  const pollId = window.setInterval(update, 80);
  update();

  activeInitCameraCleanup = () => {
    if (disposed) return;
    disposed = true;
    window.clearInterval(pollId);
    document.removeEventListener('click', guardContinue, true);
    activeInitCameraCleanup = undefined;
  };
}

function ResumeWebGazerForValidation() {
  try {
    void GetWebGazer()?.resume?.();
  } catch {
    // The native validation plugin still owns error handling and trial data.
  }
}

function StartValidationResultsPresentation(copy: WebGazerCalibrationCopy) {
  activeValidationCleanup?.();

  const container = document.querySelector<HTMLElement>('#webgazer-validate-container');
  if (!container) return;

  const applyResultPresentation = () => {
    const button = container.querySelector<HTMLButtonElement>('#cont');
    if (!button || container.querySelector('[data-webgazer-validation-result]')) return;

    const panel = document.createElement('section');
    panel.className = 'webgazer-validation-result';
    panel.dataset.webgazerValidationResult = 'true';
    panel.setAttribute('role', 'status');

    const title = document.createElement('h2');
    title.textContent = copy.validationResultTitle ?? LocalizedFallback(
      '校正成果',
      'Calibration results',
    );

    const description = document.createElement('p');
    description.textContent = copy.validationResultText ?? LocalizedFallback(
      '色點顯示每次視線估測與目標範圍的關係，請確認分佈後繼續。',
      'The colored dots show each gaze estimate relative to its target area. Review the distribution, then continue.',
    );

    const legend = document.createElement('div');
    legend.className = 'webgazer-validation-legend';
    const within = document.createElement('span');
    within.className = 'is-within';
    within.textContent = copy.validationWithinText ?? LocalizedFallback(
      '目標範圍內',
      'Inside target range',
    );
    const outside = document.createElement('span');
    outside.className = 'is-outside';
    outside.textContent = copy.validationOutsideText ?? LocalizedFallback(
      '目標範圍外',
      'Outside target range',
    );
    legend.append(within, outside);

    button.removeAttribute('style');
    button.textContent = copy.validationButtonText ?? copy.buttonText;
    panel.append(title, description, legend, button);
    container.appendChild(panel);
  };

  const observer = new MutationObserver(applyResultPresentation);
  observer.observe(container, { childList: true, subtree: true });
  applyResultPresentation();

  activeValidationCleanup = () => {
    observer.disconnect();
    activeValidationCleanup = undefined;
  };
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
  await GetWebGazer()?.clearData?.();
}

/** Stop the global WebGazer runtime when a jsPsych host is unmounted/cancelled. */
export function CleanupWebGazerRuntime() {
  activeInitCameraCleanup?.();
  activeInitCameraCleanup = undefined;
  activeInitFailureCleanup?.();
  activeInitFailureCleanup = undefined;
  activeValidationCleanup?.();
  activeValidationCleanup = undefined;

  const webgazer = GetWebGazer();

  const cleanupActions = [
    () => webgazer?.pause?.(),
    () => webgazer?.showVideo?.(false),
    () => webgazer?.showFaceOverlay?.(false),
    () => webgazer?.showFaceFeedbackBox?.(false),
    () => webgazer?.stopVideo?.(),
    () => webgazer?.end?.(),
  ];
  cleanupActions.forEach((cleanup) => {
    try {
      cleanup();
    } catch {
      // Continue cleaning a partially initialized runtime.
    }
  });
  document.querySelector('#webgazer-center-style')?.remove();
}

export function CreateWebGazerCalibrationTimeline(copy: WebGazerCalibrationCopy): object[] {
  const touchViewport = IsTouchCalibrationViewport();
  const points = touchViewport ? touchCalibrationPoints : desktopCalibrationPoints;

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
      on_start: () => StartInitCameraFailureRecovery(copy),
      on_load: () => StartHeadPositionGuidance(copy),
      on_finish: () => {
        activeInitCameraCleanup?.();
        activeInitFailureCleanup?.();
      },
    },
    {
      type: WebGazerCalibratePlugin,
      calibration_points: points,
      calibration_mode: 'click',
      repetitions_per_point: 2,
      randomize_calibration_order: true,
      point_size: touchViewport ? 48 : 28,
    },
    {
      type: WebGazerValidatePlugin,
      validation_points: points,
      randomize_validation_order: false,
      roi_radius: touchViewport ? 140 : 120,
      time_to_saccade: 700,
      validation_duration: 1200,
      point_size: touchViewport ? 48 : 28,
      show_validation_data: true,
      on_start: ResumeWebGazerForValidation,
      on_load: () => StartValidationResultsPresentation(copy),
      on_finish: () => {
        activeValidationCleanup?.();
        SetSetting('webGazerCalibrationAt', new Date().toISOString());
      },
    },
  ];
}
