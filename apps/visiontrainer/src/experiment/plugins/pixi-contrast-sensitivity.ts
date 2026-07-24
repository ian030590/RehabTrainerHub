import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { Sprite, Texture, Graphics } from 'pixi.js';
import {
  AttachPixiTrialCanvas,
  CleanupPixiTrial,
  CreatePixiTrialContainer,
  RunPixiTrial,
} from '../../utils/pixiPool';
import { DrawLandoltC, DrawTumblingE, DrawContrastGrating } from '../../pages/assessment/logic/optotypeRenderer';
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

const keyDirectionMap: Record<string, number> = {
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

function KeyToDirection(key: string): number {
  return keyDirectionMap[key.toLowerCase()] ?? -1;
}

class PixiContrastSensitivityPlugin implements JsPsychPlugin<Info> {
  static info = info;
  private keyboardListener: any;
  private touchControls: HTMLDivElement | null = null;

  constructor(private jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: TrialType<Info>, onLoad: () => void) {
    const container = CreatePixiTrialContainer(displayElement);

    RunPixiTrial(displayElement, (app) => {
      AttachPixiTrialCanvas(container);
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

      onLoad();

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
          DrawLandoltC(ctx, size / 2, size / 2, trial.stroke_px!, trial.direction as LandoltDirection, trial.fore_color!, trial.back_color!);
        } else if (trial.optotype === 'tumblingE') {
          DrawTumblingE(ctx, size / 2, size / 2, trial.stroke_px!, trial.direction as EDirection, trial.fore_color!);
        } else if (trial.optotype === 'grating') {
          DrawContrastGrating(ctx, size / 2, size / 2, size, trial.direction!, trial.contrast!, trial.back_color!);
        }
      
        const texture = Texture.from(canvas);
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.x = cx;
        sprite.y = cy;
        app.stage.addChild(sprite);
        const stimulusOnset = performance.now();

        this.keyboardListener = this.jsPsych.pluginAPI.getKeyboardResponse({
          callback_function: (info: any) => {
            this.endTrial(info.rt, info.key, trial, sprite, displayElement);
          },
          valid_responses: trial.choices,
          rt_method: 'performance',
          persist: false,
          allow_held_key: false,
        });
        this.touchControls = this.createTouchControls(container, (key) => {
          this.endTrial(Math.round(performance.now() - stimulusOnset), key, trial, sprite, displayElement);
        });

      }, trial.fixation_duration_ms!);
    });
  }

  private endTrial(rt: number, key: string, trial: TrialType<Info>, sprite: Sprite, displayElement: HTMLElement) {
    if (this.keyboardListener) {
      this.jsPsych.pluginAPI.cancelKeyboardResponse(this.keyboardListener);
    }
    this.touchControls?.remove();
    this.touchControls = null;
    sprite.destroy();
    CleanupPixiTrial(displayElement);

    const userDirection = KeyToDirection(key);
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

  private createTouchControls(container: HTMLElement, onSelect: (key: string) => void) {
    if (!ShouldShowTouchControls()) return null;

    const pad = document.createElement('div');
    Object.assign(pad.style, {
      position: 'absolute',
      right: 'max(12px, env(safe-area-inset-right))',
      bottom: 'max(12px, env(safe-area-inset-bottom))',
      zIndex: '5',
      width: '144px',
      height: '144px',
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 46px)',
      gridTemplateRows: 'repeat(3, 46px)',
      gap: '3px',
      pointerEvents: 'auto',
      touchAction: 'none',
    });

    const directions = [
      { key: 'ArrowUpLeft', label: '↖', col: 1, row: 1 },
      { key: 'ArrowUp', label: '↑', col: 2, row: 1 },
      { key: 'ArrowUpRight', label: '↗', col: 3, row: 1 },
      { key: 'ArrowLeft', label: '←', col: 1, row: 2 },
      { key: 'ArrowRight', label: '→', col: 3, row: 2 },
      { key: 'ArrowDownLeft', label: '↙', col: 1, row: 3 },
      { key: 'ArrowDown', label: '↓', col: 2, row: 3 },
      { key: 'ArrowDownRight', label: '↘', col: 3, row: 3 },
    ] as const;

    for (const direction of directions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = direction.label;
      button.setAttribute('aria-label', direction.key);
      Object.assign(button.style, {
        gridColumn: String(direction.col),
        gridRow: String(direction.row),
        width: '46px',
        height: '46px',
        border: '1px solid rgba(15, 23, 42, 0.22)',
        borderRadius: '10px',
        background: 'rgba(255, 255, 255, 0.34)',
        color: 'rgba(15, 23, 42, 0.72)',
        fontSize: '18px',
        fontWeight: '800',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      });
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(direction.key);
      }, { once: true });
      pad.appendChild(button);
    }

    container.appendChild(pad);
    return pad;
  }
}

function ShouldShowTouchControls() {
  return navigator.maxTouchPoints > 0
    || (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
}

export default PixiContrastSensitivityPlugin;
