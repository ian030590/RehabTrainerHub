export type LevelId = 1 | 2 | 3;
export type BallId = 'basketball' | 'soccer' | 'tennis' | 'beach';
export type ResponseAction = 'clap' | 'thigh';
export type ExpectedAction = ResponseAction | 'none';
export type ResponseSource = 'camera' | 'microphone' | 'keyboard' | 'touch';
export type TrialOutcome = 'hit' | 'correct_reject' | 'miss' | 'false_alarm' | 'wrong_action';

export interface TrialPlan {
  trialNumber: number;
  levelId: LevelId;
  ball: BallId;
  expectedAction: ExpectedAction;
  fixationMs: number;
  xRatio: number;
  yRatio: number;
}

export interface ActionResponse {
  action: ResponseAction;
  rtMs: number;
  source: ResponseSource;
}

export interface TrialRecord extends Record<string, unknown> {
  Trial_Number: number;
  Level: LevelId;
  Ball: BallId;
  Expected_Action: ExpectedAction;
  Response_Action: ResponseAction | '';
  Response_Source: ResponseSource | '';
  Outcome: TrialOutcome;
  Correct: boolean;
  Reaction_Time_ms: number | null;
  Fixation_ms: number;
}

export interface SessionSummary {
  total: number;
  correct: number;
  accuracy: number;
  averageRtMs: number | null;
  misses: number;
  falseAlarms: number;
  wrongActions: number;
  passed: boolean;
  trials: TrialRecord[];
}

export const everyBallTiming = {
  fixationMinMs: 1000,
  fixationMaxMs: 3000,
  stimulusMs: 900,
  responseWindowMs: 1800,
  feedbackMs: 550,
};

export function GetExpectedAction(levelId: LevelId, ball: BallId): ExpectedAction {
  if (ball === 'basketball') return 'clap';
  if (levelId === 3 && ball === 'soccer') return 'thigh';
  return 'none';
}

export function CreateEveryBallPlans(levelId: LevelId, trialCount: number, rng = Math.random): TrialPlan[] {
  const balls: BallId[] = [];
  if (levelId === 1) {
    balls.push(...Array.from({ length: trialCount }, () => 'basketball' as const));
  } else {
    const targetCount = Math.max(1, Math.round(trialCount * (levelId === 2 ? 0.56 : 0.62)));
    for (let index = 0; index < targetCount; index += 1) {
      balls.push(levelId === 3 && index % 2 === 1 ? 'soccer' : 'basketball');
    }
    while (balls.length < trialCount) {
      balls.push(levelId === 2
        ? (['soccer', 'tennis', 'beach'] as const)[balls.length % 3]
        : (['tennis', 'beach'] as const)[balls.length % 2]);
    }
  }
  for (let index = balls.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [balls[index], balls[other]] = [balls[other], balls[index]];
  }
  return balls.map((ball, index) => ({
    trialNumber: index + 1,
    levelId,
    ball,
    expectedAction: GetExpectedAction(levelId, ball),
    fixationMs: Math.round(everyBallTiming.fixationMinMs
      + rng() * (everyBallTiming.fixationMaxMs - everyBallTiming.fixationMinMs)),
    xRatio: 0.28 + rng() * 0.44,
    yRatio: 0.3 + rng() * 0.34,
  }));
}

export function GradeEveryBallTrial(plan: TrialPlan, response: ActionResponse | null): TrialRecord {
  const correct = plan.expectedAction === 'none'
    ? response === null
    : response?.action === plan.expectedAction;
  const outcome: TrialOutcome = correct
    ? plan.expectedAction === 'none' ? 'correct_reject' : 'hit'
    : !response ? 'miss' : plan.expectedAction === 'none' ? 'false_alarm' : 'wrong_action';
  return {
    Trial_Number: plan.trialNumber,
    Level: plan.levelId,
    Ball: plan.ball,
    Expected_Action: plan.expectedAction,
    Response_Action: response?.action ?? '',
    Response_Source: response?.source ?? '',
    Outcome: outcome,
    Correct: correct,
    Reaction_Time_ms: response ? Math.round(response.rtMs) : null,
    Fixation_ms: plan.fixationMs,
  };
}

export function SummarizeEveryBallTrials(trials: TrialRecord[], levelId: LevelId): SessionSummary {
  const total = trials.length;
  const correct = trials.filter(trial => trial.Correct).length;
  const correctActions = trials.filter(trial => trial.Correct && trial.Reaction_Time_ms !== null);
  const accuracy = Math.round(correct / Math.max(1, total) * 100);
  return {
    total,
    correct,
    accuracy,
    averageRtMs: correctActions.length
      ? Math.round(correctActions.reduce((sum, trial) => sum + (trial.Reaction_Time_ms ?? 0), 0) / correctActions.length)
      : null,
    misses: trials.filter(trial => trial.Outcome === 'miss').length,
    falseAlarms: trials.filter(trial => trial.Outcome === 'false_alarm').length,
    wrongActions: trials.filter(trial => trial.Outcome === 'wrong_action').length,
    passed: accuracy >= ({ 1: 100, 2: 85, 3: 80 } as const)[levelId],
    trials,
  };
}

export function BuildEveryBallScore(summary: SessionSummary) {
  return {
    detailRows: summary.trials,
    details: {
      Trial_Count: summary.total,
      Correct_Count: summary.correct,
      Accuracy_Percent: summary.accuracy,
      Misses: summary.misses,
      False_Alarms: summary.falseAlarms,
      Wrong_Actions: summary.wrongActions,
      Average_RT_ms: summary.averageRtMs,
    },
  };
}
