import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { dictionary } from './index';
import { GetGameLanguage } from '../runtime/hubBridge';

const languageContext = createContext<'zh' | 'en'>('zh');

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<'en' | 'zh'>(() =>
    navigator.language.startsWith('en') ? 'en' : 'zh',
  );
  useEffect(() => {
    const update = () => {
      const language = GetGameLanguage();
      if (language) setLang(language);
    };
    window.addEventListener('game:language', update);
    update();
    return () => window.removeEventListener('game:language', update);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-TW';
    document.title = dictionary[lang].title;
  }, [lang]);
  return <languageContext.Provider value={lang}>{children}</languageContext.Provider>;
}

export function useT() {
  const lang = useContext(languageContext);
  return { lang, copy: dictionary[lang] };
}
