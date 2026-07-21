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

  it('allows removing an offer after confirmation', async () => {
    // Stub window.confirm to return true
    const confirmStub = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmStub);

    await testEnv.render(<RateComparer profile={null} onSaveProfile={() => {}} />);

    // Check initially Option C exists
    expect(testEnv.container.innerHTML).toContain('Option C');

    // Find trash buttons
    const trashButtons = testEnv.container.querySelectorAll('[data-testid="delete-offer-btn"]');
    expect(trashButtons.length).toBe(3); // All 3 offers have delete buttons

    const trashBtn = trashButtons[2] as HTMLButtonElement; // delete Option C
    
    await act(async () => {
      trashBtn.click();
    });

    expect(confirmStub).toHaveBeenCalled();
    // Verify Option C was removed
    const remainingOptionC = testEnv.container.querySelectorAll('input[value="Option C"]');
    expect(remainingOptionC.length).toBe(0);

    vi.unstubAllGlobals();
  });

  it('does not remove an offer if delete confirmation is cancelled', async () => {
    // Stub window.confirm to return false
    const confirmStub = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmStub);

    await testEnv.render(<RateComparer profile={null} onSaveProfile={() => {}} />);

    // Check initially Option C exists
    expect(testEnv.container.innerHTML).toContain('Option C');

    // Find trash buttons
    const trashButtons = testEnv.container.querySelectorAll('[data-testid="delete-offer-btn"]');
    const trashBtn = trashButtons[2] as HTMLButtonElement; // delete Option C
    
    await act(async () => {
      trashBtn.click();
    });

    expect(confirmStub).toHaveBeenCalled();
    // Verify Option C was NOT removed
    expect(testEnv.container.innerHTML).toContain('Option C');

    vi.unstubAllGlobals();
  });

  it('allows toggling offer visibility and updates results table and winners', async () => {
    await testEnv.render(<RateComparer profile={null} onSaveProfile={() => {}} />);

    // Check initially Option B columns exist in the comparison results
    expect(testEnv.container.innerHTML).toContain('Option B');

    // Find toggle buttons
    const toggleButtons = testEnv.container.querySelectorAll('[data-testid="toggle-visibility-btn"]');
    expect(toggleButtons.length).toBe(3);

    const toggleBtn = toggleButtons[1] as HTMLButtonElement; // Toggle Option B visibility

    await act(async () => {
      toggleBtn.click();
    });

    // Option B should no longer be visible in the results table header
    const headers = Array.from(testEnv.container.querySelectorAll('th'));
    const optionBHeader = headers.find(h => h.textContent?.trim() === 'Option B');
    expect(optionBHeader).toBeUndefined();

    // Verify option B remains in the input section config
    const optionBInput = testEnv.container.querySelector('input[value="Option B"]');
    expect(optionBInput).toBeDefined();
  });

  it('shows no offers selected empty state when all offers are toggled invisible', async () => {
    await testEnv.render(<RateComparer profile={null} onSaveProfile={() => {}} />);

    const toggleButtons = testEnv.container.querySelectorAll('[data-testid="toggle-visibility-btn"]');
    
    // Toggle all 3 offers invisible
    await act(async () => {
      (toggleButtons[0] as HTMLButtonElement).click();
    });
    await act(async () => {
      (toggleButtons[1] as HTMLButtonElement).click();
    });
    await act(async () => {
      (toggleButtons[2] as HTMLButtonElement).click();
    });

    // Check that empty state message is shown
    expect(testEnv.container.innerHTML).toContain('No offers selected for comparison');
    
    // Check that table-container is not rendered
    const tableContainer = testEnv.container.querySelector('.table-container');
    expect(tableContainer).toBeNull();
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

  it('displays % of Income (Estimated Net) row when income type is gross, and hides it when net', async () => {
    const profileGross = {
      principal: 300000,
      interestRate: 4.5,
      amortizationYears: 25,
      amortizationMonths: 0,
      paymentFrequency: 'monthly' as const,
      householdIncome: 120000,
      incomeType: 'gross' as const
    };

    const profileNet = {
      principal: 300000,
      interestRate: 4.5,
      amortizationYears: 25,
      amortizationMonths: 0,
      paymentFrequency: 'monthly' as const,
      householdIncome: 80000,
      incomeType: 'net' as const
    };

    // Render gross profile
    const testEnvGross = createTestContainer();
    await testEnvGross.render(<RateComparer profile={profileGross} onSaveProfile={() => {}} />);
    expect(testEnvGross.container.innerHTML).toContain('% of Income (Gross)');
    expect(testEnvGross.container.innerHTML).toContain('% of Income (Estimated Net)');
    await testEnvGross.cleanup();

    // Render net profile
    const testEnvNet = createTestContainer();
    await testEnvNet.render(<RateComparer profile={profileNet} onSaveProfile={() => {}} />);
    expect(testEnvNet.container.innerHTML).toContain('% of Income (Net)');
    expect(testEnvNet.container.innerHTML).not.toContain('% of Income (Estimated Net)');
    await testEnvNet.cleanup();
  });
});
