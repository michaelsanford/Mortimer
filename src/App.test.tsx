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
});
