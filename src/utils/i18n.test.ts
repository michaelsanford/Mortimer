import { describe, it, expect } from 'vitest';
import { en } from '../locales/en';
import { fr } from '../locales/fr';
import { zh } from '../locales/zh';
import { pa } from '../locales/pa';
import { zhHK } from '../locales/zh-HK';
import { es } from '../locales/es';
import { ar } from '../locales/ar';

/**
 * Recursively collect all keys from a nested object as dot-separated paths.
 */
function collectKeys(obj: Record<string, any>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...collectKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/**
 * Recursively get a value from a nested object using a dot-separated path.
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

describe('i18n locale completeness', () => {
  const locales = {
    en: { name: 'English', data: en },
    fr: { name: 'French', data: fr },
    zh: { name: 'Mandarin', data: zh },
    pa: { name: 'Punjabi', data: pa },
    'zh-HK': { name: 'Cantonese', data: zhHK },
    es: { name: 'Spanish', data: es },
    ar: { name: 'Arabic', data: ar }
  };

  const enKeys = collectKeys(en);

  Object.entries(locales).forEach(([code, locale]) => {
    if (code === 'en') return;

    const localeKeys = collectKeys(locale.data);

    it(`English and ${locale.name} have the same number of keys`, () => {
      expect(localeKeys.length).toBe(enKeys.length);
    });

    it(`every English key exists in ${locale.name}`, () => {
      const missing = enKeys.filter(key => !localeKeys.includes(key));
      expect(missing).toEqual([]);
    });

    it(`every ${locale.name} key exists in English`, () => {
      const missing = localeKeys.filter(key => !enKeys.includes(key));
      expect(missing).toEqual([]);
    });

    it(`no ${locale.name} values are empty strings`, () => {
      const emptyKeys = localeKeys.filter(key => {
        const val = getNestedValue(locale.data, key);
        return typeof val === 'string' && val.trim() === '';
      });
      expect(emptyKeys).toEqual([]);
    });

    it(`interpolation placeholders in English exist in ${locale.name}`, () => {
      const placeholderRegex = /\{[a-zA-Z0-9_]+\}/g;
      const mismatches: string[] = [];

      for (const key of enKeys) {
        const enVal = getNestedValue(en, key);
        const locVal = getNestedValue(locale.data, key);
        if (typeof enVal !== 'string' || typeof locVal !== 'string') continue;

        const enPlaceholders = (enVal.match(placeholderRegex) || []).sort();
        const locPlaceholders = (locVal.match(placeholderRegex) || []).sort();

        if (JSON.stringify(enPlaceholders) !== JSON.stringify(locPlaceholders)) {
          mismatches.push(`${key}: EN=${JSON.stringify(enPlaceholders)} ${code.toUpperCase()}=${JSON.stringify(locPlaceholders)}`);
        }
      }
      expect(mismatches).toEqual([]);
    });
  });

  it('no English values are empty strings', () => {
    const emptyKeys = enKeys.filter(key => {
      const val = getNestedValue(en, key);
      return typeof val === 'string' && val.trim() === '';
    });
    expect(emptyKeys).toEqual([]);
  });

  describe('locale structure', () => {
    const topLevelSections = Object.keys(en);

    it('has expected top-level sections', () => {
      expect(topLevelSections).toContain('app');
      expect(topLevelSections).toContain('nav');
      expect(topLevelSections).toContain('footer');
      expect(topLevelSections).toContain('language');
      expect(topLevelSections).toContain('passcode');
      expect(topLevelSections).toContain('dashboard');
      expect(topLevelSections).toContain('paydown');
      expect(topLevelSections).toContain('rate');
      expect(topLevelSections).toContain('heloc');
      expect(topLevelSections).toContain('settings');
    });

    Object.entries(locales).forEach(([code, locale]) => {
      it(`${locale.name} has the same top-level sections`, () => {
        expect(Object.keys(locale.data).sort()).toEqual(topLevelSections.sort());
      });
    });
  });
});
