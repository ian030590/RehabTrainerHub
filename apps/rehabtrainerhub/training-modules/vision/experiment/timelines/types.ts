// Types local to Hub-owned vision timelines.
import type { JsPsych } from 'jspsych';
import type { DrivingControlMode, DrivingRenderQualityLevel } from '../../utils/settings';
import type { WebGazerCalibrationCopy } from '../../utils/webgazerCalibration';
import type { DrivingWheelCalibration } from '../plugins/driving/driving-input';
import type {
  OculomotorBehavior,
  OculomotorLetterWeight,
  OculomotorMode,
  OculomotorPattern,
  OculomotorSpeedUnit,
  OculomotorTargetShape,
} from '../../pages/training/oculomotor/types';
import type { ReadingStory } from '../../pages/training/reading/types';

export type AppLanguage = 'zh' | 'en';

export interface BuildTimelineOverrides {
  difficulty?: string;
  jsPsych?: JsPsych;
  totalRounds?: number;
  oculomotor?: {
    mode?: OculomotorMode;
    pattern?: OculomotorPattern;
    durationSec?: number;
    behavior?: OculomotorBehavior;
    speedUnit?: OculomotorSpeedUnit;
    speedValue?: number;
    targetRadiusPx?: number;
    targetCount?: number;
    distractorCount?: number;
    distractorBrightness?: number;
    targetColor?: string;
    backgroundColor?: string;
    targetShape?: OculomotorTargetShape;
    customTargetImage?: string;
    opacity?: number;
    backgroundImage?: string;
    audio?: string;
    bounceJitter?: number;
    motionDirection?: 1 | -1;
    showTrail?: boolean;
    letterEnabled?: boolean;
    letterColor?: string;
    letterWeight?: OculomotorLetterWeight;
    letterScale?: number;
    lilacChaserScale?: number;
    lilacChaserColor?: string;
    viewingDistanceCm?: number;
    cssPxPerCm?: number;
    showGazepoint?: boolean;
    webGazerCalibration?: WebGazerCalibrationCopy;
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
    wheelCalibration?: DrivingWheelCalibration | null;
    renderQuality?: DrivingRenderQualityLevel;
    language?: AppLanguage;
  };
}
