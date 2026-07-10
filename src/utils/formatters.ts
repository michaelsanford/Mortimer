export function getActiveLocale(locale: 'en' | 'fr'): string {
  return locale === 'fr' ? 'fr-CA' : 'en-CA';
}

export function formatLocaleNumber(
  val: number,
  locale: 'en' | 'fr',
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(getActiveLocale(locale), options).format(val);
}

export function formatLocaleCurrency(
  val: number,
  locale: 'en' | 'fr'
): string {
  return new Intl.NumberFormat(getActiveLocale(locale), {
    style: 'currency',
    currency: 'CAD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
}

export function formatLocalePercent(
  val: number,
  locale: 'en' | 'fr'
): string {
  const formatted = formatLocaleNumber(val, locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatted + (locale === 'fr' ? '\u00A0%' : '%');
}

export function cadCurrencyTooltipLabel(
  context: { dataset: { label?: string }; parsed: { y: number | null } },
  locale: 'en' | 'fr' = 'en'
): string {
  let label = context.dataset.label || '';
  if (label) label += ': ';
  if (context.parsed.y !== null) {
    label += formatLocaleCurrency(context.parsed.y, locale);
  }
  return label;
}

export function formatStringNumber(valStr: string, locale: 'en' | 'fr', _isDecimal: boolean): string {
  if (valStr === '') return '';

  const isNegative = valStr.startsWith('-');
  let cleanStr = valStr.replace(/^-/, '');

  if (locale === 'fr') {
    // Replace dot with comma (French decimal separator)
    cleanStr = cleanStr.replace(/\./g, ',');
    // Remove space thousands separators
    cleanStr = cleanStr.replace(/[\s\u00A0]/g, '');
  } else {
    // Remove comma thousands separators
    cleanStr = cleanStr.replace(/,/g, '');
  }

  const decimalSep = locale === 'fr' ? ',' : '.';
  const parts = cleanStr.split(decimalSep);
  let integerPart = parts[0].replace(/\D/g, '');
  let decimalPart = parts.length > 1 ? parts[1].replace(/\D/g, '') : null;

  const separator = locale === 'fr' ? '\u00A0' : ',';
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  let result = (isNegative ? '-' : '') + integerPart;
  if (parts.length > 1) {
    result += decimalSep + (decimalPart !== null ? decimalPart : '');
  }
  return result;
}

export function parseFormattedNumber(valStr: string, locale: 'en' | 'fr'): number | '' {
  if (!valStr || valStr.trim() === '') return '';

  let cleaned = valStr;
  if (locale === 'fr') {
    cleaned = cleaned.replace(/[\s\u00A0]/g, '');
    cleaned = cleaned.replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }

  cleaned = cleaned.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? '' : parsed;
}
