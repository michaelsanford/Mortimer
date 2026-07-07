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

  it('handles stress testing rate offset and triggers rate warnings', async () => {
    const mockVarProfile = {
      principal: 450000,
      interestRate: 4.85,
      amortizationYears: 25,
      amortizationMonths: 0,
      paymentFrequency: 'monthly' as const,
      rateType: 'variable' as const,
      variableType: 'vrm' as const
    };

    await testEnv.render(<PaydownSimulator initialProfile={mockVarProfile} onSaveProfile={() => {}} />);

    // Get the range input (stress test slider)
    const slider = testEnv.container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.value).toBe('0');

    // Simulate rate offset increase (e.g. +2.0%)
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(slider, '2');
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Stressed details should be shown
    expect(testEnv.container.innerHTML).toContain('Stressed Interest Rate');
    expect(testEnv.container.innerHTML).toContain('Trigger Rate');

    // Simulate very high rate offset to trigger the warning (e.g. +3.0%)
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(slider, '3');
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Stressed rate warning alert should be visible
    expect(testEnv.container.innerHTML).toContain('Trigger Rate Alert!');
  });

  async function renderAndMoveStressSlider(variableType: 'vrm' | 'arm', amortizationYears: number) {
    const mockProfile = {
      principal: 300000,
      interestRate: 4.5,
      amortizationYears,
      amortizationMonths: 0,
      paymentFrequency: 'monthly' as const,
      rateType: 'variable' as const,
      variableType,
    };
    await testEnv.render(<PaydownSimulator initialProfile={mockProfile} onSaveProfile={() => {}} />);
    const slider = testEnv.container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(slider, '3');
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return slider;
  }

  it('models VRM stress testing correctly (fixed payments, trigger alert)', async () => {
    await renderAndMoveStressSlider('vrm', 25);
    expect(testEnv.container.innerHTML).toContain('Trigger Rate Alert!');
    expect(testEnv.container.innerHTML).not.toContain('Payment Recalculated');
  });

  it('models ARM stress testing correctly (recalculated payments, no trigger alert)', async () => {
    await renderAndMoveStressSlider('arm', 20);
    expect(testEnv.container.innerHTML).toContain('Payment Recalculated');
    expect(testEnv.container.innerHTML).not.toContain('Trigger Rate Alert!');
  });

  it('allows selecting Fixed, Variable (VRM), and Adjustable (ARM) from the consolidated dropdown', async () => {
    const onSaveProfileSpy = vi.fn();
    const mockProfile = {
      principal: 300000,
      interestRate: 4.5,
      amortizationYears: 25,
      amortizationMonths: 0,
      paymentFrequency: 'monthly' as const,
      rateType: 'fixed' as const
    };

    await testEnv.render(<PaydownSimulator initialProfile={mockProfile} onSaveProfile={onSaveProfileSpy} />);

    const selects = testEnv.container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(2);
    const rateTypeSelect = selects[1] as HTMLSelectElement;

    expect(rateTypeSelect.value).toBe('fixed');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(rateTypeSelect, 'variable_vrm');
      rateTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(rateTypeSelect.value).toBe('variable_vrm');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(rateTypeSelect, 'variable_arm');
      rateTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(rateTypeSelect.value).toBe('variable_arm');
  });

  it('preserves initial profile offers and other comparative settings on save', async () => {
    const onSaveProfileSpy = vi.fn();
    const mockProfile = {
      principal: 300000,
      interestRate: 4.5,
      amortizationYears: 25,
      amortizationMonths: 0,
      paymentFrequency: 'monthly' as const,
      offers: [
        { id: 'offer_1', name: 'Offer 1', rate: 3.5, term: 5, type: 'fixed' as const }
      ],
      renewalBalance: 290000,
      refinanceFees: 2000
    };

    await testEnv.render(<PaydownSimulator initialProfile={mockProfile} onSaveProfile={onSaveProfileSpy} />);

    vi.useFakeTimers();

    // Change principal to trigger dirty state and autosave
    const principalInput = testEnv.container.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(principalInput, '310000');
      principalInput.dispatchEvent(new Event('input', { bubbles: true }));
      principalInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      vi.advanceTimersByTime(1500); // Trigger debounced autosave
    });
    vi.useRealTimers();

    expect(onSaveProfileSpy).toHaveBeenCalled();
    const savedProfile = onSaveProfileSpy.mock.calls[0][0];
    expect(savedProfile.offers).toEqual(mockProfile.offers);
    expect(savedProfile.renewalBalance).toBe(mockProfile.renewalBalance);
    expect(savedProfile.refinanceFees).toBe(mockProfile.refinanceFees);
  });
});
