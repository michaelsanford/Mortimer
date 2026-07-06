import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { PaydownSimulator } from './PaydownSimulator';
import { createTestContainer } from '../utils/testUtils';

// Mock react-chartjs-2 to prevent canvas context errors in happy-dom
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />
}));

describe('PaydownSimulator Component Integration Tests', () => {
  let testEnv: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    testEnv = createTestContainer();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('renders without crashing with null profile', async () => {
    await testEnv.render(<PaydownSimulator initialProfile={null} onSaveProfile={() => {}} />);

    expect(testEnv.container.innerHTML).toContain('Mortgage Parameters');
    expect(testEnv.container.innerHTML).toContain('Simulate Extra Payments');
  });

  it('renders inputs and extra payment rules', async () => {
    await testEnv.render(<PaydownSimulator initialProfile={null} onSaveProfile={() => {}} />);

    expect(testEnv.container.innerHTML).toContain('Balance');
    expect(testEnv.container.innerHTML).toContain('Amortization');
    expect(testEnv.container.innerHTML).toContain('Interest Rate');
  });

  it('renders scenario selector and locks fields when an offer is selected', async () => {
    const mockProfile = {
      principal: 300000,
      interestRate: 4.5,
      amortizationYears: 20,
      amortizationMonths: 0,
      paymentFrequency: 'monthly' as const,
      offers: [
        { id: 'offer_1', name: 'Super Deal', rate: 3.5, term: 5, type: 'fixed' as const }
      ],
      renewalBalance: 280000,
      renewalAmortizationYears: 18,
      renewalAmortizationMonths: 0,
      rateComparerPaymentFrequency: 'regular_bi_weekly'
    };

    await testEnv.render(
      <PaydownSimulator 
        initialProfile={mockProfile} 
        onSaveProfile={() => {}} 
      />
    );

    // Initial state: Current Mortgage should be selected
    const select = testEnv.container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('current');

    // Principal input should be enabled and show 300000
    const principalInput = testEnv.container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(principalInput.disabled).toBe(false);

    // Change to Super Deal scenario
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(select, 'offer_1');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Now select value should be offer_1
    expect(select.value).toBe('offer_1');

    // The inputs should now be disabled because they are linked to the offer
    expect(principalInput.disabled).toBe(true);
  });
});
