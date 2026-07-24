import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { Application, Graphics, Text } from 'pixi.js';
import { typography } from '../../theme';
import {
  AttachPixiTrialCanvas,
  CleanupPixiTrial,
  CreatePixiTrialContainer,
  RunPixiTrial,
  pixiRuntimeScopes,
} from '../../utils/pixiPool';

const info = {
  name: 'pixi-reading-training',
  version: '1.0.0',
  parameters: {
    content_array: {
      type: ParameterType.COMPLEX,
      default: [],
    },
    wps: {
      type: ParameterType.FLOAT,
      default: 4,
    },
    crowding: {
      type: ParameterType.INT,
      default: 1,
    },
    contrast: {
      type: ParameterType.FLOAT,
      default: 1.0,
    },
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
    const self = this;
    const wrapper = CreatePixiTrialContainer(
      displayElement,
      'width:100%;height:100%;position:absolute;top:0;left:0;overflow:hidden;background-color:#ffffff;',
      'reading-training-trial',
    );

    const contentArray = trial.content_array as string[];
    const wps = trial.wps as number;
    const crowding = trial.crowding as number;
    const logCS = trial.contrast as number;
    
    // Convert logCS (log contrast sensitivity) to linear contrast.
    // logCS = -log10(contrast), so contrast = 10^(-logCS).
    // logCS 0 → contrast 1.0 (black text), logCS 1.3 → contrast ~0.05 (very faint).
    const contrast = Math.pow(10, -logCS);
    const grayVal = Math.round((1 - contrast) * 200); 
    const hex = grayVal.toString(16).padStart(2, '0');
    const textColor = `#${hex}${hex}${hex}`;

    let trialEnded = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const startTime = performance.now();

    const runWithApp = (app: Application) => {
      AttachPixiTrialCanvas(readingPixiScope, wrapper);

      const getWidth = () => app.screen.width;
      const getHeight = () => app.screen.height;

      const bgGfx = new Graphics();
      const textObj = new Text();
      app.stage.addChild(bgGfx, textObj);

      textObj.style = {
        fontFamily: typography.fontFamily,
        fontSize: 48,
        fontWeight: '600',
        fill: textColor,
        align: 'center',
      };
      textObj.anchor.set(0.5);

      function DrawLayout() {
        const width = getWidth();
        const height = getHeight();
        bgGfx.clear().rect(0, 0, width, height).fill({ color: 0xffffff });
        textObj.x = width / 2;
        textObj.y = height / 2;
      }
      DrawLayout();

      const handleResize = () => DrawLayout();
      app.renderer.on('resize', handleResize);

      const handleKeydown = (e: KeyboardEvent) => {
        if (e.code === 'Escape') {
          EndTrial();
        }
      };
      window.addEventListener('keydown', handleKeydown);

      function EndTrial() {
        if (trialEnded) return;
        trialEnded = true;
        if (timerId) clearTimeout(timerId);
        app.renderer.off('resize', handleResize);
        window.removeEventListener('keydown', handleKeydown);
        CleanupPixiTrial(readingPixiScope, displayElement);

        self.jsPsych.finishTrial({
          reading_time: Math.round(performance.now() - startTime),
          total_words: contentArray.length,
        });
      }

      // Step 1: Countdown 3, 2, 1
      const countdowns = ['3', '2', '1'];
      let cIdx = 0;

      function ShowCountdown() {
        if (trialEnded) return;
        if (cIdx < countdowns.length) {
          textObj.text = countdowns[cIdx];
          cIdx++;
          timerId = setTimeout(ShowCountdown, 1000);
        } else {
          StartReading();
        }
      }

      // Step 2: Reading RSVP
      let chunkIdx = 0;
      function StartReading() {
        if (trialEnded) return;
        if (chunkIdx >= contentArray.length) {
          EndTrial();
          return;
        }

        const remaining = contentArray.length - chunkIdx;
        const currentCrowding = Math.min(crowding, remaining);
        const chunkWords = contentArray.slice(chunkIdx, chunkIdx + currentCrowding);
        
        textObj.text = chunkWords.join(' ');
        
        const displayTimeMs = (currentCrowding / wps) * 1000;
        chunkIdx += currentCrowding;

        timerId = setTimeout(StartReading, displayTimeMs);
      }

      ShowCountdown();
    };

    RunPixiTrial(readingPixiScope, displayElement, runWithApp);
  }
}

export default PixiReadingTrainingPlugin;
