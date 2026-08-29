import { ParameterType, type JsPsych, type JsPsychPlugin, type TrialType } from 'jspsych';
import { CreateLifecycleSimulationData } from '../../../shared/jsPsychSimulation';

const gestureBattlerInfo = {
  name: 'gesture-battler-lifecycle',
  version: '1.0.0',
  parameters: {
    module_id: {
      type: ParameterType.STRING,
      default: 'motor:gesture-battler',
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

type GestureBattlerInfo = typeof gestureBattlerInfo;
export type GestureBattlerTrial = TrialType<GestureBattlerInfo>;

/**
 * Native jsPsych boundary for Gesture Battler.
 *
 * The module component owns Pixi, camera, calibration and game state. This
 * plugin only starts the owner callback and keeps the jsPsych trial open until
 * the component explicitly calls finishTrial or abortExperiment.
 */
export class GestureBattlerPlugin implements JsPsychPlugin<GestureBattlerInfo> {
  static info = gestureBattlerInfo;

  constructor(private readonly jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: GestureBattlerTrial): void {
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
    trial: GestureBattlerTrial,
    simulationMode: 'data-only' | 'visual',
    simulationOptions: { data?: Record<string, unknown> },
    onLoad?: () => void,
  ): void {
    onLoad?.();
    this.jsPsych.finishTrial(
      CreateLifecycleSimulationData(trial.module_id, trial.run_token, simulationMode, simulationOptions),
    );
  }

  private finishStartError(trial: GestureBattlerTrial): void {
    const currentTrial = this.jsPsych.getCurrentTrial();
    if (
      currentTrial?.type !== GestureBattlerPlugin
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
