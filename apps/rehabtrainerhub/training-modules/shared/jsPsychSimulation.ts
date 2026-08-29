/**
 * Build deterministic data for a module-owned jsPsych plugin simulation.
 *
 * Data-only simulation must never call the real module start callback: doing
 * so would load a renderer, request media, or allocate a model during CI.
 * The caller may provide scalar fixture data, but lifecycle identity is always
 * written by this helper so a fixture cannot impersonate another run.
 */
export function CreateLifecycleSimulationData(
  moduleId: string,
  runToken: string,
  simulationMode: 'data-only' | 'visual',
  simulationOptions: { data?: Record<string, unknown> } | undefined,
): Record<string, unknown> {
  const fixtureData = simulationOptions?.data;
  const data: Record<string, unknown> = {};
  if (fixtureData && typeof fixtureData === 'object' && !Array.isArray(fixtureData)) {
    for (const [key, value] of Object.entries(fixtureData)) {
      if (key === 'module_id' || key === 'run_token' || key === 'lifecycle_status' || key === 'simulation_mode') {
        continue;
      }
      data[key] = value;
    }
  }
  return {
    ...data,
    lifecycle_status: 'simulated',
    simulation_mode: simulationMode,
    module_id: moduleId,
    run_token: runToken,
  };
}
