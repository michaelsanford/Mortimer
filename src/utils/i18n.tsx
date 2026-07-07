import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { en } from '../locales/en';
import { fr } from '../locales/fr';

export type Locale = 'en' | 'fr';

// Recursively convert literal string types to string
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type Translations = DeepStringify<typeof en>;

const locales: Record<Locale, Translations> = { 
  en, 
  fr 
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLocale(): Locale {
  // Check localStorage first for user preference
  const stored = localStorage.getItem('mortimer_locale');
  const validLocales: Locale[] = ['en', 'fr'];
  if (stored && validLocales.includes(stored as Locale)) return stored as Locale;

  // Detect from navigator
  const navLang = (navigator.language || (navigator as any).userLanguage || 'en').toLowerCase();
  
  if (navLang.startsWith('fr')) return 'fr';
  
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('mortimer_locale', newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = 'ltr';
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
  }, [locale]);

  const value: I18nContextValue = {
    locale,
    setLocale,
    t: locales[locale]
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
