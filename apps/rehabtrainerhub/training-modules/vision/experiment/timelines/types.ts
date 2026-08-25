// Types local to Hub-owned vision timelines.
import type { DrivingControlMode, DrivingRenderQualityLevel } from '../../utils/settings';
import type { DrivingWheelCalibration } from '../plugins/driving/driving-input';
import type { OculomotorMode, OculomotorPattern, OculomotorTargetShape } from '../../pages/training/oculomotor/types';
import type { ReadingStory } from '../../pages/training/reading/types';

export type AppLanguage = 'zh' | 'en';

export interface BuildTimelineOverrides {
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
    showGazepoint?: boolean;
    webGazerCalibration?: {
      buttonText: string;
      instruction1: string;
      instruction2: string;
      instruction3: string;
      title: string;
      loadingText?: string;
      waitingFaceText?: string;
      readyText?: string;
      timeoutText?: string;
      retryText?: string;
      errorText?: string;
      moveCloserText?: string;
      moveFartherText?: string;
      stabilizingText?: string;
      validationResultText?: string;
      validationWithinText?: string;
      validationOutsideText?: string;
      validationButtonText?: string;
      validationResultTitle?: string;
    };
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
