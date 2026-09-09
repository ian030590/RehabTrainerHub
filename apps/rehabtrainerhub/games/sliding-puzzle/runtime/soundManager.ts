import { CreateAudioFeedbackController } from '@rehab-trainer/ui/audioFeedback';
import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';

export const { PrepareAudioFeedback, PlaySuccessSound, PlayFailureSound, PlayGameEndSound } = CreateAudioFeedbackController(() => ({ enabled: GetHostedGameSetting<boolean>('soundEnabled'), volumePercent: 50 }));
export const soundManager = { playSuccess: PlaySuccessSound, playFailure: PlayFailureSound, playEnd: PlayGameEndSound, prepare: PrepareAudioFeedback };
