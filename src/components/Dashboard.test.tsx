import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { Dashboard } from './Dashboard';
import { createTestContainer } from '../utils/testUtils';
import type { MortgageInputs } from '../utils/mortgageMath';

const baseProfile: MortgageInputs = {
  principal: 400000,
  interestRate: 5,
  amortizationYears: 25,
  amortizationMonths: 0,
  paymentFrequency: 'monthly',
};

describe('Dashboard Component Integration Tests', () => {
  let testEnv: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    localStorage.clear();
    testEnv = createTestContainer();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('shows the welcome screen when there is no profile', async () => {
    await testEnv.render(<Dashboard profile={null} onNavigate={() => {}} onSaveProfile={() => {}} />);

    expect(testEnv.container.innerHTML).toContain('Welcome to Mortimer');
    expect(testEnv.container.innerHTML).toContain('Configure Manually');
  });

  it('navigates to the paydown tab from the welcome CTA', async () => {
    const onNavigate = vi.fn();
    await testEnv.render(<Dashboard profile={null} onNavigate={onNavigate} onSaveProfile={() => {}} />);

    const cta = Array.from(testEnv.container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Configure Manually')) as HTMLButtonElement;
    await act(async () => {
      cta.click();
    });

    expect(onNavigate).toHaveBeenCalledWith('paydown');
  });

  it('renders the mortgage overview for a configured profile', async () => {
    await testEnv.render(<Dashboard profile={baseProfile} onNavigate={() => {}} onSaveProfile={() => {}} />);

    expect(testEnv.container.innerHTML).toContain('Mortgage Overview');
    expect(testEnv.container.innerHTML).toContain('Amortization Stats');
    expect(testEnv.container.innerHTML).toContain((400000).toLocaleString());
    expect(testEnv.container.innerHTML).toContain('No prepayments configured');
  });

  it('renders the original-vs-current section when mortgage history is present', async () => {
    const withHistory: MortgageInputs = { ...baseProfile, originalPrincipal: 500000 };
    await testEnv.render(<Dashboard profile={withHistory} onNavigate={() => {}} onSaveProfile={() => {}} />);

    expect(testEnv.container.innerHTML).toContain('Original vs. Current Progress');
  });

  it('runs the onboarding tour stepper and saves the profile', async () => {
    const onSaveProfile = vi.fn();
    const onNavigate = vi.fn();
    await testEnv.render(<Dashboard profile={null} onNavigate={onNavigate} onSaveProfile={onSaveProfile} />);

    // Click "Start Setup Tour"
    const startBtn = Array.from(testEnv.container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Start Setup Tour')) as HTMLButtonElement;
    await act(async () => {
      startBtn.click();
    });

    // Step 1: Principal
    expect(testEnv.container.innerHTML).toContain('Remaining Balance');
    const input = testEnv.container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.value).toBe('450000');

    // Click Next Step
    const nextBtn = () => Array.from(testEnv.container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Next Step') || b.textContent?.includes('Finish Setup')) as HTMLButtonElement;

    await act(async () => {
      nextBtn().click();
    });

    // Step 2: Rate
    expect(testEnv.container.innerHTML).toContain('Annual Interest Rate');
    await act(async () => {
      nextBtn().click();
    });

    // Step 3: Amortization
    expect(testEnv.container.innerHTML).toContain('Remaining Amortization');
    await act(async () => {
      nextBtn().click();
    });

    // Step 4: Payment Frequency
    expect(testEnv.container.innerHTML).toContain('Payment Frequency');
    await act(async () => {
      nextBtn().click();
    });

    // Verify it called onSaveProfile
    expect(onSaveProfile).toHaveBeenCalledWith({
      principal: 450000,
      interestRate: 4.85,
      amortizationYears: 25,
      amortizationMonths: 0,
      paymentFrequency: 'monthly',
    });
  });
});
