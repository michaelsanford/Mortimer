import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
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
    await testEnv.render(<PaydownSimulator profile={null} onSaveProfile={() => {}} />);

    expect(testEnv.container.innerHTML).toContain('Mortgage Parameters');
    expect(testEnv.container.innerHTML).toContain('Simulate Extra Payments');
  });

  it('renders inputs and extra payment rules', async () => {
    await testEnv.render(<PaydownSimulator profile={null} onSaveProfile={() => {}} />);

    expect(testEnv.container.innerHTML).toContain('Balance');
    expect(testEnv.container.innerHTML).toContain('Amortization');
    expect(testEnv.container.innerHTML).toContain('Interest Rate');
  });
});
