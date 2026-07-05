import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { en } from '../locales/en';
import { fr } from '../locales/fr';
import { zh } from '../locales/zh';
import { pa } from '../locales/pa';
import { zhHK } from '../locales/zh-HK';
import { es } from '../locales/es';
import { ar } from '../locales/ar';

export type Locale = 'en' | 'fr' | 'zh' | 'pa' | 'zh-HK' | 'es' | 'ar';

// Recursively convert literal string types to string
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type Translations = DeepStringify<typeof en>;

const locales: Record<Locale, Translations> = { 
  en, 
  fr, 
  zh, 
  pa, 
  'zh-HK': zhHK, 
  es, 
  ar 
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
  const validLocales: Locale[] = ['en', 'fr', 'zh', 'pa', 'zh-HK', 'es', 'ar'];
  if (stored && validLocales.includes(stored as Locale)) return stored as Locale;

  // Detect from navigator
  const navLang = (navigator.language || (navigator as any).userLanguage || 'en').toLowerCase();
  
  if (navLang.startsWith('fr')) return 'fr';
  if (navLang.startsWith('zh-hk') || navLang.startsWith('zh-tw') || navLang.startsWith('zh-mo')) return 'zh-HK';
  if (navLang.startsWith('zh')) return 'zh';
  if (navLang.startsWith('pa')) return 'pa';
  if (navLang.startsWith('es')) return 'es';
  if (navLang.startsWith('ar')) return 'ar';
  
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('mortimer_locale', newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === 'ar' ? 'rtl' : 'ltr';
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
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
