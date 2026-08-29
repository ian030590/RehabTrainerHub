import { ParameterType, type JsPsych, type JsPsychPlugin, type TrialType } from 'jspsych';
import { CreateLifecycleSimulationData } from '../../../shared/jsPsychSimulation';

const asteroidShieldInfo = {
  name: 'asteroid-shield-lifecycle',
  version: '1.0.0',
  parameters: {
    module_id: {
      type: ParameterType.STRING,
      default: 'motor:asteroid-shield',
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

type AsteroidShieldInfo = typeof asteroidShieldInfo;
export type AsteroidShieldTrial = TrialType<AsteroidShieldInfo>;

/** Native jsPsych lifecycle boundary for Asteroid Shield. */
export class AsteroidShieldPlugin implements JsPsychPlugin<AsteroidShieldInfo> {
  static info = asteroidShieldInfo;

  constructor(private readonly jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: AsteroidShieldTrial): void {
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
    trial: AsteroidShieldTrial,
    simulationMode: 'data-only' | 'visual',
    simulationOptions: { data?: Record<string, unknown> },
    onLoad?: () => void,
  ): void {
    onLoad?.();
    this.jsPsych.finishTrial(
      CreateLifecycleSimulationData(trial.module_id ?? 'motor:asteroid-shield', trial.run_token ?? '', simulationMode, simulationOptions),
    );
  }

  private finishStartError(trial: AsteroidShieldTrial): void {
    const currentTrial = this.jsPsych.getCurrentTrial();
    if (
      currentTrial?.type !== AsteroidShieldPlugin
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
