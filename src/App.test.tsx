import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import App from './App';
import { createTestContainer } from './utils/testUtils';

// The calculator tabs are lazy-loaded and pull in Chart.js; stub the wrappers
// so navigating anywhere never touches a real canvas in happy-dom.
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />,
  Bar: () => <div data-testid="mock-bar-chart" />,
}));

// Lets a lazy import() resolve and its Suspense boundary re-render.
const flush = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

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
    expect(testEnv.container.innerHTML).toContain('Paydown Simulator');
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
    // Allow the lazy Settings chunk to resolve.
    await flush();
    await flush();

    expect(testEnv.container.innerHTML).toContain('Import / Export Data');
  });
});
