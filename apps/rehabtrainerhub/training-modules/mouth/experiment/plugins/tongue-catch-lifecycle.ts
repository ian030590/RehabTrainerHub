import { ParameterType, type JsPsych, type JsPsychPlugin, type TrialType } from 'jspsych';
import { CreateLifecycleSimulationData } from '../../../shared/jsPsychSimulation';

const tongueCatchInfo = {
  name: 'tongue-catch-lifecycle',
  version: '1.0.0',
  parameters: {
    module_id: {
      type: ParameterType.STRING,
      default: 'mouth:tongue-catch',
    },
    run_token: {
      type: ParameterType.STRING,
      default: undefined,
    },
    on_start: {
      type: ParameterType.FUNCTION,
      default: undefined,
    },
  },
  data: {
    lifecycle_status: {
      type: ParameterType.STRING,
    },
    module_id: {
      type: ParameterType.STRING,
    },
    run_token: {
      type: ParameterType.STRING,
    },
  },
} as const;

type TongueCatchInfo = typeof tongueCatchInfo;
export type TongueCatchTrial = TrialType<TongueCatchInfo>;

/** Native jsPsych lifecycle boundary for Tongue Catch. */
export class TongueCatchPlugin implements JsPsychPlugin<TongueCatchInfo> {
  static info = tongueCatchInfo;

  constructor(private readonly jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: TongueCatchTrial): void {
    displayElement.replaceChildren();
    const onStart = trial.on_start as (() => void | Promise<void>) | undefined;
    if (!onStart) {
      this.finishStartError(trial);
      return;
    }

    try {
      const startResult = onStart();
      if (startResult instanceof Promise) {
        void startResult.catch(() => this.finishStartError(trial));
      }
    } catch {
      this.finishStartError(trial);
    }
  }

  simulate(
    trial: TongueCatchTrial,
    simulationMode: 'data-only' | 'visual',
    simulationOptions: { data?: Record<string, unknown> },
    onLoad?: () => void,
  ): void {
    onLoad?.();
    this.jsPsych.finishTrial(
      CreateLifecycleSimulationData(trial.module_id, trial.run_token, simulationMode, simulationOptions),
    );
  }

  private finishStartError(trial: TongueCatchTrial): void {
    const currentTrial = this.jsPsych.getCurrentTrial();
    if (
      currentTrial?.type !== TongueCatchPlugin
      || currentTrial.run_token !== trial.run_token
    ) {
      return;
    }
    this.jsPsych.finishTrial({
      lifecycle_status: 'start-error',
      module_id: trial.module_id,
      run_token: trial.run_token,
    });
  }
}
