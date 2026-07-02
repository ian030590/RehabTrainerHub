import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { Sprite, Texture, Graphics } from 'pixi.js';
import {
  attachPixiTrialCanvas,
  cleanupPixiTrial,
  createPixiTrialContainer,
  runPixiTrial,
} from '../../utils/pixiPool';
import { drawLandoltC, drawTumblingE, drawContrastGrating } from '../../pages/assessment/logic/optotypeRenderer';
import type { LandoltDirection, EDirection } from '../../pages/assessment/logic/optotypeRenderer';

const info = {
  name: 'pixi-contrast-sensitivity',
  version: '1.0.0',
  parameters: {
    optotype: {
      type: ParameterType.STRING,
      default: 'landolt',
    },
    direction: {
      type: ParameterType.INT,
      default: 0,
    },
    stroke_px: {
      type: ParameterType.INT,
      default: 10,
    },
    contrast: {
      type: ParameterType.FLOAT,
      default: 1.0,
    },
    fore_color: {
      type: ParameterType.STRING,
      default: '#000000',
    },
    back_color: {
      type: ParameterType.STRING,
      default: '#808080',
    },
    fixation_duration_ms: {
      type: ParameterType.INT,
      default: 500,
    },
    choices: {
      type: ParameterType.KEYS,
      default: [
        'ArrowRight', 'ArrowUpRight', 'ArrowUp', 'ArrowUpLeft', 
        'ArrowLeft', 'ArrowDownLeft', 'ArrowDown', 'ArrowDownRight',
        '7', '9', '1', '3', '8', '2', '4', '6',
        'Home', 'PageUp', 'End', 'PageDown'
      ],
    },
  },
  data: {
    rt: { type: ParameterType.INT },
    correct: { type: ParameterType.BOOL },
    response: { type: ParameterType.STRING },
  },
} as const;

type Info = typeof info;

const KEY_DIRECTION_MAP: Record<string, number> = {
  arrowright: 0,
  '6': 0,
  arrowupright: 1,
  '9': 1,
  pageup: 1,
  arrowup: 2,
  '8': 2,
  arrowupleft: 3,
  '7': 3,
  home: 3,
  arrowleft: 4,
  '4': 4,
  arrowdownleft: 5,
  '1': 5,
  end: 5,
  arrowdown: 6,
  '2': 6,
  arrowdownright: 7,
  '3': 7,
  pagedown: 7,
};

function keyToDirection(key: string): number {
  return KEY_DIRECTION_MAP[key.toLowerCase()] ?? -1;
}

class PixiContrastSensitivityPlugin implements JsPsychPlugin<Info> {
  static info = info;
  private keyboardListener: any;

  constructor(private jsPsych: JsPsych) {}

  trial(display_element: HTMLElement, trial: TrialType<Info>, on_load: () => void) {
    const container = createPixiTrialContainer(display_element);

    runPixiTrial(display_element, (app) => {
      attachPixiTrialCanvas(container);
      app.renderer.background.color = trial.back_color!;

      const cx = app.screen.width / 2;
      const cy = app.screen.height / 2;

      const cross = new Graphics();
      cross.setStrokeStyle({ width: 2, color: 0x000000 });
      cross.moveTo(cx - 10, cy);
      cross.lineTo(cx + 10, cy);
      cross.moveTo(cx, cy - 10);
      cross.lineTo(cx, cy + 10);
      app.stage.addChild(cross);

      on_load();

      this.jsPsych.pluginAPI.setTimeout(() => {
        cross.destroy();

        const isGrating = trial.optotype === 'grating';
        const size = isGrating ? Math.max(app.screen.width, app.screen.height) * 1.5 : (trial.stroke_px || 10) * 10;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
      
        ctx.fillStyle = trial.back_color!;
        ctx.fillRect(0, 0, size, size);

        if (trial.optotype === 'landolt') {
          drawLandoltC(ctx, size / 2, size / 2, trial.stroke_px!, trial.direction as LandoltDirection, trial.fore_color!, trial.back_color!);
        } else if (trial.optotype === 'tumblingE') {
          drawTumblingE(ctx, size / 2, size / 2, trial.stroke_px!, trial.direction as EDirection, trial.fore_color!);
        } else if (trial.optotype === 'grating') {
          drawContrastGrating(ctx, size / 2, size / 2, size, trial.direction!, trial.contrast!, trial.back_color!);
        }
      
        const texture = Texture.from(canvas);
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.x = cx;
        sprite.y = cy;
        app.stage.addChild(sprite);

        this.keyboardListener = this.jsPsych.pluginAPI.getKeyboardResponse({
          callback_function: (info: any) => {
            this.endTrial(info.rt, info.key, trial, sprite, display_element);
          },
          valid_responses: trial.choices,
          rt_method: 'performance',
          persist: false,
          allow_held_key: false,
        });

      }, trial.fixation_duration_ms!);
    });
  }

  private endTrial(rt: number, key: string, trial: TrialType<Info>, sprite: Sprite, displayElement: HTMLElement) {
    if (this.keyboardListener) {
      this.jsPsych.pluginAPI.cancelKeyboardResponse(this.keyboardListener);
    }
    sprite.destroy();
    cleanupPixiTrial(displayElement);

    const userDirection = keyToDirection(key);
    const expectedDirection = trial.direction;
    const isCorrect = trial.optotype === 'grating'
      ? userDirection !== -1 && userDirection % 4 === expectedDirection
      : userDirection === expectedDirection;

    this.jsPsych.finishTrial({
      rt,
      response: key,
      correct: isCorrect,
    });
  }
}

export default PixiContrastSensitivityPlugin;
