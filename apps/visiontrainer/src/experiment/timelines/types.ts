import type { DrivingControlMode } from '../../utils/settings';
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
}
