import { CreateAudioFeedbackController } from './audioFeedback';
import { GetSetting } from './settings/settings';

export const {
  PrepareAudioFeedback,
  PlaySuccessSound,
  PlayFailureSound,
  PlayGameEndSound,
} = CreateAudioFeedbackController(() => ({
  enabled: GetSetting('auditoryFeedbackEnabled'),
  volumePercent: 50,
}));

export const soundManager = {
  playSuccess: PlaySuccessSound,
  playFailure: PlayFailureSound,
  playEnd: PlayGameEndSound,
  prepare: PrepareAudioFeedback,
};
