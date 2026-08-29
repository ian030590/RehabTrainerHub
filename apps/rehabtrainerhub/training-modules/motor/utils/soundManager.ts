import { CreateAudioFeedbackController } from '@rehab-trainer/ui/audioFeedback';
import { GetSetting } from './settings';

export const {
  PrepareAudioFeedback,
  PlaySuccessSound,
  PlayFailureSound,
  PlayGameEndSound,
} = CreateAudioFeedbackController(() => ({
  enabled: GetSetting('auditoryFeedbackEnabled'),
  volumePercent: GetSetting('soundVolume'),
}));
