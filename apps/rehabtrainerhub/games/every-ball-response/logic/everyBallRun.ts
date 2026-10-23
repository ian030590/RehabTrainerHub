import { everyBallTiming, GradeEveryBallTrial, type ActionResponse, type BallId, type TrialPlan, type TrialRecord } from './everyBallResponse';

export interface EveryBallVisual {
  phase: 'idle' | 'fixation' | 'stimulus' | 'blank' | 'feedback';
  trialNumber?: number;
  totalTrials?: number;
  fixationStyle?: 'cross' | 'blank';
  ball?: BallId;
  xRatio?: number;
  yRatio?: number;
  feedbackCorrect?: boolean;
}

interface RunOptions {
  fixationStyle: 'cross' | 'blank';
  wait: (milliseconds: number) => Promise<void>;
  waitForResponse: (milliseconds: number) => Promise<ActionResponse | null>;
  notify: (visual: EveryBallVisual) => void;
  cancelled: () => boolean;
}

class RunStopped extends Error {}

// One session of the original trial loop: fixation, the ball for 900 ms, a 1800 ms response window that
// starts with the ball, then feedback. The screen is told which ball to draw, never which action it expects.
export async function RunEveryBall(plans: readonly TrialPlan[], options: RunOptions): Promise<{ trials: TrialRecord[]; aborted: boolean }> {
  const trials: TrialRecord[] = [];
  const totalTrials = plans.length;
  const checked = async <T>(pending: Promise<T>) => {
    const value = await pending;
    if (options.cancelled()) throw new RunStopped();
    return value;
  };
  let aborted = false;
  try {
    for (const plan of plans) {
      if (options.cancelled()) throw new RunStopped();
      const trialNumber = plan.trialNumber;
      options.notify({ phase: 'fixation', trialNumber, totalTrials, fixationStyle: options.fixationStyle });
      await checked(options.wait(plan.fixationMs));
      options.notify({ phase: 'stimulus', trialNumber, totalTrials, ball: plan.ball, xRatio: plan.xRatio, yRatio: plan.yRatio });
      const hidden = options.wait(everyBallTiming.stimulusMs).then(() => {
        if (!options.cancelled()) options.notify({ phase: 'blank', trialNumber, totalTrials });
      });
      const response = await checked(options.waitForResponse(everyBallTiming.responseWindowMs));
      await checked(hidden);
      const record = GradeEveryBallTrial(plan, response);
      trials.push(record);
      options.notify({ phase: 'feedback', trialNumber, totalTrials, feedbackCorrect: record.Correct });
      await checked(options.wait(everyBallTiming.feedbackMs));
    }
  } catch (error) {
    if (!(error instanceof RunStopped)) throw error;
    aborted = true;
  }
  options.notify({ phase: 'idle' });
  return { trials: aborted ? [] : trials, aborted };
}
