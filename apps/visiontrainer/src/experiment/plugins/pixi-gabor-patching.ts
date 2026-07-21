import { JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { Application, Sprite, Texture, Text } from 'pixi.js';
import {
  AttachPixiTrialCanvas,
  CleanupPixiTrial,
  CreatePixiTrialContainer,
  RunPixiTrial,
} from '../../utils/pixiPool';
import { typography } from '../../theme';
import { soundManager } from '../../utils/soundManager';

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
      default: '#808080',
    },
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

const gaborTextureSpecs = [
  { size: 256, freq: 0.05, angle: 0 },
  { size: 256, freq: 0.08, angle: Math.PI / 4 },
  { size: 256, freq: 0.03, angle: Math.PI / 2 },
] as const;

const gaborTextureCache = new Map<string, Texture>();

function GetGaborTexture(size: number, freq: number, angle: number): Texture {
  const key = `${size}:${freq}:${angle}`;
  const cached = gaborTextureCache.get(key);
  if (cached) return cached;

  const texture = CreateGaborTexture(size, freq, angle);
  gaborTextureCache.set(key, texture);
  return texture;
}

function CreateGaborTexture(size: number, freq: number, angle: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Texture.EMPTY;

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;
  const cx = size / 2;
  const cy = size / 2;
  const sigma = size / 6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const gauss = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      const phase = dx * Math.cos(angle) + dy * Math.sin(angle);
      const sine = Math.sin(2 * Math.PI * freq * phase);
      
      const intensity = Math.round(128 + 127 * gauss * sine);
      const alpha = Math.round(255 * gauss);

      const i = (y * size + x) * 4;
      data[i] = intensity;
      data[i + 1] = intensity;
      data[i + 2] = intensity;
      data[i + 3] = alpha;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return Texture.from(canvas);
}

class PixiGaborPatchingPlugin implements JsPsychPlugin<Info> {
  static info = info;
  private app: Application | null = null;
  private textures: Texture[] = [];
  private spots: GaborSpot[] = [];
  private floatingScores: FloatingScore[] = [];
  private score = 0;
  private hits = 0;
  private gameStartTime = 0;
  private gameLoopRaf = 0;
  private isGameOver = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(private jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: TrialType<Info>) {
    const container = CreatePixiTrialContainer(
      displayElement,
      'width:100%;height:100%;position:relative;overflow:hidden;cursor:default;',
    );

    const hud = document.createElement('div');
    hud.style.position = 'absolute';
    hud.style.top = '20px';
    hud.style.left = '20px';
    hud.style.right = '20px';
    hud.style.display = 'flex';
    hud.style.justifyContent = 'space-between';
    hud.style.pointerEvents = 'none';
    hud.style.fontFamily = typography.fontFamily;
    hud.style.fontSize = '24px';
    hud.style.fontWeight = 'bold';
    hud.style.color = '#FFFFFF';
    hud.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';

    const timerEl = document.createElement('div');
    const scoreEl = document.createElement('div');
    hud.appendChild(timerEl);
    hud.appendChild(scoreEl);
    container.appendChild(hud);

    this.score = 0;
    this.hits = 0;
    this.spots = [];
    this.floatingScores = [];
    this.isGameOver = false;

    RunPixiTrial(displayElement, (app) => {
      this.app = app;
      AttachPixiTrialCanvas(container);
      app.renderer.background.color = trial.background_color ?? '#808080';
      
      this.textures = gaborTextureSpecs.map((spec) => (
        GetGaborTexture(spec.size, spec.freq, spec.angle)
      ));

      this.gameStartTime = performance.now();

      this.keydownListener = (event: KeyboardEvent) => {
        if (event.code === 'Escape') {
          this.endGame(trial, displayElement);
        }
      };
      window.addEventListener('keydown', this.keydownListener);

      const updateHUD = () => {
        const elapsed = performance.now() - this.gameStartTime;
        const duration = trial.duration_ms ?? 60000;
        const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
        timerEl.textContent = `Time: ${remaining}s`;
        scoreEl.textContent = `Score: ${this.score}`;
      };

      const spawnSpot = () => {
        if (!this.app || this.isGameOver) return;
        const type = Math.floor(Math.random() * this.textures.length);
        const tex = this.textures[type];
        const sprite = new Sprite(tex);
        
        sprite.anchor.set(0.5);
        sprite.x = 128 + Math.random() * (this.app!.screen.width - 256);
        sprite.y = 128 + Math.random() * (this.app!.screen.height - 256);
        sprite.rotation = Math.random() * Math.PI * 2;
        
        const minSize = trial.min_size ?? 0.2;
        const maxSize = trial.max_size ?? 0.8;
        const targetSize = maxSize;
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

        const spotData = { sprite, targetSize, targetOpacity, type, spawnTime, maxScore, minSize, lifetime };

        sprite.on('pointerdown', (e: any) => {
          e.stopPropagation();
          this.handleSpotClick(spotData);
        });

        this.app!.stage.addChild(sprite);
        this.spots.push(spotData);
      };

      const loop = (time: number) => {
        if (!displayElement.isConnected) {
          this.endGame(trial, displayElement);
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
      for (let i = 0; i < 3; i++) spawnSpot();
      
      this.gameLoopRaf = requestAnimationFrame(loop);
    });
  }

  private handleSpotClick(spot: GaborSpot) {
    if (this.isGameOver || !this.app) return;

    const now = performance.now();
    const spotAge = now - spot.spawnTime;
    const progress = Math.min(1, spotAge / spot.lifetime);
    const finalPoints = Math.max(0, Math.ceil(spot.maxScore * (1 - progress)));

    if (finalPoints <= 0) return; // ignore clicks on dead spots

    this.score += finalPoints;
    this.hits += 1;
    soundManager.playPop();

    const floatText = new Text({
      text: finalPoints.toString(),
      style: {
        fontFamily: typography.fontFamily,
        fontSize: 24,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
        dropShadow: {
          alpha: 0.5,
          color: 0x000000,
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

  private endGame(trial: TrialType<Info>, displayElement: HTMLElement) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    cancelAnimationFrame(this.gameLoopRaf);
    this.gameLoopRaf = 0;
    
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }

    if (this.app) {
      CleanupPixiTrial(displayElement);
      this.app = null;
    }

    this.textures = [];
    this.spots = [];
    this.floatingScores = [];

    const trialData = {
      rt: trial.duration_ms,
      correct: true,
      target: 'GaborPatching',
      response: 'clicks',
      acquired_targets: this.hits,
      score: this.score,
      duration_ms: trial.duration_ms,
    };

    this.jsPsych.finishTrial(trialData);
  }
}

export default PixiGaborPatchingPlugin;
