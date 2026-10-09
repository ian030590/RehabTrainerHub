import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { dictionaries } from './index';
import { GetGameLanguage } from '../runtime/hubBridge';
export type TranslationKey = keyof typeof dictionaries.zh;
const languageContext = createContext<'zh' | 'en'>('zh');
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<'zh' | 'en'>(GetGameLanguage() ?? (new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh'));
  useEffect(() => {
    const change = (event: Event) => setLang((event as CustomEvent).detail === 'en' ? 'en' : 'zh');
    window.addEventListener('game:language', change);
    const initialized = GetGameLanguage();
    if (initialized) setLang(initialized);
    return () => window.removeEventListener('game:language', change);
  }, []);
  return <languageContext.Provider value={lang}>{children}</languageContext.Provider>;
}
export function useT() {
  const lang = useContext(languageContext);
  const t = useCallback((key: TranslationKey, values?: Record<string, string | number>) => {
    let text: string = dictionaries[lang][key] ?? key;
    for (const [name, value] of Object.entries(values ?? {})) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  }, [lang]);
  return { lang, t };
}
