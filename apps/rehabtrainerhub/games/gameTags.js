export const trainerCategoryTags = Object.freeze([
  Object.freeze({
    id: 'motor',
    label: Object.freeze({ 'zh-TW': '動作活動', en: 'Motor' }),
    themePurposeId: 'upper-limb',
  }),
  Object.freeze({
    id: 'mouth',
    label: Object.freeze({ 'zh-TW': '口腔活動', en: 'Mouth' }),
    themePurposeId: 'oral',
  }),
  Object.freeze({
    id: 'brain',
    label: Object.freeze({ 'zh-TW': '認知活動', en: 'Brain' }),
    themePurposeId: 'higher-cognition',
  }),
  Object.freeze({
    id: 'vision',
    label: Object.freeze({ 'zh-TW': '視覺活動', en: 'Vision' }),
    themePurposeId: 'vision',
  }),
]);

export const trainerCategoryIds = Object.freeze(
  trainerCategoryTags.map(({ id }) => id),
);

export const trainingPurposeTrainerIds = Object.freeze({
  'upper-limb': 'motor',
  'lower-limb': 'motor',
  vision: 'vision',
  attention: 'brain',
  memory: 'brain',
  'higher-cognition': 'brain',
  language: 'brain',
  oral: 'mouth',
});

export const trainingPurposeIds = Object.freeze(
  Object.keys(trainingPurposeTrainerIds),
);

export function GetTrainerCategoryTag(value) {
  return trainerCategoryTags.find(({ id }) => id === value) ?? null;
}

export function GetTrainingPurposeTrainerId(value) {
  return typeof value === 'string'
    ? trainingPurposeTrainerIds[value] ?? null
    : null;
}

export function IsTrainerCategoryId(value) {
  return GetTrainerCategoryTag(value) !== null;
}

export function IsTrainingPurposeId(value) {
  return GetTrainingPurposeTrainerId(value) !== null;
}

export function IsGameTagPair(trainer, purpose) {
  return IsTrainerCategoryId(trainer)
    && GetTrainingPurposeTrainerId(purpose) === trainer;
}

export const categorySubcategories = Object.freeze({
  motor: Object.freeze(['upper-limb', 'lower-limb']),
  vision: Object.freeze(['vision']),
  brain: Object.freeze(['attention', 'memory', 'higher-cognition', 'language']),
  mouth: Object.freeze(['oral']),
});

export const majorCategoryTags = trainerCategoryTags;
export const majorCategoryIds = trainerCategoryIds;
export const trainingCategorySubcategories = categorySubcategories;

export function GetCategorySubcategories(categoryId) {
  return categorySubcategories[categoryId] ?? Object.freeze([]);
}

export function GetSubcategoryCategoryTag(purposeId) {
  const trainerId = GetTrainingPurposeTrainerId(purposeId);
  return trainerId ? GetTrainerCategoryTag(trainerId) : null;
}
