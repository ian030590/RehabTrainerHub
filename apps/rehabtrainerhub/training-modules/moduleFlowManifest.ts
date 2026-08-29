import {
  AssertTrainingModuleManifest,
  type TrainingCapability,
  type TrainingModuleManifest,
} from '@rehab-trainer/training-contracts';

export const standardTrainingFlow = [
  'card',
  'config',
  'rules',
  'training',
  'results',
] as const;

export type TrainingFlowStep = (typeof standardTrainingFlow)[number];
export type TrainingMediaPermission =
  | 'none'
  | 'camera'
  | 'camera-optional'
  | 'camera-or-microphone';

export type TrainingJsPsychLifecycle =
  | 'native-timeline'
  | 'external-runtime-adapter';

export interface TrainingModuleFlowManifestEntry {
  purposeId: string;
  flow: readonly TrainingFlowStep[];
  jsPsychLifecycle: TrainingJsPsychLifecycle;
  mediaPermission: TrainingMediaPermission;
  sourcePath: string;
}

const referenceCognitiveIds = [
  'brain:reaction-time',
  'brain:whack-a-mole',
  'brain:memory-match',
  'brain:simon-says',
  'brain:lights-out',
  'brain:sliding-puzzle',
  'brain:sudoku',
  'brain:tic-tac-toe',
  'brain:connect4',
  'brain:dots-and-boxes',
  'brain:hex',
  'brain:maze',
] as const;

// Keep category copy and lifecycle metadata independent, but make the
// purpose mapping explicit. A domain is not a purpose: brain modules, for
// example, cover attention, memory, and higher cognition.
const purposeByCatalogId: Readonly<Record<string, string>> = Object.freeze({
  'motor:drawing-defense': 'upper-limb',
  'motor:asteroid-shield': 'upper-limb',
  'motor:gesture-battler': 'upper-limb',
  'motor:motor-cortex-rehab': 'upper-limb',
  'vision:moving-card': 'vision',
  'vision:oculomotor-training': 'vision',
  'vision:gabor-patching': 'vision',
  'vision:reading-training': 'vision',
  'vision:driving-rehab': 'vision',
  'vision:hart-chart': 'vision',
  'brain:ufov': 'attention',
  'brain:every-ball-response': 'attention',
  'brain:minesweeper': 'higher-cognition',
  'brain:reaction-time': 'attention',
  'brain:whack-a-mole': 'attention',
  'brain:memory-match': 'memory',
  'brain:simon-says': 'memory',
  'brain:lights-out': 'higher-cognition',
  'brain:sliding-puzzle': 'higher-cognition',
  'brain:sudoku': 'higher-cognition',
  'brain:tic-tac-toe': 'higher-cognition',
  'brain:connect4': 'higher-cognition',
  'brain:dots-and-boxes': 'higher-cognition',
  'brain:hex': 'higher-cognition',
  'brain:maze': 'higher-cognition',
  'mouth:tongue-catch': 'oral',
});

export const trainingModuleImplementationVersion = '1.0.0' as const;

const manifestEntries: ReadonlyArray<readonly [
  catalogId: string,
  sourcePath: string,
  mediaPermission?: TrainingMediaPermission,
  jsPsychLifecycle?: TrainingJsPsychLifecycle,
]> = [
  ['motor:drawing-defense', 'motor/pages/training/DrawingTowerDefenseGame.tsx', 'none', 'external-runtime-adapter'],
  ['motor:asteroid-shield', 'motor/pages/training/AsteroidShieldGame.tsx', 'camera-optional', 'external-runtime-adapter'],
  ['motor:gesture-battler', 'motor/pages/training/GestureBattlerGame.tsx', 'camera', 'external-runtime-adapter'],
  ['motor:motor-cortex-rehab', 'motor/pages/training/MotorCortexRehabGame.tsx', 'camera', 'external-runtime-adapter'],
  ['vision:moving-card', 'vision/experiment/plugins/pixi-moving-card.ts', 'none', 'native-timeline'],
  ['vision:oculomotor-training', 'vision/experiment/plugins/pixi-oculomotor-training.ts', 'camera-optional', 'native-timeline'],
  ['vision:gabor-patching', 'vision/experiment/plugins/pixi-gabor-patching.ts', 'none', 'native-timeline'],
  ['vision:reading-training', 'vision/experiment/plugins/pixi-reading-training.ts', 'none', 'native-timeline'],
  ['vision:driving-rehab', 'vision/experiment/plugins/three-driving-rehab.ts', 'none', 'native-timeline'],
  ['vision:hart-chart', 'vision/pages/training/HartChartPage.tsx', 'none', 'external-runtime-adapter'],
  ['brain:ufov', 'brain/pages/PeripheralAttentionPage.tsx', 'none', 'native-timeline'],
  ['brain:every-ball-response', 'brain/pages/EveryBallResponsePage.tsx', 'camera-or-microphone', 'native-timeline'],
  ['brain:minesweeper', 'brain/pages/thinking/MinesweeperGame.tsx', 'none', 'external-runtime-adapter'],
  ...referenceCognitiveIds.map((catalogId) => (
    [catalogId, 'brain/pages/thinking/ReferenceCognitiveGame.tsx', 'none', 'external-runtime-adapter'] as const
  )),
  ['mouth:tongue-catch', 'mouth/pages/training/TongueCatchGame.tsx', 'camera', 'external-runtime-adapter'],
];

export const trainingModuleFlowManifest: Readonly<Record<
  string,
  TrainingModuleFlowManifestEntry
>> = Object.fromEntries(manifestEntries.map(([
  catalogId,
  sourcePath,
  mediaPermission = 'none',
  jsPsychLifecycle = 'external-runtime-adapter',
]) => [
  catalogId,
  {
    purposeId: purposeByCatalogId[catalogId],
    flow: standardTrainingFlow,
    jsPsychLifecycle,
    mediaPermission,
    sourcePath,
  },
]));

function GetManifestCapabilities(mediaPermission: TrainingMediaPermission): readonly TrainingCapability[] {
  // Every official training surface can enter its module-owned fullscreen
  // target and may play local feedback audio. Camera/microphone are added
  // only when the flow explicitly declares them.
  const capabilities: TrainingCapability[] = ['audio', 'fullscreen', 'pointer', 'keyboard'];
  if (mediaPermission === 'camera-or-microphone') capabilities.push('camera', 'microphone');
  else if (mediaPermission === 'camera' || mediaPermission === 'camera-optional') capabilities.push('camera');
  return capabilities;
}

function BuildTrainingModuleManifest(
  catalogId: string,
  mediaPermission: TrainingMediaPermission,
  jsPsychLifecycle: TrainingJsPsychLifecycle,
  catalogOrder: number,
): TrainingModuleManifest {
  const [domain, slug] = catalogId.split(':');
  const purposeId = purposeByCatalogId[catalogId];
  if (!purposeId) throw new Error(`Missing purpose mapping for ${catalogId}.`);
  const lifecycleMode = jsPsychLifecycle === 'native-timeline'
    ? 'native-timeline'
    : 'legacy-adapter-exempt';
  return AssertTrainingModuleManifest({
    schemaVersion: 1,
    id: catalogId,
    implementationVersion: trainingModuleImplementationVersion,
    purposeId,
    catalogOrder,
    titleKey: `training.${slug}.title`,
    descriptionKey: `training.${slug}.description`,
    themeToken: purposeId,
    capabilities: GetManifestCapabilities(mediaPermission),
    flow: standardTrainingFlow,
    lifecycle: { owner: 'jspsych', mode: lifecycleMode },
    pwa: {
      installable: true,
      shortNameKey: `training.${slug}.shortName`,
      orientation: 'any',
      iconAssetIds: [`brand-${domain}`],
    },
    assets: [],
  });
}

export const trainingModuleManifests: Readonly<Record<string, TrainingModuleManifest>> = Object.fromEntries(
  manifestEntries.map(([catalogId, , mediaPermission = 'none', jsPsychLifecycle = 'external-runtime-adapter'], catalogOrder) => [
    catalogId,
    BuildTrainingModuleManifest(catalogId, mediaPermission, jsPsychLifecycle, catalogOrder),
  ]),
);

export interface TrainingRegistryEntry {
  manifest: TrainingModuleManifest;
  sourcePath: string;
}

export const trainingModuleRegistry: Readonly<Record<string, TrainingRegistryEntry>> = Object.freeze(
  Object.fromEntries(Object.entries(trainingModuleManifests).map(([catalogId, manifest]) => [
    catalogId,
    Object.freeze({
      manifest,
      sourcePath: trainingModuleFlowManifest[catalogId].sourcePath,
    }),
  ])),
);

export function GetTrainingModuleManifest(catalogId: string): TrainingModuleManifest {
  const manifest = trainingModuleManifests[catalogId];
  if (!manifest) {
    throw new Error(`Missing Hub training-module manifest for ${catalogId}.`);
  }
  return manifest;
}

export function GetTrainingModuleFlowManifest(
  catalogId: string,
): TrainingModuleFlowManifestEntry {
  const manifest = trainingModuleFlowManifest[catalogId];
  if (!manifest) {
    throw new Error(`Missing Hub training-module flow manifest for ${catalogId}.`);
  }
  return manifest;
}

export function GetTrainingModulePurposeId(catalogId: string): string {
  const purposeId = purposeByCatalogId[catalogId];
  if (!purposeId) throw new Error(`Missing purpose mapping for ${catalogId}.`);
  return purposeId;
}
