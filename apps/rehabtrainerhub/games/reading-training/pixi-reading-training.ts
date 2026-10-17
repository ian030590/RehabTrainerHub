// Game-owned original RSVP countdown, batching, timing and text contrast.
import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { Application, Graphics, Text } from 'pixi.js';
import {
  AttachPixiTrialCanvas,
  CleanupPixiTrial,
  CreatePixiTrialContainer,
  RunPixiTrial,
  pixiRuntimeScopes,
} from './runtime/pixiPool';
import { pixiColors, typography } from './runtime/theme';

const info = {
  name: 'pixi-reading-training',
  version: '2.0.0',
  parameters: {
    content_array: { type: ParameterType.COMPLEX, default: [] },
    wps: { type: ParameterType.FLOAT, default: 4 },
    crowding: { type: ParameterType.INT, default: 1 },
    contrast: { type: ParameterType.FLOAT, default: 1.0 },
  },
  data: {
    reading_time: { type: ParameterType.INT },
    total_words: { type: ParameterType.INT },
  },
} as const;

type Info = typeof info;
const readingPixiScope = pixiRuntimeScopes.reading;

class PixiReadingTrainingPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: TrialType<Info>): void {
    const wrapper = CreatePixiTrialContainer(
      displayElement,
      'width:100%;height:100%;position:absolute;inset:0;overflow:hidden;background-color:var(--game-background);',
      'reading-training-trial',
    );
    const contentArray = trial.content_array as string[];
    const wps = trial.wps as number;
    const crowding = trial.crowding as number;
    // The timeline passes logCS = -log10(contrast); 0 is black text and larger values are lighter gray.
    const contrast = Math.pow(10, -(trial.contrast as number));
    const grayValue = Math.round((1 - contrast) * 200).toString(16).padStart(2, '0');
    const textColor = `#${grayValue}${grayValue}${grayValue}`;

    let trialEnded = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let chunkIndex = 0;
    let detachRenderer: (() => void) | null = null;
    const startTime = performance.now();

    const stop = () => {
      if (trialEnded) return;
      trialEnded = true;
      if (timerId) clearTimeout(timerId);
      timerId = null;
      window.removeEventListener('game:abort', stop);
      detachRenderer?.();
    };
    window.addEventListener('game:abort', stop);

    const runWithApp = (app: Application) => {
      if (trialEnded || !displayElement.isConnected) { stop(); return; }
      AttachPixiTrialCanvas(readingPixiScope, wrapper);
      const background = new Graphics();
      const text = new Text();
      app.stage.addChild(background, text);
      text.style = { fontFamily: typography.fontFamily, fontSize: 48, fontWeight: '600', fill: textColor, align: 'center' };
      text.anchor.set(0.5);

      const fitText = () => {
        const viewport = window.visualViewport;
        const viewportLeft = Math.max(0, viewport?.offsetLeft ?? 0);
        const viewportWidth = Math.min(app.screen.width, viewport?.width ?? app.screen.width);
        const availableWidth = Math.max(1, viewportWidth - 32);
        text.style.fontSize = 48;
        text.style.fontSize = Math.min(48, 48 * availableWidth / Math.max(1, text.width));
        text.x = viewportLeft + viewportWidth / 2;
      };
      const drawLayout = () => {
        background.clear().rect(0, 0, app.screen.width, app.screen.height).fill({ color: pixiColors.white });
        text.y = app.screen.height / 2;
        fitText();
      };
      drawLayout();
      app.renderer.on('resize', drawLayout);
      detachRenderer = () => {
        app.renderer.off('resize', drawLayout);
        CleanupPixiTrial(readingPixiScope, displayElement);
      };

      const finish = () => {
        if (trialEnded) return;
        stop();
        this.jsPsych.finishTrial({
          reading_time: Math.round(performance.now() - startTime),
          total_words: contentArray.length,
          presented_segments: chunkIndex,
          presentation_completed: true,
        });
      };

      const showReading = () => {
        if (trialEnded) return;
        if (chunkIndex >= contentArray.length) { finish(); return; }
        const count = Math.min(crowding, contentArray.length - chunkIndex);
        text.text = contentArray.slice(chunkIndex, chunkIndex + count).join(' ');
        fitText();
        chunkIndex += count;
        timerId = setTimeout(showReading, (count / wps) * 1000);
      };

      const countdown = ['3', '2', '1'];
      let countdownIndex = 0;
      const showCountdown = () => {
        if (trialEnded) return;
        if (countdownIndex >= countdown.length) { showReading(); return; }
        text.text = countdown[countdownIndex++];
        fitText();
        timerId = setTimeout(showCountdown, 1000);
      };
      showCountdown();
    };

    RunPixiTrial(readingPixiScope, displayElement, runWithApp);
  }
}

export default PixiReadingTrainingPlugin;
