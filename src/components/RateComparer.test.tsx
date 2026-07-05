// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { RateComparer } from './RateComparer';
import { I18nProvider } from '../utils/i18n';

// Mock react-chartjs-2 to prevent canvas context errors in happy-dom
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-bar-chart" />
}));

describe('RateComparer Component Integration Tests', () => {
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
    // This smoke test would have detected the TDZ ReferenceError immediately
    await act(async () => {
      root!.render(
        <I18nProvider>
          <RateComparer profile={null} onSaveProfile={() => {}} />
        </I18nProvider>
      );
    });

    expect(container!.innerHTML).toContain('Rate Comparisons');
    expect(container!.innerHTML).toContain('Baseline Offer');
  });

  it('renders default offers and computes results', async () => {
    await act(async () => {
      root!.render(
        <I18nProvider>
          <RateComparer profile={null} onSaveProfile={() => {}} />
        </I18nProvider>
      );
    });

    // Check default offers exist in inputs
    expect(container!.innerHTML).toContain('Baseline Offer');
    expect(container!.innerHTML).toContain('Option B');
    expect(container!.innerHTML).toContain('Option C');

    // Check table headers and rows exist
    expect(container!.innerHTML).toContain('Ending Balance');
    expect(container!.innerHTML).toContain('Amortization at Term End');
  });

  it('allows adding a new offer', async () => {
    await act(async () => {
      root!.render(
        <I18nProvider>
          <RateComparer profile={null} onSaveProfile={() => {}} />
        </I18nProvider>
      );
    });

    // Find the Add Offer button
    const buttons = Array.from(container!.querySelectorAll('button'));
    const addOfferButton = buttons.find(b => b.textContent?.includes('Add Offer'));
    expect(addOfferButton).toBeDefined();

    // Click the Add Offer button
    await act(async () => {
      addOfferButton!.click();
    });

    // Verify a new offer (Offer 4) is added to the DOM
    expect(container!.innerHTML).toContain('Offer 4');
  });

  it('allows removing an offer', async () => {
    await act(async () => {
      root!.render(
        <I18nProvider>
          <RateComparer profile={null} onSaveProfile={() => {}} />
        </I18nProvider>
      );
    });

    // Check initially Option C exists
    expect(container!.innerHTML).toContain('Option C');

    // Find trash buttons (buttons containing svg icon but no text)
    const buttons = Array.from(container!.querySelectorAll('button'));
    const trashButtons = buttons.filter(b => b.querySelector('svg') && !b.textContent?.trim());
    expect(trashButtons.length).toBe(3); // All 3 offers have delete buttons

    const trashBtn = trashButtons[2]; // delete Option C
    
    await act(async () => {
      trashBtn.click();
    });

    // Verify Option C was removed
    const remainingOptionC = container!.querySelectorAll('input[value="Option C"]');
    expect(remainingOptionC.length).toBe(0);
  });

  it('computes overall best offer and displays overall best row', async () => {
    const mockProfile = {
      principal: 300000,
      interestRate: 5.0,
      amortizationYears: 25,
      amortizationMonths: 0,
      paymentFrequency: 'monthly' as const,
      compoundingPeriod: 'semi_annual' as const,
      householdIncome: 120000,
      incomeType: 'gross' as const,
      offers: [
        { id: 'off_1', name: 'Cheap Offer', rate: 3.5, term: 5, type: 'fixed' as const },
        { id: 'off_2', name: 'Expensive Offer', rate: 6.5, term: 5, type: 'fixed' as const }
      ]
    };

    await act(async () => {
      root!.render(
        <I18nProvider>
          <RateComparer profile={mockProfile} onSaveProfile={() => {}} />
        </I18nProvider>
      );
    });

    // The cheap offer (3.5%) should win almost all categories
    expect(container!.innerHTML).toContain('Cheap Offer');
    expect(container!.innerHTML).toContain('Expensive Offer');

    // The Overall Best row should render and contain the ArrowUp icon for the cheap offer
    expect(container!.innerHTML).toContain('Overall Best');
    
    const svgs = container!.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders all 7 comparison charts', async () => {
    await act(async () => {
      root!.render(
        <I18nProvider>
          <RateComparer profile={null} onSaveProfile={() => {}} />
        </I18nProvider>
      );
    });

    // Verify all 7 mock chart containers render in the DOM
    const charts = container!.querySelectorAll('[data-testid="mock-bar-chart"]');
    expect(charts.length).toBe(7);
  });
});
