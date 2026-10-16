// Game-owned original Gabor stimulus, timing and scoring.
import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { Application, Sprite, Texture, Text } from 'pixi.js';
import {
  AttachPixiTrialCanvas,
  CleanupPixiTrial,
  CreatePixiTrialContainer,
  RunPixiTrial,
  pixiRuntimeScopes,
} from './runtime/pixiPool';
import { cssColors, pixiColors, typography } from './runtime/theme';
import { GetGaborTexture, gaborTextureSpecs } from './gaborTexture';
import type { GaborPatchRecord } from './score';
import { soundManager } from './runtime/soundManager';

const info = {
  name: 'pixi-gabor-patching',
  version: '1.0.0',
  parameters: {
    duration_ms: {
      type: ParameterType.INT,
      default: 60_000,
    },
    max_spots: {
      type: ParameterType.INT,
      default: 10,
    },
    min_size: {
      type: ParameterType.FLOAT,
      default: 0.2, // scale factor relative to 256px
    },
    max_size: {
      type: ParameterType.FLOAT,
      default: 0.8,
    },
    min_opacity: {
      type: ParameterType.FLOAT,
      default: 0.15,
    },
    max_opacity: {
      type: ParameterType.FLOAT,
      default: 0.8,
    },
    background_color: {
      type: ParameterType.STRING,
      default: cssColors.gaborBackground,
    },
    language: { type: ParameterType.STRING, default: 'zh' },
    difficulty: {
      type: ParameterType.STRING,
      default: 'beginner',
    },
  },
  data: {
    rt: { type: ParameterType.INT },
    correct: { type: ParameterType.BOOL },
    target: { type: ParameterType.STRING },
    response: { type: ParameterType.STRING },
    acquired_targets: { type: ParameterType.INT },
    duration_ms: { type: ParameterType.INT },
    score: { type: ParameterType.INT },
  },
} as const;

type Info = typeof info;

interface GaborSpot {
  patch: number;
  sprite: Sprite;
  targetSize: number;
  targetOpacity: number;
  type: number;
  spawnTime: number;
  maxScore: number;
  minSize: number;
  lifetime: number;
}

interface FloatingScore {
  text: Text;
  createdAt: number;
  startY: number;
  lifetime: number;
}

const gaborPatchingPixiScope = pixiRuntimeScopes.gaborPatching;

class PixiGaborPatchingPlugin implements JsPsychPlugin<Info> {
  static info = info;
  private app: Application | null = null;
  private textures: Texture[] = [];
  private spots: GaborSpot[] = [];
  private floatingScores: FloatingScore[] = [];
  private patchRecords: GaborPatchRecord[] = [];
  private spawned = 0;
  private abortListener: (() => void) | null = null;
  private score = 0;
  private hits = 0;
  private gameStartTime = 0;
  private gameLoopRaf = 0;
  private isGameOver = false;
  private resizeListener: (() => void) | null = null;

  constructor(private jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: TrialType<Info>) {
    const container = CreatePixiTrialContainer(
      displayElement,
      'width:100%;height:100%;position:absolute;inset:0;overflow:hidden;cursor:default;',
      'gabor-patching-trial',
    );

    const hud = document.createElement('div');
    hud.className = 'gabor-hud';
    hud.style.position = 'absolute';
    hud.style.top = 'max(12px, env(safe-area-inset-top))';
    hud.style.left = 'max(12px, env(safe-area-inset-left))';
    hud.style.right = 'max(12px, env(safe-area-inset-right))';
    hud.style.display = 'flex';
    hud.style.justifyContent = 'space-between';
    hud.style.pointerEvents = 'none';
    hud.style.fontFamily = typography.fontFamily;
    hud.style.gap = '12px';
    hud.style.fontSize = '20px';
    hud.style.fontWeight = 'bold';
    hud.style.whiteSpace = 'nowrap';
    hud.style.color = cssColors.white;
    hud.style.textShadow = 'var(--game-text-shadow)';

    const timerEl = document.createElement('div');
    const scoreEl = document.createElement('div');
    timerEl.className = 'gabor-timer';
    scoreEl.className = 'gabor-score';
    hud.appendChild(timerEl);
    hud.appendChild(scoreEl);
    container.appendChild(hud);

    this.patchRecords = [];
    this.spawned = 0;
    this.score = 0;
    this.hits = 0;
    this.spots = [];
    this.floatingScores = [];
    this.isGameOver = false;

    this.abortListener = () => this.stopGame(displayElement);
    window.addEventListener('game:abort', this.abortListener);

    RunPixiTrial(gaborPatchingPixiScope, displayElement, (app) => {
      if (this.isGameOver) return;
      if (!displayElement.isConnected) { this.stopGame(displayElement); return; }
      this.app = app;
      AttachPixiTrialCanvas(gaborPatchingPixiScope, container);
      app.renderer.background.color = trial.background_color ?? cssColors.gaborBackground;
      this.resizeListener = () => this.clampActiveSpots();
      app.renderer.on('resize', this.resizeListener);

      this.textures = gaborTextureSpecs.map((spec) => (
        GetGaborTexture(spec.size, spec.freq, spec.angle)
      ));

      this.gameStartTime = performance.now();

      const updateHUD = () => {
        const elapsed = performance.now() - this.gameStartTime;
        const duration = trial.duration_ms ?? 60000;
        const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
        timerEl.textContent = `${trial.language === 'en' ? 'Time' : '時間'}: ${remaining}s`;
        scoreEl.textContent = `${trial.language === 'en' ? 'Score' : '分數'}: ${this.score}`;
      };

      const spawnSpot = () => {
        if (!this.app || this.isGameOver) return;
        const type = Math.floor(Math.random() * this.textures.length);
        const tex = this.textures[type];
        const sprite = new Sprite(tex);
        const minSize = trial.min_size ?? 0.2;
        const maxSize = trial.max_size ?? 0.8;
        const targetSize = maxSize;

        sprite.anchor.set(0.5);
        const maxRadius = Math.hypot(tex.width, tex.height) * maxSize / 2;
        const halfWidth = Math.min(this.app.screen.width / 2, maxRadius);
        const halfHeight = Math.min(this.app.screen.height / 2, maxRadius);
        sprite.x = halfWidth + Math.random() * Math.max(0, this.app.screen.width - halfWidth * 2);
        sprite.y = halfHeight + Math.random() * Math.max(0, this.app.screen.height - halfHeight * 2);
        sprite.rotation = Math.random() * Math.PI * 2;
        sprite.scale.set(minSize);

        const maxOp = trial.max_opacity ?? 0.8;
        const targetOpacity = maxOp;
        sprite.alpha = 0;

        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';

        const spawnTime = performance.now();
        const maxScore = 1000;

        let lifetime = 4000;
        if (trial.difficulty === 'intermediate') {
          lifetime = 3000;
        } else if (trial.difficulty === 'advanced') {
          lifetime = 2000;
        }

        const spotData = { patch: ++this.spawned, sprite, targetSize, targetOpacity, type, spawnTime, maxScore, minSize, lifetime };

        sprite.on('pointerdown', (e: any) => {
          e.stopPropagation();
          this.handleSpotClick(spotData);
        });

        this.app!.stage.addChild(sprite);
        this.spots.push(spotData);
      };

      const loop = (time: number) => {
        if (!displayElement.isConnected) {
          this.stopGame(displayElement);
          return;
        }
        if (this.isGameOver || !this.app) return;

        const elapsed = time - this.gameStartTime;
        if (elapsed >= (trial.duration_ms ?? 60000)) {
          this.endGame(trial, displayElement);
          return;
        }

        updateHUD();

        // Update spots (grow, fade in, and remove if score <= 0)
        for (let i = this.spots.length - 1; i >= 0; i--) {
          const spot = this.spots[i];
          const spotAge = time - spot.spawnTime;
          const progress = Math.min(1, spotAge / spot.lifetime);

          const currentSize = spot.minSize + progress * (spot.targetSize - spot.minSize);
          const currentOpacity = progress * spot.targetOpacity;

          spot.sprite.scale.set(currentSize);
          spot.sprite.alpha = currentOpacity;

          const currentScore = Math.ceil(spot.maxScore * (1 - progress));

          if (currentScore <= 0) {
            this.recordSpot(spot, 0, 0);
            this.removeSpot(spot);
            this.spots.splice(i, 1);
          }
        }

        for (let i = this.floatingScores.length - 1; i >= 0; i--) {
          const score = this.floatingScores[i];
          const progress = Math.min(1, (time - score.createdAt) / score.lifetime);
          score.text.y = score.startY - progress * 50;
          score.text.alpha = 1 - progress;

          if (progress >= 1) {
            this.app.stage.removeChild(score.text);
            score.text.destroy();
            this.floatingScores.splice(i, 1);
          }
        }

        // Spawn new spots if under limit
        let spawnChance = 0.02;
        if (trial.difficulty === 'intermediate') {
          spawnChance = 0.05;
        } else if (trial.difficulty === 'advanced') {
          spawnChance = 0.08;
        }
        if (this.spots.length < (trial.max_spots ?? 10) && Math.random() < spawnChance) {
          spawnSpot();
        }

        this.gameLoopRaf = requestAnimationFrame(loop);
      };

      // Initial spawn
      for (let i = 0; i < Math.min(3, trial.max_spots ?? 10); i++) spawnSpot();
      updateHUD();

      this.gameLoopRaf = requestAnimationFrame(loop);
    });
  }

  private handleSpotClick(spot: GaborSpot) {
    if (this.isGameOver || !this.app || !this.spots.includes(spot)) return;

    const now = performance.now();
    const spotAge = now - spot.spawnTime;
    const progress = Math.min(1, spotAge / spot.lifetime);
    const finalPoints = Math.max(0, Math.ceil(spot.maxScore * (1 - progress)));

    if (finalPoints <= 0) return; // ignore clicks on dead spots

    this.recordSpot(spot, 1, finalPoints);
    this.score += finalPoints;
    this.hits += 1;
    soundManager.playSuccess();

    const floatText = new Text({
      text: finalPoints.toString(),
      style: {
        fontFamily: typography.fontFamily,
        fontSize: 24,
        fontWeight: 'bold',
        fill: pixiColors.white,
        dropShadow: {
          alpha: 0.5,
          color: pixiColors.black,
          blur: 2,
          distance: 2,
        }
      }
    });
    floatText.anchor.set(0.5);
    floatText.x = spot.sprite.x;
    floatText.y = spot.sprite.y - 20;
    floatText.alpha = 1;
    this.app.stage.addChild(floatText);
    this.floatingScores.push({
      text: floatText,
      createdAt: now,
      startY: floatText.y,
      lifetime: 800,
    });

    this.removeSpot(spot);
    this.spots = this.spots.filter(s => s !== spot);
  }

  private removeSpot(spot: GaborSpot) {
    if (!this.app) return;
    this.app.stage.removeChild(spot.sprite);
    spot.sprite.destroy();
  }

  private clampActiveSpots() {
    if (!this.app) return;
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    const clampAxis = (value: number, halfSize: number, size: number) => (
      size <= halfSize * 2
        ? size / 2
        : Math.min(size - halfSize, Math.max(halfSize, value))
    );

    for (const spot of this.spots) {
      const maxRadius = Math.hypot(spot.sprite.texture.width, spot.sprite.texture.height) * spot.targetSize / 2;
      spot.sprite.x = clampAxis(spot.sprite.x, maxRadius, width);
      spot.sprite.y = clampAxis(spot.sprite.y, maxRadius, height);
    }
  }

  private recordSpot(spot: GaborSpot, outcome: number, points: number) {
    const now = performance.now();
    this.patchRecords.push({ patch: spot.patch, type: spot.type, outcome,
      spawnedMs: Math.max(0, Math.round(spot.spawnTime - this.gameStartTime)), endedMs: Math.max(0, Math.round(now - this.gameStartTime)),
      reactionMs: outcome === 1 ? Math.max(0, Math.round(now - spot.spawnTime)) : null, points, lifetimeMs: spot.lifetime });
  }

  private stopGame(displayElement: HTMLElement) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    cancelAnimationFrame(this.gameLoopRaf);
    this.gameLoopRaf = 0;
    if (this.abortListener) window.removeEventListener('game:abort', this.abortListener);
    this.abortListener = null;
    if (this.app) {
      if (this.resizeListener) this.app.renderer.off('resize', this.resizeListener);
      CleanupPixiTrial(gaborPatchingPixiScope, displayElement);
      this.app = null;
    }
    this.resizeListener = null;
    this.textures = [];
    this.spots = [];
    this.floatingScores = [];
  }

  private endGame(trial: TrialType<Info>, displayElement: HTMLElement) {
    if (this.isGameOver) return;
    for (const spot of this.spots) this.recordSpot(spot, 2, 0);
    const trialData = {
      rt: trial.duration_ms, correct: true, target: 'GaborPatching', response: 'clicks',
      acquired_targets: this.hits, score: this.score, duration_ms: trial.duration_ms,
      patchRecords: this.patchRecords.sort((first, second) => first.patch - second.patch),
    };
    this.stopGame(displayElement);
    this.jsPsych.finishTrial(trialData);
  }
}

export default PixiGaborPatchingPlugin;
