import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../utils/i18n';
import { formatStringNumber, parseFormattedNumber } from '../utils/formatters';

interface FormattedNumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | '';
  onChange: (val: number | '') => void;
  isDecimal?: boolean;
}

export const FormattedNumericInput: React.FC<FormattedNumericInputProps> = ({
  value,
  onChange,
  isDecimal = false,
  ...props
}) => {
  const { locale } = useI18n();
  const [displayValue, setDisplayValue] = useState<string>('');
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      if (value === '') {
        setDisplayValue('');
      } else {
        setDisplayValue(
          new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
            maximumFractionDigits: 10
          }).format(value)
        );
      }
    }
  }, [value, locale]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;

    if (inputVal.trim() === '') {
      setDisplayValue('');
      onChange('');
      return;
    }

    const input = e.target;
    const start = input.selectionStart || 0;

    const formatted = formatStringNumber(inputVal, locale, isDecimal);
    const parsed = parseFormattedNumber(formatted, locale);

    setDisplayValue(formatted);
    onChange(parsed);

    // Cursor position restoration
    const separatorChar = locale === 'fr' ? '\u00A0' : ',';
    const otherSeparatorChar = locale === 'fr' ? ' ' : '';

    let nonSeparatorCountBeforeCursor = 0;
    for (let i = 0; i < start; i++) {
      const char = inputVal[i];
      if (char !== separatorChar && char !== otherSeparatorChar) {
        nonSeparatorCountBeforeCursor++;
      }
    }

    setTimeout(() => {
      let newCursorPos = 0;
      let nonSeparatorCount = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (nonSeparatorCount === nonSeparatorCountBeforeCursor) {
          break;
        }
        const char = formatted[i];
        if (char !== separatorChar && char !== ' ') {
          nonSeparatorCount++;
        }
        newCursorPos++;
      }
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <input
      {...props}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={(e) => {
        isFocused.current = true;
        if (props.onFocus) props.onFocus(e);
      }}
      onBlur={(e) => {
        isFocused.current = false;
        if (value === '') {
          setDisplayValue('');
        } else {
          setDisplayValue(
            new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
              maximumFractionDigits: 10
            }).format(value)
          );
        }
        if (props.onBlur) props.onBlur(e);
      }}
    />
  );
};
