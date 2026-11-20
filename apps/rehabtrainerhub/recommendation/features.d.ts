export type TagGroup = 'function' | 'taskDemand';
export type TagLevel = 0 | 1 | 2;
export type ReviewStatus = 'draft' | 'confirmed';

interface LocalizedText {
  readonly 'zh-TW': string;
  readonly en: string;
}

export interface Taxonomy {
  readonly taxonomyVersion: string;
  readonly frameworks: readonly {
    readonly id: string;
    readonly name: string;
    readonly citation: string;
    readonly edition?: string;
    readonly url?: string;
  }[];
  readonly icfCodes: readonly { readonly code: string; readonly title: LocalizedText }[];
  readonly dimensions: readonly {
    readonly id: string;
    readonly group: TagGroup;
    readonly frameworkId: string;
    readonly labels: LocalizedText;
    readonly selection: 'single' | 'multiple';
    readonly required: boolean;
  }[];
  readonly tags: readonly {
    readonly id: string;
    readonly dimension: string;
    readonly parent?: string;
    readonly icfCode?: string;
    readonly labels: LocalizedText;
    readonly definition: LocalizedText;
    readonly status: 'active' | 'deprecated';
    readonly replacementTagId?: string;
    readonly requiresAnyCapability?: readonly string[];
  }[];
  readonly capabilities: readonly {
    readonly id: string;
    readonly labels: LocalizedText;
    readonly auxiliary?: boolean;
  }[];
}

export type TagLevels = Readonly<Partial<Record<string, TagLevel>>>;

export interface GameFeature {
  readonly reviewStatus: ReviewStatus;
  readonly functionTags: TagLevels;
  readonly taskDemandTags: TagLevels;
  readonly evidence: Readonly<Partial<Record<string, string>>>;
  readonly supportedSetups: readonly { readonly id: string; readonly allCapabilities: readonly string[] }[];
}

export interface GameFeatures {
  readonly schemaVersion: 2;
  readonly taxonomyVersion: string;
  readonly games: Readonly<Record<string, GameFeature>>;
}

export interface Similarity {
  score: number | null;
  function: number | null;
  taskDemand: number | null;
  coverage: Record<TagGroup, number | null>;
}

export interface SimilarGame {
  gameId: string;
  score: number;
  sharedTags: string[];
}

export const featureSpaceVersion: string;
export const similarityWeights: Readonly<Record<TagGroup, number>>;
export const lobbySimilarityThreshold: number;

type Validation = { ok: true; errors: [] } | { ok: false; errors: string[] };

export function ValidateTaxonomy(taxonomy: unknown): Validation;

export function ValidateRecommendationData(
  taxonomy: unknown,
  gameFeatures: unknown,
  catalog: readonly {
    readonly id: string;
    readonly mediaPermission: 'none' | 'camera' | 'camera-optional' | 'camera-or-microphone';
  }[],
): Validation;

export function DeriveTagLevels(taxonomy: Taxonomy, tags: TagLevels): TagLevels;

export function GameSimilarity(taxonomy: Taxonomy, a: GameFeature, b: GameFeature): Similarity;

export function RankSimilarGames(taxonomy: Taxonomy, gameFeatures: GameFeatures, gameId: string): Omit<SimilarGame, 'sharedTags'>[];

export function SimilarGames(
  taxonomy: Taxonomy,
  gameFeatures: GameFeatures,
  gameId: string,
  options?: { limit?: number },
): SimilarGame[];
