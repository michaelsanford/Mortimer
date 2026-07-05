// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { PaydownSimulator } from './PaydownSimulator';
import { I18nProvider } from '../utils/i18n';

// Mock react-chartjs-2 to prevent canvas context errors in happy-dom
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />
}));

describe('PaydownSimulator Component Integration Tests', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root!.unmount();
      });
    }
    if (container) {
      container.remove();
    }
    container = null;
    root = null;
  });

  it('renders without crashing with null profile', async () => {
    await act(async () => {
      root!.render(
        <I18nProvider>
          <PaydownSimulator profile={null} onSaveProfile={() => {}} />
        </I18nProvider>
      );
    });

    expect(container!.innerHTML).toContain('Mortgage Parameters');
    expect(container!.innerHTML).toContain('Simulate Extra Payments');
  });

  it('renders inputs and extra payment rules', async () => {
    await act(async () => {
      root!.render(
        <I18nProvider>
          <PaydownSimulator profile={null} onSaveProfile={() => {}} />
        </I18nProvider>
      );
    });

    expect(container!.innerHTML).toContain('Balance');
    expect(container!.innerHTML).toContain('Amortization');
    expect(container!.innerHTML).toContain('Interest Rate');
  });
});
