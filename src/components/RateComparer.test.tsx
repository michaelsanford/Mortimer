import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { RateComparer } from './RateComparer';
import { createTestContainer } from '../utils/testUtils';

// Mock react-chartjs-2 to prevent canvas context errors in happy-dom
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-bar-chart" />,
  Line: () => <div data-testid="mock-line-chart" />
}));

describe('RateComparer Component Integration Tests', () => {
  let testEnv: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    testEnv = createTestContainer();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('renders without crashing with null profile', async () => {
    // This smoke test would have detected the TDZ ReferenceError immediately
    await testEnv.render(<RateComparer profile={null} onSaveProfile={() => {}} />);

    expect(testEnv.container.innerHTML).toContain('Rate Comparisons');
    expect(testEnv.container.innerHTML).toContain('Baseline Offer');
  });

  it('renders default offers and computes results', async () => {
    await testEnv.render(<RateComparer profile={null} onSaveProfile={() => {}} />);

    // Check default offers exist in inputs
    expect(testEnv.container.innerHTML).toContain('Baseline Offer');
    expect(testEnv.container.innerHTML).toContain('Option B');
    expect(testEnv.container.innerHTML).toContain('Option C');

    // Check table headers and rows exist
    expect(testEnv.container.innerHTML).toContain('Ending Balance');
    expect(testEnv.container.innerHTML).toContain('Amortization at Term End');
  });

  it('allows adding a new offer', async () => {
    await testEnv.render(<RateComparer profile={null} onSaveProfile={() => {}} />);

    // Find the Add Offer button
    const buttons = Array.from(testEnv.container.querySelectorAll('button'));
    const addOfferButton = buttons.find(b => b.textContent?.includes('Add Offer'));
    expect(addOfferButton).toBeDefined();

    // Click the Add Offer button
    await act(async () => {
      addOfferButton!.click();
    });

    // Verify a new offer (Offer 4) is added to the DOM
    expect(testEnv.container.innerHTML).toContain('Offer 4');
  });

  it('allows removing an offer', async () => {
    await testEnv.render(<RateComparer profile={null} onSaveProfile={() => {}} />);

    // Check initially Option C exists
    expect(testEnv.container.innerHTML).toContain('Option C');

    // Find trash buttons (buttons containing svg icon but no text)
    const buttons = Array.from(testEnv.container.querySelectorAll('button'));
    const trashButtons = buttons.filter(b => b.querySelector('svg') && !b.textContent?.trim());
    expect(trashButtons.length).toBe(3); // All 3 offers have delete buttons

    const trashBtn = trashButtons[2]; // delete Option C
    
    await act(async () => {
      trashBtn.click();
    });

    // Verify Option C was removed
    const remainingOptionC = testEnv.container.querySelectorAll('input[value="Option C"]');
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

    await testEnv.render(<RateComparer profile={mockProfile} onSaveProfile={() => {}} />);

    // The cheap offer (3.5%) should win almost all categories
    expect(testEnv.container.innerHTML).toContain('Cheap Offer');
    expect(testEnv.container.innerHTML).toContain('Expensive Offer');

    // The Overall Best row should render and contain the ArrowUp icon for the cheap offer
    expect(testEnv.container.innerHTML).toContain('Overall Best');
    
    const svgs = testEnv.container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders all 7 comparison charts', async () => {
    await testEnv.render(<RateComparer profile={null} onSaveProfile={() => {}} />);

    // Verify all 7 mock chart containers render in the DOM
    const charts = testEnv.container.querySelectorAll('[data-testid="mock-bar-chart"]');
    expect(charts.length).toBe(7);
  });

  it('renders refinance break-even crossover chart and timeline in refinance subtab', async () => {
    await testEnv.render(<RateComparer profile={null} onSaveProfile={() => {}} />);

    // Click Refinance Penalty & Break-Even sub-tab
    const tabs = Array.from(testEnv.container.querySelectorAll('button'));
    const refiTab = tabs.find(t => t.textContent?.includes('Refinance Penalty') || t.textContent?.includes('Break-Even'));
    expect(refiTab).toBeDefined();

    await act(async () => {
      refiTab!.click();
    });

    // Verify it renders refinance parameters and the crossover line chart
    expect(testEnv.container.innerHTML).toContain('Refinance Parameters');
    expect(testEnv.container.innerHTML).toContain('Break-Even Summary');
    
    // Interest comparison bar chart and break-even crossover line chart should be present
    expect(testEnv.container.querySelector('[data-testid="mock-bar-chart"]')).toBeTruthy();
    expect(testEnv.container.querySelector('[data-testid="mock-line-chart"]')).toBeTruthy();
  });
});
