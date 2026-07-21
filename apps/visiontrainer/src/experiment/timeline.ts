/**
 * jsPsych Timeline Builder.
 * Assembles the trial timeline based on the selected training module.
 */
import PixiMovingCardPlugin from './plugins/pixi-moving-card';
import PixiOculomotorTrainingPlugin from './plugins/pixi-oculomotor-training';
import PixiGaborPatchingPlugin from './plugins/pixi-gabor-patching';
import WebgazerInitCameraPlugin from '@jspsych/plugin-webgazer-init-camera';
import WebgazerCalibratePlugin from '@jspsych/plugin-webgazer-calibrate';
import HtmlButtonResponsePlugin from '@jspsych/plugin-html-button-response';
import PixiReadingTrainingPlugin from './plugins/pixi-reading-training';
import { GetSetting } from '../utils/settings';
import { GenerateRandomLetters } from '../utils/mathUtils';
import { PixelFromDegree, PixelFromMillimeter } from '../utils/spatialUtils';
import type { OculomotorMode, OculomotorPattern, OculomotorTargetShape } from '../pages/training/oculomotor/types';
import type { ReadingStory } from '../pages/training/reading/types';
import type { DrivingControlMode } from '../utils/settings';

type AppLanguage = 'zh' | 'en';

/**
 * Build a jsPsych timeline for the given module.
 * Each trial = one round of the training game.
 */
export async function BuildTimeline(
  moduleId: string,
  overrides?: {
    difficulty?: string;
    totalRounds?: number;
    oculomotor?: {
      mode?: OculomotorMode;
      pattern?: OculomotorPattern;
      durationSec?: number;
      speedDegPerSec?: number;
      targetSizeMm?: number;
      distractorCount?: number;
      targetColor?: string;
      backgroundColor?: string;
      targetShape?: OculomotorTargetShape;
      customTargetImage?: string;
      opacity?: number;
      backgroundImage?: string;
      audio?: string;
      bounceJitter?: number;
    };
    gabor?: {
      durationSec?: number;
      maxSpots?: number;
    };
    reading?: {
      wps?: number;
      crowding?: number;
      contrast?: number;
      story?: ReadingStory;
    };
    driving?: {
      redFlashEnabled?: boolean;
      difficulty?: 'beginner' | 'intermediate' | 'advanced';
      controlMode?: DrivingControlMode;
      language?: AppLanguage;
    };
  },
): Promise<object[]> {
  switch (moduleId) {
    case 'moving-card':
      return BuildMovingCardTimeline(overrides);
    case 'oculomotor-training':
      return BuildOculomotorTimeline(overrides);
    case 'gabor-patching':
      return BuildGaborPatchingTimeline(overrides);
    case 'reading-training':
      return BuildReadingTimeline(overrides);
    case 'driving-rehab':
      return BuildDrivingRehabTimeline(overrides);
    default:
      console.warn(`Unknown module: ${moduleId}, falling back to moving-card`);
      return BuildMovingCardTimeline(overrides);
  }
}

async function BuildDrivingRehabTimeline(
  overrides?: {
    driving?: {
      redFlashEnabled?: boolean;
      difficulty?: 'beginner' | 'intermediate' | 'advanced';
      controlMode?: DrivingControlMode;
      language?: AppLanguage;
    };
  },
): Promise<object[]> {
  const { default: ThreeDrivingRehabPlugin } = await import('./plugins/three-driving-rehab');

  const redFlashEnabled = overrides?.driving?.redFlashEnabled ?? GetSetting('drivingRedFlashEnabled');
  const drivingDifficulty = overrides?.driving?.difficulty ?? GetSetting('drivingDifficulty');
  const drivingControlMode = overrides?.driving?.controlMode ?? GetSetting('drivingControlMode');
  const language = overrides?.driving?.language ?? 'zh';

  return [
    {
      type: ThreeDrivingRehabPlugin,
      red_flash_enabled: redFlashEnabled,
      driving_difficulty: drivingDifficulty,
      control_mode: drivingControlMode,
      language,
    },
  ];
}

function BuildMovingCardTimeline(
  overrides?: { difficulty?: string; totalRounds?: number },
): object[] {
  const totalRounds = overrides?.totalRounds ?? GetSetting('totalRounds');
  const difficulty = overrides?.difficulty ?? GetSetting('difficulty');
  const optionCount = GetSetting('optionCount');
  const moveInterval = GetSetting('optionMoveIntervalMs');
  const targetSizeMm = GetSetting('targetPhysicalSizeMm');
  const optionSizeMm = GetSetting('optionPhysicalSizeMm');

  const timeline: object[] = [];

  for (let i = 0; i < totalRounds; i++) {
    timeline.push({
      type: PixiMovingCardPlugin,
      target_letters: GenerateRandomLetters(2),
      option_count: optionCount,
      difficulty: difficulty,
      move_interval_ms: moveInterval,
      target_size_mm: targetSizeMm,
      option_size_mm: optionSizeMm,
      round_number: i + 1,
      total_rounds: totalRounds,
    });
  }

  return timeline;
}

function BuildOculomotorTimeline(
  overrides?: {
    oculomotor?: {
      mode?: OculomotorMode;
      pattern?: OculomotorPattern;
      durationSec?: number;
      speedDegPerSec?: number;
      targetSizeMm?: number;
      distractorCount?: number;
      targetColor?: string;
      backgroundColor?: string;
      targetShape?: OculomotorTargetShape;
      customTargetImage?: string;
      opacity?: number;
      backgroundImage?: string;
      audio?: string;
      bounceJitter?: number;
    };
  },
): object[] {
  const mode = overrides?.oculomotor?.mode ?? GetSetting('oculomotorMode');
  const pattern = overrides?.oculomotor?.pattern ?? GetSetting('oculomotorPattern');
  const durationSec = overrides?.oculomotor?.durationSec ?? GetSetting('oculomotorDurationSec');
  const speedDegPerSec = overrides?.oculomotor?.speedDegPerSec ?? GetSetting('oculomotorSpeedDegPerSec');
  const targetSizeMm = overrides?.oculomotor?.targetSizeMm ?? GetSetting('oculomotorTargetSizeMm');
  const distractorCount = overrides?.oculomotor?.distractorCount ?? GetSetting('oculomotorDistractorCount');
  const targetColor = overrides?.oculomotor?.targetColor ?? GetSetting('oculomotorTargetColor');
  const backgroundColor = overrides?.oculomotor?.backgroundColor ?? GetSetting('oculomotorBackgroundColor');
  const targetShape = overrides?.oculomotor?.targetShape ?? GetSetting('oculomotorTargetShape');
  const customTargetImage = overrides?.oculomotor?.customTargetImage ?? GetSetting('oculomotorCustomTargetImage');
  const opacity = overrides?.oculomotor?.opacity ?? GetSetting('oculomotorTargetOpacity');
  const backgroundImage = overrides?.oculomotor?.backgroundImage ?? GetSetting('oculomotorBackgroundImage');
  const audio = overrides?.oculomotor?.audio ?? GetSetting('oculomotorAudio');
  const bounceJitter = overrides?.oculomotor?.bounceJitter ?? GetSetting('oculomotorBounceJitter');
  const enableWebGazer = GetSetting('oculomotorEnableWebgazer');

  const timeline: object[] = [];

  if (enableWebGazer) {
    timeline.push({
      type: WebgazerInitCameraPlugin,
    });
    
    if (!GetSetting('webGazerCalibrationAt')) {
      timeline.push({
        type: WebgazerCalibratePlugin,
        calibration_points: [
          [10, 10], [10, 50], [10, 90],
          [50, 10], [50, 50], [50, 90],
          [90, 10], [90, 50], [90, 90],
        ],
        repetitions_per_point: 2,
        randomize_calibration_order: true,
      });
    }
  }

  timeline.push({
      type: PixiOculomotorTrainingPlugin,
      mode,
      pattern,
      duration_ms: Math.round(durationSec * 1000),
      speed_px_per_sec: PixelFromDegree(speedDegPerSec),
      target_radius_px: Math.max(6, PixelFromMillimeter(targetSizeMm) / 2),
      distractor_count: distractorCount,
      target_color: targetColor,
      background_color: backgroundColor,
      target_shape: targetShape,
      custom_target_image: customTargetImage,
      opacity,
      background_image: backgroundImage,
      audio,
      bounce_jitter: bounceJitter,
      enable_webgazer: enableWebGazer,
      round_number: 1,
      total_rounds: 1,
    }
  );

  return timeline;
}

function BuildGaborPatchingTimeline(
  overrides?: {
    difficulty?: string;
    gabor?: {
      durationSec?: number;
      maxSpots?: number;
    };
  },
): object[] {
  const durationSec = overrides?.gabor?.durationSec ?? GetSetting('oculomotorDurationSec'); // fallback to general duration
  const maxSpots = overrides?.gabor?.maxSpots ?? 10;
  const difficulty = overrides?.difficulty ?? GetSetting('difficulty');

  return [
    {
      type: PixiGaborPatchingPlugin,
      duration_ms: Math.round(durationSec * 1000),
      max_spots: maxSpots,
      difficulty: difficulty,
      // Default parameters will be used for min_size, max_size, etc.
    },
  ];
}

function BuildReadingTimeline(
  overrides?: {
    reading?: {
      wps?: number;
      crowding?: number;
      contrast?: number;
      story?: ReadingStory;
    };
  }
): object[] {
  const wps = overrides?.reading?.wps ?? GetSetting('readingWPS');
  const crowding = overrides?.reading?.crowding ?? GetSetting('readingCrowding');
  const contrast = overrides?.reading?.contrast ?? GetSetting('readingContrast');
  const story = overrides?.reading?.story;

  const timeline: object[] = [];

  if (story && story.content_array) {
    timeline.push({
      type: PixiReadingTrainingPlugin,
      content_array: story.content_array,
      wps: wps,
      crowding: crowding,
      contrast: contrast,
    });
    
    // Pick 10 random questions or all if less than 10
    const questions = [...(story.questions || [])];
    const numQuestions = Math.min(10, questions.length);
    for (let i = 0; i < numQuestions; i++) {
      const j = i + Math.floor(Math.random() * (questions.length - i));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    const selectedQuestions = questions.slice(0, numQuestions);
    
    for (const q of selectedQuestions) {
      timeline.push({
        type: HtmlButtonResponsePlugin,
        css_classes: ['reading-qa-trial'],
        stimulus: `<div class="reading-qa-question">${q.question}</div>`,
        choices: q.options,
        button_html: (choice: string) => `<button class="reading-qa-btn">${choice}</button>`,
        data: {
          target: q.question,
          correct_index: q.correct_index,
        },
        on_finish: (data: any) => {
          data.correct = data.response === data.correct_index;
          data.response_text = q.options[data.response];
        }
      });
    }
  } else {
    console.error('No story data provided to reading timeline');
  }

  return timeline;
}
