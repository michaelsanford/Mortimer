import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { FormattedNumericInput } from './FormattedNumericInput';
import { createTestContainer } from '../utils/testUtils';

// Drives a controlled React input the way a user would, so onChange fires.
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('FormattedNumericInput Component Unit Tests', () => {
  let testEnv: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    testEnv = createTestContainer();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('renders formatted initial value', async () => {
    const onChangeSpy = vi.fn();
    await testEnv.render(
      <FormattedNumericInput value={450000} onChange={onChangeSpy} />
    );

    const input = testEnv.container.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value.replace(/\u00A0/g, ' ')).toBe('450,000');
  });

  it('allows typing and formats value on the fly', async () => {
    let value: number | '' = 1000;
    const onChangeSpy = vi.fn((val) => {
      value = val;
    });

    await testEnv.render(
      <FormattedNumericInput value={value} onChange={onChangeSpy} />
    );

    const input = testEnv.container.querySelector('input') as HTMLInputElement;
    await act(async () => {
      typeInto(input, '1000000');
    });

    expect(onChangeSpy).toHaveBeenCalledWith(1000000);
  });

  it('allows clearing the field completely and returns empty string', async () => {
    let value: number | '' = 450000;
    const onChangeSpy = vi.fn((val) => {
      value = val;
    });

    await testEnv.render(
      <FormattedNumericInput value={value} onChange={onChangeSpy} />
    );

    const input = testEnv.container.querySelector('input') as HTMLInputElement;
    expect(input.value.replace(/[\s\u00A0,]/g, '')).toBe('450000');

    await act(async () => {
      typeInto(input, '');
    });

    expect(onChangeSpy).toHaveBeenCalledWith('');
    expect(value).toBe('');
  });

  it('disables input when disabled prop is true', async () => {
    const onChangeSpy = vi.fn();
    await testEnv.render(
      <FormattedNumericInput value={3000} onChange={onChangeSpy} disabled={true} />
    );

    const input = testEnv.container.querySelector('input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
