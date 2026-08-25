export interface TrainingFlowLaunchState {
  configAndRulesCompleted: true;
}

export const trainingFlowLaunchState: TrainingFlowLaunchState = {
  configAndRulesCompleted: true,
};

export function IsTrainingFlowLaunchState(value: unknown): value is TrainingFlowLaunchState {
  return typeof value === 'object'
    && value !== null
    && 'configAndRulesCompleted' in value
    && value.configAndRulesCompleted === true;
}
