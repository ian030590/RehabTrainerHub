import {
  AssertTrainingModuleManifest,
  trainingRunResultFields,
  type TrainingCapability,
  type TrainingModuleManifest,
} from '@rehab-trainer/training-contracts';
import { officialTrainingHostRoutePrefix } from '@rehab-trainer/ui/officialTrainingHostPolicy';

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

export type TrainingLifecycleExemption = 'hart-chart' | 'driving-simulation';

/**
 * Build-time asset groups owned by a module. The group is deliberately a
 * stable capability name rather than an URL: the platform asset manifest is
 * the only place that resolves it to versioned, hashed bytes.
 */
export type TrainingRuntimeAssetGroup =
  | 'mediapipe-wasm'
  | 'mediapipe-hand'
  | 'mediapipe-face'
  | 'mediapipe-pose'
  | 'webgazer'
  | 'star-sky'
  | 'asteroid-shield-sprites'
  | 'tongue-catch-sprites'
  | 'reference-car';

export interface TrainingModuleFlowManifestEntry {
  purposeId: string;
  flow: readonly TrainingFlowStep[];
  jsPsychLifecycle: TrainingJsPsychLifecycle;
  lifecycleExemption?: TrainingLifecycleExemption;
  mediaPermission: TrainingMediaPermission;
  runtimeAssetGroups: readonly TrainingRuntimeAssetGroup[];
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

// Module-owned declarations keep the PWA generator independent from game
// identifiers. Runtime URLs and hashes are resolved from the platform's
// versioned R2 manifest during the build; a module never embeds a CDN URL.
const runtimeAssetGroupsByCatalogId: Readonly<Record<string, readonly TrainingRuntimeAssetGroup[]>> = Object.freeze({
  'motor:drawing-defense': ['star-sky'],
  'motor:asteroid-shield': ['mediapipe-wasm', 'mediapipe-hand', 'asteroid-shield-sprites'],
  'motor:gesture-battler': ['mediapipe-wasm', 'mediapipe-hand'],
  'motor:motor-cortex-rehab': ['mediapipe-wasm', 'mediapipe-hand'],
  'vision:oculomotor-training': ['webgazer'],
  'vision:driving-rehab': ['reference-car'],
  'brain:every-ball-response': ['mediapipe-wasm', 'mediapipe-hand', 'mediapipe-pose'],
  'mouth:tongue-catch': ['mediapipe-wasm', 'mediapipe-face', 'tongue-catch-sprites'],
});

export const trainingModuleImplementationVersion = '1.0.0' as const;

const manifestEntries: ReadonlyArray<readonly [
  catalogId: string,
  sourcePath: string,
  mediaPermission?: TrainingMediaPermission,
  jsPsychLifecycle?: TrainingJsPsychLifecycle,
  lifecycleExemption?: TrainingLifecycleExemption,
]> = [
  ['motor:drawing-defense', 'motor/pages/training/DrawingTowerDefenseGame.tsx', 'none', 'native-timeline'],
  ['motor:asteroid-shield', 'motor/pages/training/AsteroidShieldGame.tsx', 'camera-optional', 'native-timeline'],
  ['motor:gesture-battler', 'motor/pages/training/GestureBattlerGame.tsx', 'camera', 'native-timeline'],
  ['motor:motor-cortex-rehab', 'motor/pages/training/MotorCortexRehabGame.tsx', 'camera', 'native-timeline'],
  ['vision:moving-card', 'vision/experiment/plugins/pixi-moving-card.ts', 'none', 'native-timeline'],
  ['vision:oculomotor-training', 'vision/experiment/plugins/pixi-oculomotor-training.ts', 'camera-optional', 'native-timeline'],
  ['vision:gabor-patching', 'vision/experiment/plugins/pixi-gabor-patching.ts', 'none', 'native-timeline'],
  ['vision:reading-training', 'vision/experiment/plugins/pixi-reading-training.ts', 'none', 'native-timeline'],
  ['vision:driving-rehab', 'vision/experiment/plugins/three-driving-rehab.ts', 'none', 'native-timeline', 'driving-simulation'],
  ['vision:hart-chart', 'vision/pages/training/HartChartPage.tsx', 'none', 'external-runtime-adapter', 'hart-chart'],
  ['brain:ufov', 'brain/pages/PeripheralAttentionPage.tsx', 'none', 'native-timeline'],
  ['brain:every-ball-response', 'brain/pages/EveryBallResponsePage.tsx', 'camera-or-microphone', 'native-timeline'],
  ['brain:minesweeper', 'brain/pages/thinking/MinesweeperGame.tsx', 'none', 'external-runtime-adapter'],
  ...referenceCognitiveIds.map((catalogId) => (
    [catalogId, 'brain/pages/thinking/ReferenceCognitiveGame.tsx', 'none', 'external-runtime-adapter'] as const
  )),
  ['mouth:tongue-catch', 'mouth/pages/training/TongueCatchGame.tsx', 'camera', 'native-timeline'],
];

export const trainingModuleFlowManifest: Readonly<Record<
  string,
  TrainingModuleFlowManifestEntry
>> = Object.freeze(Object.fromEntries(manifestEntries.map(([
  catalogId,
  sourcePath,
  mediaPermission = 'none',
  jsPsychLifecycle = 'external-runtime-adapter',
  lifecycleExemption = undefined,
]) => [
  catalogId,
  {
    purposeId: purposeByCatalogId[catalogId],
    flow: standardTrainingFlow,
    jsPsychLifecycle,
    ...(lifecycleExemption ? { lifecycleExemption } : {}),
    mediaPermission,
    runtimeAssetGroups: Object.freeze([...(runtimeAssetGroupsByCatalogId[catalogId] ?? [])]),
    sourcePath,
  },
])));

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

export const trainingModuleManifests: Readonly<Record<string, TrainingModuleManifest>> = Object.freeze(Object.fromEntries(
  manifestEntries.map(([catalogId, , mediaPermission = 'none', jsPsychLifecycle = 'external-runtime-adapter'], catalogOrder) => [
    catalogId,
    BuildTrainingModuleManifest(catalogId, mediaPermission, jsPsychLifecycle, catalogOrder),
  ]),
));

export interface TrainingRegistryEntry {
  manifest: TrainingModuleManifest;
  sourcePath: string;
  hostPath: string;
  officialPwa: {
    scope: string;
    manifestPath: string;
    serviceWorkerPath: string;
    offlineManifestPathPrefix: string;
  };
  recordAllowlist: readonly string[];
  testIds: readonly string[];
}

function BuildTrainingRegistryEntry(
  catalogId: string,
  manifest: TrainingModuleManifest,
): TrainingRegistryEntry {
  const [domain, slug] = catalogId.split(':');
  const hostPath = `${officialTrainingHostRoutePrefix}/${encodeURIComponent(domain)}/${encodeURIComponent(slug)}/`;
  const gameScope = `/games/${encodeURIComponent(slug)}/`;
  return Object.freeze({
    manifest,
    sourcePath: trainingModuleFlowManifest[catalogId].sourcePath,
    hostPath,
    officialPwa: Object.freeze({
      scope: gameScope,
      manifestPath: `${gameScope}manifest.webmanifest`,
      serviceWorkerPath: `${gameScope}sw.js`,
      offlineManifestPathPrefix: `/offline-manifests/${encodeURIComponent(slug)}/`,
    }),
    recordAllowlist: trainingRunResultFields,
    testIds: Object.freeze([
      `training-flow:${catalogId}`,
      `training-lifecycle:${catalogId}`,
      `official-pwa:${catalogId}`,
    ]),
  });
}

export const trainingModuleRegistry: Readonly<Record<string, TrainingRegistryEntry>> = Object.freeze(
  Object.fromEntries(Object.entries(trainingModuleManifests).map(([catalogId, manifest]) => [
    catalogId,
    BuildTrainingRegistryEntry(catalogId, manifest),
  ])),
);

export function GetTrainingModuleRegistryEntry(catalogId: string): TrainingRegistryEntry {
  const entry = trainingModuleRegistry[catalogId];
  if (!entry) throw new Error(`Missing Hub training-module registry entry for ${catalogId}.`);
  return entry;
}

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
