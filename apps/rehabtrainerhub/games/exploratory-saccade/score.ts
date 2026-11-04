import { BuildRounds, SummarizeScreens } from './logic/saccadeScore';
import type { ScreenRecord } from './logic/screenRun';

export function BuildGameScore(screens: ScreenRecord[]) {
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'exploratory-saccade', summary: SummarizeScreens(screens), rounds: BuildRounds(screens) };
}
