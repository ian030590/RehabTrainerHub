export type TrainerCategoryId = 'motor' | 'mouth' | 'brain' | 'vision';
export type TrainingPurposeTagId =
  | 'upper-limb'
  | 'lower-limb'
  | 'vision'
  | 'attention'
  | 'memory'
  | 'higher-cognition'
  | 'language'
  | 'oral';

export interface TrainerCategoryTag {
  readonly id: TrainerCategoryId;
  readonly label: Readonly<{ 'zh-TW': string; en: string }>;
  readonly themePurposeId: TrainingPurposeTagId;
}

export const trainerCategoryTags: readonly TrainerCategoryTag[];
export const trainerCategoryIds: readonly TrainerCategoryId[];
export const trainingPurposeTrainerIds: Readonly<Record<TrainingPurposeTagId, TrainerCategoryId>>;
export const trainingPurposeIds: readonly TrainingPurposeTagId[];

export function GetTrainerCategoryTag(value: unknown): TrainerCategoryTag | null;
export function GetTrainingPurposeTrainerId(value: unknown): TrainerCategoryId | null;
export function IsTrainerCategoryId(value: unknown): value is TrainerCategoryId;
export function IsTrainingPurposeId(value: unknown): value is TrainingPurposeTagId;
export function IsGameTagPair(trainer: unknown, purpose: unknown): boolean;

export type MajorCategoryId = TrainerCategoryId;
export type MajorCategoryTag = TrainerCategoryTag;

export const categorySubcategories: Readonly<Record<TrainerCategoryId, readonly TrainingPurposeTagId[]>>;
export const majorCategoryTags: readonly TrainerCategoryTag[];
export const majorCategoryIds: readonly TrainerCategoryId[];
export const trainingCategorySubcategories: Readonly<Record<TrainerCategoryId, readonly TrainingPurposeTagId[]>>;

export function GetCategorySubcategories(categoryId: unknown): readonly TrainingPurposeTagId[];
export function GetSubcategoryCategoryTag(purposeId: unknown): TrainerCategoryTag | null;
