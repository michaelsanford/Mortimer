import { describe, it, expect } from 'vitest';
import {
  getActiveLocale,
  formatLocaleNumber,
  formatLocaleCurrency,
  formatLocalePercent,
  formatStringNumber,
  parseFormattedNumber
} from './formatters';

describe('formatters utility tests', () => {
  describe('getActiveLocale', () => {
    it('returns the correct locale string', () => {
      expect(getActiveLocale('en')).toBe('en-CA');
      expect(getActiveLocale('fr')).toBe('fr-CA');
    });
  });

  describe('formatLocaleNumber', () => {
    it('formats numbers with correct separators', () => {
      const value = 1234567.89;
      // In Node environment, check if it contains the correct character format
      expect(formatLocaleNumber(value, 'en').replace(/\u00A0/g, ' ')).toContain('1,234,567.89');
      const frFormatted = formatLocaleNumber(value, 'fr').replace(/\u00A0/g, ' ');
      expect(frFormatted).toContain('1 234 567,89');
    });
  });

  describe('formatLocaleCurrency', () => {
    it('formats CAD currency according to locale rules', () => {
      const value = 1234.56;
      expect(formatLocaleCurrency(value, 'en').replace(/\u00A0/g, ' ')).toContain('$1,234.56');
      const frFormatted = formatLocaleCurrency(value, 'fr').replace(/\u00A0/g, ' ');
      // In French CAD currency format, the dollar sign usually comes at the end
      expect(frFormatted).toContain('1 234,56');
      expect(frFormatted).toContain('$');
    });
  });

  describe('formatLocalePercent', () => {
    it('formats percent values according to locale rules', () => {
      const value = 4.85;
      expect(formatLocalePercent(value, 'en').replace(/\u00A0/g, ' ')).toBe('4.85%');
      expect(formatLocalePercent(value, 'fr').replace(/\u00A0/g, ' ')).toBe('4,85 %');
    });
  });

  describe('formatStringNumber', () => {
    it('formats English string numbers on-the-fly', () => {
      expect(formatStringNumber('1234567', 'en', false)).toBe('1,234,567');
      expect(formatStringNumber('1234567.', 'en', true)).toBe('1,234,567.');
      expect(formatStringNumber('1234567.89', 'en', true)).toBe('1,234,567.89');
    });

    it('formats French string numbers on-the-fly', () => {
      const separator = '\u00A0';
      expect(formatStringNumber('1234567', 'fr', false)).toBe(`1${separator}234${separator}567`);
      expect(formatStringNumber('1234567,', 'fr', true)).toBe(`1${separator}234${separator}567,`);
      expect(formatStringNumber('1234567,89', 'fr', true)).toBe(`1${separator}234${separator}567,89`);
      // Replaces dots with commas in French
      expect(formatStringNumber('1234.56', 'fr', true)).toBe(`1${separator}234,56`);
    });

    it('returns empty string when input is empty', () => {
      expect(formatStringNumber('', 'en', false)).toBe('');
    });
  });

  describe('parseFormattedNumber', () => {
    it('parses formatted English numbers', () => {
      expect(parseFormattedNumber('1,234,567.89', 'en')).toBe(1234567.89);
      expect(parseFormattedNumber('1234', 'en')).toBe(1234);
    });

    it('parses formatted French numbers', () => {
      const separator = '\u00A0';
      expect(parseFormattedNumber(`1${separator}234${separator}567,89`, 'fr')).toBe(1234567.89);
      expect(parseFormattedNumber('1 234 567,89', 'fr')).toBe(1234567.89);
    });

    it('returns empty string for invalid or empty inputs', () => {
      expect(parseFormattedNumber('', 'en')).toBe('');
      expect(parseFormattedNumber('  ', 'en')).toBe('');
    });
  });
});
