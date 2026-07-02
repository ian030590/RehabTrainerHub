/**
 * jsPsych Custom Plugin: pixi-moving-card
 *
 * Uses PixiJS v8 to render the Moving Card training game.
 * Each jsPsych trial = one round (find the matching letters).
 *
 * IMPORTANT: trial() must NOT be async!
 * In jsPsych v8, async trial() auto-finishes when the Promise resolves.
 * We need jsPsych to wait for our explicit finishTrial() call.
 *
 * Responsive design:
 * - resizeTo: container element (canvas auto-tracks size)
 * - All coordinates relative to app.screen.width / app.screen.height
 * - No hardcoded pixel positions
 */
import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { pixiColors, typography } from '../../theme';
import { shuffleArray, generateRandomLetters, generateScatteredPositions } from '../../utils/mathUtils';
import { pixelFromMillimeter } from '../../utils/spatialUtils';
import { SoundManager } from '../../utils/soundManager';
import {
  attachPixiTrialCanvas,
  cleanupPixiTrial,
  createPixiTrialContainer,
  runPixiTrial,
} from '../../utils/pixiPool';

// ── Plugin Info ──
const info = {
  name: 'pixi-moving-card',
  version: '1.0.0',
  parameters: {
    target_letters: {
      type: ParameterType.STRING,
      default: '',
    },
    option_count: {
      type: ParameterType.INT,
      default: 18,
    },
    difficulty: {
      type: ParameterType.STRING,
      default: 'beginner',
    },
    move_interval_ms: {
      type: ParameterType.INT,
      default: 800,
    },
    target_size_mm: {
      type: ParameterType.FLOAT,
      default: 15,
    },
    option_size_mm: {
      type: ParameterType.FLOAT,
      default: 10,
    },
    round_number: {
      type: ParameterType.INT,
      default: 1,
    },
    total_rounds: {
      type: ParameterType.INT,
      default: 5,
    },
  },
  data: {
    rt: { type: ParameterType.INT },
    correct: { type: ParameterType.BOOL },
    target: { type: ParameterType.STRING },
    response: { type: ParameterType.STRING },
  },
} as const;

type Info = typeof info;

interface GameOption {
  letters: string;
  isCorrect: boolean;
  container: Container;
  currentX: number;
  currentY: number;
}

// ── Responsive Layout Constants ──
const MARGIN_X = 0.03;
const MARGIN_TOP = 0.18;
const MARGIN_BOTTOM = 0.05;
const GRID_COLS = 5;
const GRID_ROWS = 4;
const MOVE_DURATION_MS = 300;

class PixiMovingCardPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  /**
   * MUST NOT be async! jsPsych v8 auto-finishes async trials.
   * Instead, we use .then() for PixiJS init and call finishTrial() explicitly.
   */
  trial(display_element: HTMLElement, trial: TrialType<Info>): void {
    const self = this;

    // ── Setup Container ──
    const wrapper = createPixiTrialContainer(display_element);

    // ── State (captured by closure) ──
    const target = (trial.target_letters as string) || generateRandomLetters(2);
    const diff = trial.difficulty as string;
    const optionCount = trial.option_count as number;
    let feedbackActive = false;
    let moveTimerId: ReturnType<typeof setInterval> | null = null;
    let trialEnded = false;

    const runWithApp = (app: Application) => {
      attachPixiTrialCanvas(wrapper);

      const startTime = performance.now();

      // ── Screen-relative helpers ──
      const W = () => app.screen.width;
      const H = () => app.screen.height;
      const cx = () => W() / 2;

      const gameX = () => W() * MARGIN_X;
      const gameY = () => H() * MARGIN_TOP;
      const gameW = () => W() * (1 - 2 * MARGIN_X);
      const gameH = () => H() * (1 - MARGIN_TOP - MARGIN_BOTTOM);

      // ── Build Scene ──
      const bgGfx = new Graphics();
      const headerGfx = new Graphics();
      const crossGfx = new Graphics();
      const borderGfx = new Graphics();
      const targetText = new Text();
      const scoreText = new Text();
      const roundText = new Text();
      const optionsLayer = new Container();

      app.stage.addChild(bgGfx, headerGfx, scoreText, roundText, borderGfx, crossGfx, targetText, optionsLayer);

      targetText.text = target;
      targetText.style = {
        fontFamily: typography.fontFamily,
        fontWeight: '700',
        fill: pixiColors.accent,
        letterSpacing: 4,
      };
      targetText.anchor.set(0.5);

      scoreText.style = {
        fontFamily: typography.fontFamily,
        fontSize: typography.fontSizeM,
        fontWeight: '600',
        fill: pixiColors.textPrimary,
      };
      scoreText.text = `找到目標: ${target}`;

      roundText.style = {
        fontFamily: typography.fontFamily,
        fontSize: typography.fontSizeM,
        fill: pixiColors.textSecondary,
      };
      roundText.text = `回合: ${trial.round_number} / ${trial.total_rounds}`;

      // ── Draw Layout (responsive) ──
      function drawLayout() {
        const w = W();
        const h = H();

        bgGfx.clear().rect(0, 0, w, h).fill({ color: pixiColors.bg });

        headerGfx.clear()
          .rect(0, 0, w, h * 0.08).fill({ color: pixiColors.bgPanel })
          .rect(0, h * 0.08 - 1, w, 1).fill({ color: pixiColors.border });

        scoreText.x = 24;
        scoreText.y = h * 0.04 - 8;
        roundText.x = w - 180;
        roundText.y = h * 0.04 - 8;

        const targetPxSize = pixelFromMillimeter(trial.target_size_mm as number);
        const safeSize = Math.min(targetPxSize, h * 0.08, w * 0.1);
        targetText.style.fontSize = Math.max(16, safeSize);
        targetText.x = cx();
        targetText.y = h * 0.12;

        const chY = h * 0.15;
        crossGfx.clear()
          .moveTo(cx() - 8, chY).lineTo(cx() + 8, chY)
          .moveTo(cx(), chY - 8).lineTo(cx(), chY + 8)
          .stroke({ color: pixiColors.textMuted, width: 2 });

        borderGfx.clear()
          .roundRect(gameX(), gameY(), gameW(), gameH(), 8)
          .stroke({ color: pixiColors.border, width: 1, alpha: 0.5 });
      }

      drawLayout();

      // ── Generate Options ──
      const isCircle = diff === 'intermediate' || diff === 'advanced';

      const distractors = new Set<string>();
      while (distractors.size < optionCount - 1) {
        const d = generateRandomLetters(2);
        if (d !== target) distractors.add(d);
      }

      const rawOptions: { letters: string; isCorrect: boolean }[] = [
        { letters: target, isCorrect: true },
      ];
      distractors.forEach((l) => rawOptions.push({ letters: l, isCorrect: false }));
      shuffleArray(rawOptions);

      const gw = gameW();
      const gh = gameH();
      const cellW = gw / GRID_COLS;
      const cellH = gh / GRID_ROWS;
      let oW = cellW * 0.8;
      let oH = cellH * 0.8;

      if (isCircle) {
        const maxArea = (gw * gh) / optionCount;
        const safeDiameter = Math.sqrt(maxArea) * 0.85;
        const defaultDiameter = Math.min(oW, oH);
        const diameter = Math.min(defaultDiameter, safeDiameter);
        oW = diameter;
        oH = diameter;
      }
      const minDist = Math.max(oW, oH) * 1.1;

      let positions: { x: number; y: number }[] = [];
      const assignedRotations: number[] = [];
      const gx = gameX();
      const gy = gameY();

      if (diff === 'beginner') {
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let c = 0; c < GRID_COLS; c++) {
            positions.push({
              x: gx + c * cellW + cellW * 0.1 + oW / 2,
              y: gy + r * cellH + cellH * 0.1 + oH / 2,
            });
          }
        }
        shuffleArray(positions);
      } else {
        const safeW = Math.max(1, gw - oW);
        const safeH = Math.max(1, gh - oH);
        positions = generateScatteredPositions(
          optionCount,
          { x: gx + oW / 2, y: gy + oH / 2, w: safeW, h: safeH },
          minDist
        );
      }

      // ── Create Option Containers ──
      const options: GameOption[] = [];
      const optionFontPx = Math.max(12, pixelFromMillimeter(trial.option_size_mm as number));

      const correctBg = 0x1A3D2B;
      const correctBorder = pixiColors.success;
      const wrongBg = 0x3D1A1A;
      const wrongBorder = pixiColors.error;

      for (let i = 0; i < rawOptions.length; i++) {
        const opt = rawOptions[i];
        if (i >= positions.length) break;
        const pos = positions[i];

        const optContainer = new Container();
        optContainer.eventMode = 'static';
        optContainer.cursor = 'pointer';
        optContainer.pivot.set(oW / 2, oH / 2);
        optContainer.x = pos.x;
        optContainer.y = pos.y;

        // Rotation for advanced difficulty
        let chosenRotation = 0;
        if (diff === 'advanced') {
          let bestRotation = 0;
          let maxScore = -1;
          for (let cand = 0; cand < 12; cand++) {
            const testRot = (Math.random() - 0.5) * Math.PI;
            let score = Math.PI * 10;
            for (let j = 0; j < i; j++) {
              const dx = pos.x - positions[j].x;
              const dy = pos.y - positions[j].y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const threshold = Math.min(W(), H()) * 0.3;
              if (dist < threshold) {
                const angleDiff = Math.abs(testRot - assignedRotations[j]);
                const weight = 1 - dist / threshold;
                const weightedDiff = angleDiff / (weight + 0.01);
                if (weightedDiff < score) score = weightedDiff;
              }
            }
            if (score > maxScore) {
              maxScore = score;
              bestRotation = testRot;
            }
          }
          chosenRotation = bestRotation;
        }
        assignedRotations.push(chosenRotation);
        optContainer.rotation = chosenRotation;

        const optBg = new Graphics();
        const drawState = (state: 'normal' | 'hover' | 'correct' | 'wrong') => {
          optBg.clear();
          let bgColor: number;
          let borderClr: number;
          let borderWidth: number;

          switch (state) {
            case 'hover':
              bgColor = pixiColors.bgCardHover;
              borderClr = pixiColors.accent;
              borderWidth = 2;
              break;
            case 'correct':
              bgColor = correctBg;
              borderClr = correctBorder;
              borderWidth = 2;
              break;
            case 'wrong':
              bgColor = wrongBg;
              borderClr = wrongBorder;
              borderWidth = 2;
              break;
            default:
              bgColor = pixiColors.bgCard;
              borderClr = pixiColors.border;
              borderWidth = 1;
          }

          if (isCircle) {
            optBg.roundRect(0, 0, oW, oH, oW / 2)
              .fill({ color: bgColor })
              .stroke({ color: borderClr, width: borderWidth });
          } else {
            optBg.roundRect(0, 0, oW, oH, 4)
              .fill({ color: bgColor })
              .stroke({ color: borderClr, width: borderWidth });
          }
        };

        drawState('normal');
        optContainer.addChild(optBg);

        const safeFontSize = Math.min(optionFontPx, Math.min(oW, oH) * 0.7);
        const optText = new Text({
          text: opt.letters,
          style: {
            fontFamily: typography.fontFamily,
            fontSize: safeFontSize,
            fontWeight: '600',
            fill: pixiColors.textPrimary,
          },
        });
        optText.anchor.set(0.5);
        optText.x = oW / 2;
        optText.y = oH / 2;
        optContainer.addChild(optText);

        const gameOpt: GameOption = {
          letters: opt.letters,
          isCorrect: opt.isCorrect,
          container: optContainer,
          currentX: pos.x,
          currentY: pos.y,
        };

        optContainer.on('pointerover', () => {
          if (!feedbackActive) drawState('hover');
        });
        optContainer.on('pointerout', () => {
          if (!feedbackActive) drawState('normal');
        });
        optContainer.on('pointertap', () => {
          if (feedbackActive || trialEnded) return;
          feedbackActive = true;
          const rt = Math.round(performance.now() - startTime);

          if (gameOpt.isCorrect) {
            drawState('correct');
            SoundManager.playCorrect();
            setTimeout(() => endTrial(rt, true, gameOpt.letters), 350);
          } else {
            drawState('wrong');
            SoundManager.playIncorrect();
            setTimeout(() => {
              drawState('normal');
              feedbackActive = false;
            }, 350);
          }
        });

        options.push(gameOpt);
        optionsLayer.addChild(optContainer);
      }

      // ── Move Timer ──
      function moveRandomOption() {
        if (!display_element.isConnected) {
          endTrial(0, false, 'Unmounted');
          return;
        }
        if (trialEnded || options.length === 0) return;

        const opt = options[Math.floor(Math.random() * options.length)];
        let bestPos: { x: number; y: number } | null = null;

        const curGx = gameX();
        const curGy = gameY();
        const curGw = gameW();
        const curGh = gameH();
        const curCellW = curGw / GRID_COLS;
        const curCellH = curGh / GRID_ROWS;

        if (diff === 'beginner') {
          const allGridPos: { x: number; y: number }[] = [];
          for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
              allGridPos.push({
                x: curGx + c * curCellW + curCellW * 0.1 + oW / 2,
                y: curGy + r * curCellH + curCellH * 0.1 + oH / 2,
              });
            }
          }
          const emptyPos = allGridPos.filter((pos) =>
            !options.some(
              (o) => Math.abs(o.currentX - pos.x) < 5 && Math.abs(o.currentY - pos.y) < 5
            )
          );
          if (emptyPos.length > 0) {
            bestPos = emptyPos[Math.floor(Math.random() * emptyPos.length)];
          }
        } else {
          const minDistSq = minDist * minDist;
          const safeW = Math.max(1, curGw - oW);
          const safeH = Math.max(1, curGh - oH);
          for (let attempt = 0; attempt < 100; attempt++) {
            const px = curGx + oW / 2 + Math.random() * safeW;
            const py = curGy + oH / 2 + Math.random() * safeH;
            let overlap = false;
            for (const other of options) {
              if (other === opt) continue;
              const dx = px - other.currentX;
              const dy = py - other.currentY;
              if (dx * dx + dy * dy < minDistSq) {
                overlap = true;
                break;
              }
            }
            if (!overlap) {
              bestPos = { x: px, y: py };
              break;
            }
          }
        }

        if (bestPos) {
          const targetPos = bestPos;
          opt.currentX = targetPos.x;
          opt.currentY = targetPos.y;

          const sx = opt.container.x;
          const sy = opt.container.y;
          const animStart = performance.now();

          const animate = () => {
            if (trialEnded) return;
            const elapsed = performance.now() - animStart;
            const t = Math.min(1, elapsed / MOVE_DURATION_MS);
            const ease = 1 - Math.pow(1 - t, 3);
            opt.container.x = sx + (targetPos.x - sx) * ease;
            opt.container.y = sy + (targetPos.y - sy) * ease;
            if (t < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      }

      moveTimerId = setInterval(moveRandomOption, trial.move_interval_ms as number);

      // ── Resize Handler ──
      const handleResize = () => drawLayout();
      app.renderer.on('resize', handleResize);

      // ── Keydown Handler ──
      const handleKeydown = (e: KeyboardEvent) => {
        if (e.code === 'Escape') {
          endTrial(Math.round(performance.now() - startTime), false, 'Escape');
        }
      };
      window.addEventListener('keydown', handleKeydown);

      // ── End Trial ──
      function endTrial(rt: number, correct: boolean, response: string) {
        if (trialEnded) return;
        trialEnded = true;

        if (moveTimerId) clearInterval(moveTimerId);
        app.renderer.off('resize', handleResize);
        window.removeEventListener('keydown', handleKeydown);

        // Clear & detach (reuse app for next round)
        cleanupPixiTrial(display_element);

        // Tell jsPsych this trial is done
        self.jsPsych.finishTrial({
          rt,
          correct,
          target,
          response,
        });
      }

    };

    runPixiTrial(display_element, runWithApp);

    // Returns void (undefined) — jsPsych waits for finishTrial()
  }
}

export default PixiMovingCardPlugin;
