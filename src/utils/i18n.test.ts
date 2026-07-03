import { describe, it, expect } from 'vitest';
import { en } from '../locales/en';
import { fr } from '../locales/fr';

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
  const enKeys = collectKeys(en);
  const frKeys = collectKeys(fr);

  it('English and French have the same number of keys', () => {
    expect(enKeys.length).toBe(frKeys.length);
  });

  it('every English key exists in French', () => {
    const missingInFr = enKeys.filter(key => !frKeys.includes(key));
    expect(missingInFr).toEqual([]);
  });

  it('every French key exists in English', () => {
    const missingInEn = frKeys.filter(key => !enKeys.includes(key));
    expect(missingInEn).toEqual([]);
  });

  it('no English values are empty strings', () => {
    const emptyKeys = enKeys.filter(key => {
      const val = getNestedValue(en, key);
      return typeof val === 'string' && val.trim() === '';
    });
    expect(emptyKeys).toEqual([]);
  });

  it('no French values are empty strings', () => {
    const emptyKeys = frKeys.filter(key => {
      const val = getNestedValue(fr, key);
      return typeof val === 'string' && val.trim() === '';
    });
    expect(emptyKeys).toEqual([]);
  });

  it('interpolation placeholders in English exist in French', () => {
    const placeholderRegex = /\{[a-zA-Z]+\}/g;
    const mismatches: string[] = [];

    for (const key of enKeys) {
      const enVal = getNestedValue(en, key);
      const frVal = getNestedValue(fr, key);
      if (typeof enVal !== 'string' || typeof frVal !== 'string') continue;

      const enPlaceholders = (enVal.match(placeholderRegex) || []).sort();
      const frPlaceholders = (frVal.match(placeholderRegex) || []).sort();

      if (JSON.stringify(enPlaceholders) !== JSON.stringify(frPlaceholders)) {
        mismatches.push(`${key}: EN=${JSON.stringify(enPlaceholders)} FR=${JSON.stringify(frPlaceholders)}`);
      }
    }
    expect(mismatches).toEqual([]);
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

    it('French has the same top-level sections', () => {
      expect(Object.keys(fr).sort()).toEqual(topLevelSections.sort());
    });
  });
});
