import HtmlButtonResponsePlugin from '@jspsych/plugin-html-button-response';
import HtmlKeyboardResponsePlugin from '@jspsych/plugin-html-keyboard-response';
import { ValidationThresholdDeg } from './gazeScoring';
import type { GazePoint } from './gazeScoring';

interface TobiiMessage {
  type: 'gaze';
  x: number;
  y: number;
  valid: boolean;
  deviceTimestampMicroseconds: number;
}

type TobiiWindow = Window & {
  __rehabTobiiHost?: boolean;
  chrome?: { webview?: { addEventListener: (name: string, handler: (event: MessageEvent) => void) => void;
    removeEventListener: (name: string, handler: (event: MessageEvent) => void) => void } };
};

export function HasTobiiHost(): boolean {
  const host = window as TobiiWindow;
  return host.__rehabTobiiHost === true && !!host.chrome?.webview;
}

export function SubscribeTobiiGaze(onSample: (sample: TobiiMessage & GazePoint) => void): () => void {
  const webview = (window as TobiiWindow).chrome?.webview;
  if (!HasTobiiHost() || !webview) throw new Error('Tobii Windows host is unavailable.');
  const handler = (event: MessageEvent) => {
    const sample = event.data as Partial<TobiiMessage>;
    if (sample?.type !== 'gaze'
      || typeof sample.x !== 'number' || !Number.isFinite(sample.x)
      || typeof sample.y !== 'number' || !Number.isFinite(sample.y)
      || typeof sample.deviceTimestampMicroseconds !== 'number'
      || !Number.isFinite(sample.deviceTimestampMicroseconds)) return;
    onSample(sample as TobiiMessage);
  };
  webview.addEventListener('message', handler);
  return () => webview.removeEventListener('message', handler);
}

export function CreateTobiiValidationTrial(
  cssPxPerCm: number,
  viewingDistanceCm: number,
  onResult?: (result: ReturnType<typeof ValidationThresholdDeg>, viewportChanged: boolean) => void,
  cssPxPerCmY = cssPxPerCm,
) {
  const points = [[50, 50], [20, 20], [80, 20], [20, 80], [80, 80]];
  const samples: GazePoint[][] = points.map(() => []);
  const viewport = { width: innerWidth, height: innerHeight };
  const targets: GazePoint[] = points.map(([x, y]) => ({ x: innerWidth * x / 100, y: innerHeight * y / 100 }));
  let stop: (() => void) | undefined;
  let timer: number | undefined;
  let startedAt = 0;
  return {
    type: HtmlKeyboardResponsePlugin,
    stimulus: `<div class="tobii-validation" style="position:fixed;inset:0;background:var(--bg)">
      <p style="position:absolute;top:1rem;left:1rem;color:var(--text-primary);font-weight:700">請依序注視五個圓點／Look at each of the five points</p>
      <div class="tobii-validation-dot" style="position:absolute;width:20px;height:20px;border-radius:50%;background:var(--accent);transform:translate(-50%,-50%)"></div>
    </div>`,
    choices: 'NO_KEYS',
    trial_duration: 7000,
    data: { eye_tracking_flow_step: 'validation', eye_tracking_source: 'tobii' },
    on_load: () => {
      samples.forEach((point) => { point.length = 0; });
      const dot = document.querySelector<HTMLElement>('.tobii-validation-dot');
      startedAt = performance.now();
      const draw = () => {
        const index = Math.min(4, Math.floor((performance.now() - startedAt) / 1400));
        if (dot) {
          dot.style.left = `${points[index][0]}%`;
          dot.style.top = `${points[index][1]}%`;
        }
      };
      draw();
      timer = window.setInterval(draw, 50);
      stop = SubscribeTobiiGaze((sample) => {
        if (!sample.valid) return;
        const elapsed = performance.now() - startedAt;
        const index = Math.floor(elapsed / 1400);
        if (index < 5 && elapsed - index * 1400 >= 350) {
          samples[index].push({ x: sample.x * innerWidth, y: sample.y * innerHeight });
        }
      });
    },
    on_finish: (data: Record<string, unknown>) => {
      stop?.();
      if (timer !== undefined) window.clearInterval(timer);
      const viewportChanged = innerWidth !== viewport.width || innerHeight !== viewport.height;
      const result = viewportChanged ? null
        : ValidationThresholdDeg(samples, targets, cssPxPerCm, viewingDistanceCm, cssPxPerCmY);
      onResult?.(result, viewportChanged);
      data.validation_viewport_changed = viewportChanged;
      data.validation_error_deg = result?.meanErrorDeg ?? null;
      data.gaze_threshold_deg = result?.thresholdDeg ?? null;
      data.validation_valid_points = result?.validPoints ?? 0;
      data.validation_passed = result !== null && result.meanErrorDeg <= 3.5;
    },
  };
}

export function CreateTobiiValidationFlow(cssPxPerCm: number, viewingDistanceCm: number, cssPxPerCmY = cssPxPerCm) {
  let result: ReturnType<typeof ValidationThresholdDeg> = null;
  let repeat = false;
  let recordGaze = true;
  let viewportChanged = false;
  const validation = CreateTobiiValidationTrial(
    cssPxPerCm,
    viewingDistanceCm,
    (next, changed) => { result = next; viewportChanged = changed; },
    cssPxPerCmY,
  );
  const decision = {
    type: HtmlButtonResponsePlugin,
    stimulus: () => {
      const error = result?.meanErrorDeg.toFixed(2) ?? '—';
      const threshold = result?.thresholdDeg.toFixed(2) ?? '—';
      const status = viewportChanged
        ? '畫面尺寸在驗證期間改變；請重新開始／Viewport changed; restart in fullscreen'
        : result && result.meanErrorDeg <= 3.5
        ? '驗證通過／Validation passed'
        : '誤差超過 3.5° 或有效樣本不足／Error exceeds 3.5° or too few samples';
      return `<div class="training-panel"><h2>Tobii 五點驗證／Five-point validation</h2>
        <p>${status}</p><p>平均誤差／Mean error: ${error}°</p>
        <p>本次注視閾值／Gaze threshold: ${threshold}°</p>
        <p>若誤差偏高，請先在 Tobii Experience 重新校正，再重新驗證。</p></div>`;
    },
    choices: () => viewportChanged
      ? ['不記錄眼動並繼續／Continue without gaze']
      : result && result.meanErrorDeg <= 3.5
      ? ['開始訓練／Start training']
      : ['重新驗證／Revalidate', '不記錄眼動並繼續／Continue without gaze'],
    data: { eye_tracking_flow_step: 'validation_result', eye_tracking_source: 'tobii' },
    on_finish: (data: Record<string, unknown>) => {
      repeat = !viewportChanged && !(result && result.meanErrorDeg <= 3.5) && data.response === 0;
      data.validation_proceeded_after_warning = !repeat && !(result && result.meanErrorDeg <= 3.5);
      if (data.validation_proceeded_after_warning) recordGaze = false;
    },
  };
  return {
    timeline: { timeline: [validation, decision], loop_function: () => repeat },
    getThresholdDeg: () => recordGaze ? result?.thresholdDeg : null,
    getMeanErrorDeg: () => recordGaze ? result?.meanErrorDeg : null,
    isRecording: () => recordGaze,
  };
}
