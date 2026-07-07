import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import App from './App';
import { createTestContainer, waitFor } from './utils/testUtils';

// The calculator tabs are lazy-loaded and pull in Chart.js; stub the wrappers
// so navigating anywhere never touches a real canvas in happy-dom.
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />,
  Bar: () => <div data-testid="mock-bar-chart" />,
}));

import { setupPasscode } from './utils/storage';

describe('App Integration Smoke Tests', () => {
  let testEnv: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    localStorage.clear();
    testEnv = createTestContainer();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('renders the header, navigation and default dashboard', async () => {
    await testEnv.render(<App />);

    expect(testEnv.container.innerHTML).toContain('Mortimer');
    expect(testEnv.container.innerHTML).toContain('Current Mortgage');
    expect(testEnv.container.innerHTML).toContain('Rates Comparer');
    // Default tab is the dashboard; with no stored profile it shows the welcome view.
    expect(testEnv.container.innerHTML).toContain('Welcome to Mortimer');
  });

  it('opens the language dropdown', async () => {
    await testEnv.render(<App />);

    const trigger = testEnv.container.querySelector('.language-dropdown-trigger') as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });

    expect(testEnv.container.innerHTML).toContain('Français');
  });

  it('navigates to a lazy-loaded tab', async () => {
    await testEnv.render(<App />);

    const settingsTab = Array.from(testEnv.container.querySelectorAll('.tab-btn'))
      .find(b => b.textContent?.includes('Settings')) as HTMLButtonElement;
    await act(async () => {
      settingsTab.click();
    });
    // Wait for the lazy Settings chunk to resolve and render.
    await waitFor(() => testEnv.container.innerHTML.includes('Import / Export Data'));

    expect(testEnv.container.innerHTML).toContain('Import / Export Data');
  });

  it('locks the app automatically after inactivity duration', async () => {
    await setupPasscode('1357');
    localStorage.setItem('auto_lock_duration', '30');

    await testEnv.render(<App />);
    await waitFor(() => testEnv.container.innerHTML.includes('App Locked'));

    const digits = ['1', '3', '5', '7'];
    for (const d of digits) {
      const btn = Array.from(testEnv.container.querySelectorAll('button.pin-key'))
        .find(b => b.textContent?.trim() === d) as HTMLButtonElement;
      await act(async () => { btn.click(); });
    }
    const submitBtn = testEnv.container.querySelector('button[aria-label="Submit PIN"]') as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    await waitFor(() => !testEnv.container.innerHTML.includes('App Locked'));
    expect(testEnv.container.innerHTML).not.toContain('App Locked');

    // Enable fake timers now that the initial load and unlocks are completed
    vi.useFakeTimers();

    // Trigger user activity to reset and start the auto-lock timer
    window.dispatchEvent(new Event('mousemove'));

    await act(async () => {
      vi.advanceTimersByTime(31000);
    });

    expect(testEnv.container.innerHTML).toContain('App Locked');

    vi.useRealTimers();
  });

  it('calls window.print when the floating print button is clicked', async () => {
    window.print = vi.fn();
    await testEnv.render(<App />);

    const printBtn = testEnv.container.querySelector('.no-print') as HTMLButtonElement;
    expect(printBtn).toBeTruthy();

    await act(async () => {
      printBtn.click();
    });

    expect(window.print).toHaveBeenCalled();
  });

  it('updates profile and integrates variables and offers across tabs', async () => {
    const mockProfile = {
      principal: 400000,
      interestRate: 4.85,
      amortizationYears: 20,
      amortizationMonths: 0,
      paymentFrequency: 'monthly' as const,
      originalPrincipal: 400000,
      originalAmortizationYears: 20,
      originalAmortizationMonths: 0,
      originalTermYears: 5,
      offers: [
        { id: 'baseline', name: 'FN Adj', rate: 3.6, term: 5, type: 'variable' as const, variableType: 'arm' as const }
      ],
      renewalBalance: 400000,
      renewalAmortizationYears: 20,
      renewalAmortizationMonths: 0,
      rateComparerPaymentFrequency: 'accelerated_bi_weekly'
    };
    
    localStorage.setItem('mortimer_profile', JSON.stringify(mockProfile));
    
    await testEnv.render(<App />);
    
    // Navigate to Current Mortgage tab (originally Paydown Simulator)
    const paydownTab = Array.from(testEnv.container.querySelectorAll('.tab-btn'))
      .find(b => b.textContent?.includes('Current Mortgage')) as HTMLButtonElement;
    expect(paydownTab).toBeTruthy();
    
    await act(async () => {
      paydownTab.click();
    });
    
    // Wait for Current Mortgage (PaydownSimulator) to load
    await waitFor(() => testEnv.container.innerHTML.includes('Mortgage Parameters'));
    
    // Check if the dropdown option labels display Adjustable Rate for FN Adj
    const selectEl = testEnv.container.querySelector('.form-select') as HTMLSelectElement;
    expect(selectEl).toBeTruthy();
    
    // The option for FN Adj should include "Adjustable Rate" (or "Taux ajustable" in French)
    const fnAdjOption = Array.from(selectEl.options).find(opt => opt.text.includes('FN Adj'));
    expect(fnAdjOption).toBeTruthy();
    expect(fnAdjOption?.text).toContain('Adjustable Rate');

    // Navigate to Rates Comparer tab
    const rateTab = Array.from(testEnv.container.querySelectorAll('.tab-btn'))
      .find(b => b.textContent?.includes('Rates Comparer')) as HTMLButtonElement;
    expect(rateTab).toBeTruthy();
    
    await act(async () => {
      rateTab.click();
    });
    
    // Wait for RateComparer to load
    await waitFor(() => testEnv.container.innerHTML.includes('Renewal Comparison Results'));
    
    // Check if the "Delta from Current" row is rendered
    expect(testEnv.container.innerHTML).toContain('Delta from Current');
  });
});
