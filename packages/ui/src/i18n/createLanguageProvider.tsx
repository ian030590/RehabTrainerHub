import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type SupportedLanguage = 'zh' | 'en';

export interface LanguageContextValue<TKey extends string> {
  lang: SupportedLanguage;
  setLang: (lang: SupportedLanguage) => void;
  t: (key: TKey, params?: Record<string, string | number>) => string;
}

export interface CreateLanguageProviderOptions<TKey extends string> {
  dictionaries: Record<SupportedLanguage, Readonly<Record<TKey, string>>>;
  storageKey: string;
  fallbackLanguage?: SupportedLanguage;
}

function IsSupportedLanguage(value: string | null): value is SupportedLanguage {
  return value === 'zh' || value === 'en';
}

function DetectPreferredLanguage(fallbackLanguage: SupportedLanguage): SupportedLanguage {
  if (typeof navigator === 'undefined') return fallbackLanguage;

  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    if (normalized.startsWith('zh')) return 'zh';
    if (normalized.startsWith('en')) return 'en';
  }
  return fallbackLanguage;
}

function ReadStoredLanguage(storageKey: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function WriteStoredLanguage(storageKey: string, lang: SupportedLanguage) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, lang);
  } catch {
    // The current language still updates in memory when storage is unavailable.
  }
}

export function CreateLanguageProvider<TKey extends string>({
  dictionaries,
  fallbackLanguage = 'zh',
  storageKey,
}: CreateLanguageProviderOptions<TKey>) {
  const languageContext = createContext<LanguageContextValue<TKey> | undefined>(undefined);

  function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<SupportedLanguage>(() => {
      const saved = ReadStoredLanguage(storageKey);
      return IsSupportedLanguage(saved) ? saved : DetectPreferredLanguage(fallbackLanguage);
    });

    const setLang = useCallback((newLang: SupportedLanguage) => {
      setLangState(newLang);
      WriteStoredLanguage(storageKey, newLang);
    }, [storageKey]);

    const t = useCallback((key: TKey, params?: Record<string, string | number>): string => {
      let text = dictionaries[lang][key];
      if (!text) return key;

      if (params) {
        Object.entries(params).forEach(([paramKey, value]) => {
          text = text.replaceAll(`{${paramKey}}`, String(value));
        });
      }

      return text;
    }, [dictionaries, lang]);

    const contextValue = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

    return (
      <languageContext.Provider value={contextValue}>
        {children}
      </languageContext.Provider>
    );
  }

  function useT() {
    const context = useContext(languageContext);
    if (!context) {
      throw new Error('useT must be used within a LanguageProvider');
    }
    return context;
  }

  return { LanguageProvider, useT };
}
