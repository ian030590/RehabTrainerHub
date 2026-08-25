import {
  peripheralAttentionEnConfigLabels,
  peripheralAttentionEnCopy,
  GetPeripheralAttentionEnRuleSections,
} from './en';
import {
  peripheralAttentionZhConfigLabels,
  peripheralAttentionZhCopy,
  GetPeripheralAttentionZhRuleSections,
} from './zh';
import type {
  PeripheralAttentionConfigLabels,
  PeripheralAttentionCopy,
  PeripheralAttentionRuleSection,
} from './types';

export {
  peripheralAttentionEnConfigLabels,
  peripheralAttentionEnCopy,
  GetPeripheralAttentionEnRuleSections,
} from './en';
export {
  peripheralAttentionZhConfigLabels,
  peripheralAttentionZhCopy,
  GetPeripheralAttentionZhRuleSections,
} from './zh';
export type {
  PartialPeripheralAttentionConfigLabels,
  PeripheralAttentionConfigLabels,
  PeripheralAttentionCopy,
  PeripheralAttentionModeLabel,
  PeripheralAttentionModeLabels,
  PeripheralAttentionRuleSection,
  PeripheralAttentionRunMode,
  PeripheralAttentionSubtestLabels,
  PeripheralAttentionTargetAxis,
  // Backward compatibility
  PartialUfovConfigLabels,
  SubtestId,
  UfovConfigLabels,
  UfovCopy,
  UfovModeLabel,
  UfovModeLabels,
  UfovRuleSection,
  UfovRunMode,
  UfovSubtestLabels,
  UfovTargetAxis,
} from './types';

export function GetPeripheralAttentionCopy(lang: 'zh' | 'en'): PeripheralAttentionCopy {
  return lang === 'en' ? peripheralAttentionEnCopy : peripheralAttentionZhCopy;
}

export function GetPeripheralAttentionConfigLabels(lang: 'zh' | 'en'): PeripheralAttentionConfigLabels {
  return lang === 'en' ? peripheralAttentionEnConfigLabels : peripheralAttentionZhConfigLabels;
}

export function GetPeripheralAttentionRuleSections(
  lang: 'zh' | 'en',
  subtestTitle: string,
): PeripheralAttentionRuleSection[] {
  return lang === 'en'
    ? GetPeripheralAttentionEnRuleSections(subtestTitle)
    : GetPeripheralAttentionZhRuleSections(subtestTitle);
}

export const defaultPeripheralAttentionConfigLabels = {
  zh: peripheralAttentionZhConfigLabels,
  en: peripheralAttentionEnConfigLabels,
} as const;

// Backward-compatibility exports
export { GetUfovEnRuleSections } from './en';
export { GetUfovZhRuleSections } from './zh';
export function GetUfovCopy(lang: 'zh' | 'en'): PeripheralAttentionCopy {
  return GetPeripheralAttentionCopy(lang);
}
export function GetUfovConfigLabels(lang: 'zh' | 'en'): PeripheralAttentionConfigLabels {
  return GetPeripheralAttentionConfigLabels(lang);
}
export function GetUfovRuleSections(lang: 'zh' | 'en', subtestTitle: string): PeripheralAttentionRuleSection[] {
  return GetPeripheralAttentionRuleSections(lang, subtestTitle);
}
export const defaultUfovConfigLabels = defaultPeripheralAttentionConfigLabels;
