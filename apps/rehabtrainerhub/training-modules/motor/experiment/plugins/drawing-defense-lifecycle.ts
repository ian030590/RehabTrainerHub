import { ParameterType, type JsPsych, type JsPsychPlugin, type TrialType } from 'jspsych';
import { CreateLifecycleSimulationData } from '../../../shared/jsPsychSimulation';

const drawingDefenseInfo = {
  name: 'drawing-defense-lifecycle',
  version: '1.0.0',
  parameters: {
    module_id: {
      type: ParameterType.STRING,
      default: 'motor:drawing-defense',
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

type DrawingDefenseInfo = typeof drawingDefenseInfo;
export type DrawingDefenseTrial = TrialType<DrawingDefenseInfo>;

/**
 * Native jsPsych boundary for Drawing Defense.
 *
 * The plugin owns the formal trial lifecycle only. Pixi, pointer input and
 * game state remain in the module component and are never retained here.
 * The component completes this trial through jsPsych.finishTrial() or
 * aborts it through jsPsych.abortExperiment().
 */
export class DrawingDefensePlugin implements JsPsychPlugin<DrawingDefenseInfo> {
  static info = drawingDefenseInfo;

  constructor(private readonly jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: DrawingDefenseTrial): void {
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
    trial: DrawingDefenseTrial,
    simulationMode: 'data-only' | 'visual',
    simulationOptions: { data?: Record<string, unknown> },
    onLoad?: () => void,
  ): void {
    onLoad?.();
    this.jsPsych.finishTrial(
      CreateLifecycleSimulationData(trial.module_id, trial.run_token, simulationMode, simulationOptions),
    );
  }

  private finishStartError(trial: DrawingDefenseTrial): void {
    const currentTrial = this.jsPsych.getCurrentTrial();
    if (
      currentTrial?.type !== DrawingDefensePlugin
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
