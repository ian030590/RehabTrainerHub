import type { TrainingSetupLoader } from '@rehab-trainer/ui/trainingHostContract';

/**
 * Build-time registry for native setup chunks. Keep this map dependency-light:
 * an entry may point at a module setup file, but that file must defer jsPsych,
 * Pixi, Three, MediaPipe, TensorFlow, WebGazer and model imports to
 * `loadEngine`. The official host imports this registry without pulling any
 * renderer into its entry chunk.
 */
const setupLoaders: Readonly<Record<string, TrainingSetupLoader>> = Object.freeze({
  'motor:drawing-defense': () => import('../motor/drawing-defense/setup').then(
    (module) => module.default as unknown as Awaited<ReturnType<TrainingSetupLoader>>,
  ),
  'motor:asteroid-shield': () => import('../motor/asteroid-shield/setup').then(
    (module) => module.default as unknown as Awaited<ReturnType<TrainingSetupLoader>>,
  ),
  'motor:gesture-battler': () => import('../motor/gesture-battler/setup').then(
    (module) => module.default as unknown as Awaited<ReturnType<TrainingSetupLoader>>,
  ),
  'motor:motor-cortex-rehab': () => import('../motor/motor-cortex-rehab/setup').then(
    (module) => module.default as unknown as Awaited<ReturnType<TrainingSetupLoader>>,
  ),
  'mouth:tongue-catch': () => import('../mouth/tongue-catch/setup').then(
    (module) => module.default as unknown as Awaited<ReturnType<TrainingSetupLoader>>,
  ),
  'vision:moving-card': () => import('../vision/moving-card/setup').then(
    (module) => module.default as unknown as Awaited<ReturnType<TrainingSetupLoader>>,
  ),
  'vision:oculomotor-training': () => import('../vision/oculomotor/setup').then(
    (module) => module.default as unknown as Awaited<ReturnType<TrainingSetupLoader>>,
  ),
  'vision:gabor-patching': () => import('../vision/gabor-patching/setup').then(
    (module) => module.default as unknown as Awaited<ReturnType<TrainingSetupLoader>>,
  ),
  'vision:reading-training': () => import('../vision/reading-training/setup').then(
    (module) => module.default as unknown as Awaited<ReturnType<TrainingSetupLoader>>,
  ),
  'brain:ufov': () => import('../brain/ufov/setup').then(
    (module) => module.default as unknown as Awaited<ReturnType<TrainingSetupLoader>>,
  ),
  'brain:every-ball-response': () => import('../brain/every-ball-response/setup').then(
    (module) => module.default as unknown as Awaited<ReturnType<TrainingSetupLoader>>,
  ),
});

export function GetTrainingSetupLoader(moduleId: string): TrainingSetupLoader | null {
  return setupLoaders[moduleId] ?? null;
}

export function HasTrainingSetup(moduleId: string): boolean {
  return Object.hasOwn(setupLoaders, moduleId);
}

export const trainingSetupModuleIds = Object.freeze(Object.keys(setupLoaders));
