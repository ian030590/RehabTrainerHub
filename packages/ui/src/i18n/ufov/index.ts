import { ufovEnConfigLabels, ufovEnCopy, GetUfovEnRuleSections } from './en';
import { ufovZhConfigLabels, ufovZhCopy, GetUfovZhRuleSections } from './zh';
import type {
  UfovConfigLabels,
  UfovCopy,
  UfovRuleSection,
} from './types';

export { ufovEnConfigLabels, ufovEnCopy, GetUfovEnRuleSections } from './en';
export { ufovZhConfigLabels, ufovZhCopy, GetUfovZhRuleSections } from './zh';
export type {
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

export function GetUfovCopy(lang: 'zh' | 'en'): UfovCopy {
  return lang === 'en' ? ufovEnCopy : ufovZhCopy;
}

export function GetUfovConfigLabels(lang: 'zh' | 'en'): UfovConfigLabels {
  return lang === 'en' ? ufovEnConfigLabels : ufovZhConfigLabels;
}

export function GetUfovRuleSections(lang: 'zh' | 'en', subtestTitle: string): UfovRuleSection[] {
  return lang === 'en' ? GetUfovEnRuleSections(subtestTitle) : GetUfovZhRuleSections(subtestTitle);
}

export const defaultUfovConfigLabels = {
  zh: ufovZhConfigLabels,
  en: ufovEnConfigLabels,
} as const;
