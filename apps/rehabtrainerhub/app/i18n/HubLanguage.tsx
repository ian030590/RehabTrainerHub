'use client';

import { useEffect, type ReactNode } from 'react';
import { CreateLanguageProvider } from '@rehab-trainer/ui/i18n/createLanguageProvider';
import { en } from './en';
import type { HubLocale } from './types';
import { zhTW } from './zh-TW';

export type HubLanguage = 'zh' | 'en';

function FlattenTranslations(value: unknown, prefix = '', target: Record<string, string> = {}) {
  if (!value || typeof value !== 'object') return target;

  for (const [key, child] of Object.entries(value)) {
    const translationKey = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') {
      target[translationKey] = child;
    } else {
      FlattenTranslations(child, translationKey, target);
    }
  }

  return target;
}

const language = CreateLanguageProvider<string>({
  deferInitialLanguageDetection: true,
  dictionaries: {
    zh: FlattenTranslations(zhTW.hubUi),
    en: FlattenTranslations(en.hubUi),
  },
  fallbackLanguage: 'zh',
  storageKey: 'rehab-trainer-hub-language',
});

function HubDocumentLanguage({ children }: { children: ReactNode }) {
  const { lang } = language.useT();

  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant-TW';
    document.documentElement.dataset.locale = lang === 'en' ? 'en' : 'zh-TW';
  }, [lang]);

  return <>{children}</>;
}

export function HubLanguageProvider({ children }: { children: ReactNode }) {
  return (
    <language.LanguageProvider>
      <HubDocumentLanguage>{children}</HubDocumentLanguage>
    </language.LanguageProvider>
  );
}

export function useHubLanguage() {
  const { lang, setLang, t } = language.useT();
  const locale: HubLocale = lang === 'en' ? 'en' : 'zh-TW';
  return { language: lang, locale, setLanguage: setLang, t };
}
