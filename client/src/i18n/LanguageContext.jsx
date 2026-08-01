import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import fr from './fr';
import { formatMessage, readStoredLang, writeStoredLang } from './storage';

const LanguageContext = createContext(null);

const DICTS = {
  en: {},
  fr
};

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => readStoredLang());

  const setLang = useCallback((next) => {
    const normalized = next === 'fr' || next === 'FR' ? 'fr' : 'en';
    setLangState(normalized);
    writeStoredLang(normalized);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'fr' ? 'en' : 'fr');
  }, [lang, setLang]);

  const t = useCallback(
    (key, vars) => {
      if (key == null || key === '') return '';
      const source = String(key);
      const dict = DICTS[lang] || {};
      const translated = lang === 'en' ? source : dict[source] ?? source;
      return formatMessage(translated, vars);
    },
    [lang]
  );

  useEffect(() => {
    document.documentElement.lang = lang === 'fr' ? 'fr' : 'en';
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      toggleLang,
      t,
      isFr: lang === 'fr'
    }),
    [lang, setLang, toggleLang, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

/** Safe hook for optional usage — returns identity t() outside provider. */
export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return (key, vars) => formatMessage(String(key ?? ''), vars);
  }
  return ctx.t;
}

/** Locale for number/date formatting; safe outside LanguageProvider. */
export function useLocale() {
  const ctx = useContext(LanguageContext);
  return ctx?.lang === 'fr' ? 'fr-FR' : 'en-US';
}
