import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { HELOCPlanner } from './HELOCPlanner';
import { createTestContainer } from '../utils/testUtils';

// Drives a controlled React input the way a user would, so onChange fires.
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('HELOCPlanner Component Integration Tests', () => {
  let testEnv: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    testEnv = createTestContainer();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('renders equity inputs and verified capacity for a healthy LTV', async () => {
    await testEnv.render(<HELOCPlanner currentHomeValue={650000} currentBalance={350000} />);

    expect(testEnv.container.innerHTML).toContain('Home Market Value');
    expect(testEnv.container.innerHTML).toContain('Outstanding Mortgage');
    expect(testEnv.container.innerHTML).toContain('Canadian Equity Capacity');
    // No renovations selected yet -> capacity is sufficient.
    expect(testEnv.container.innerHTML).toContain('Equity Verified');
  });

  it('recomputes projected borrowing when a renovation is selected', async () => {
    await testEnv.render(<HELOCPlanner currentHomeValue={650000} currentBalance={350000} />);

    // The first reno row's checkbox wrapper toggles that item (kitchen, $35,000).
    const toggle = testEnv.container.querySelector('.heloc-checkbox') as HTMLElement;
    expect(toggle).toBeTruthy();
    await act(async () => {
      toggle.click();
    });

    // Financing cost description echoes the selected renovation total.
    // Use the runtime-formatted value so the assertion is locale-agnostic.
    expect(testEnv.container.innerHTML).toContain((35000).toLocaleString());
    expect(testEnv.container.innerHTML).toContain('/ month');
  });

  it('warns when the mortgage LTV is too high to borrow', async () => {
    await testEnv.render(<HELOCPlanner currentHomeValue={100000} currentBalance={90000} />);

    expect(testEnv.container.innerHTML).toContain('HELOC Locked');
  });

  it('flags insufficient capacity after adding an oversized custom project', async () => {
    await testEnv.render(<HELOCPlanner currentHomeValue={650000} currentBalance={350000} />);

    const form = testEnv.container.querySelector('form') as HTMLFormElement;
    const nameInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    const costInput = form.querySelector('input[type="number"]') as HTMLInputElement;

    await act(async () => {
      typeInto(nameInput, 'Full Gut Renovation');
      typeInto(costInput, '250000');
    });
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(testEnv.container.innerHTML).toContain('Full Gut Renovation');
    expect(testEnv.container.innerHTML).toContain('Insufficient Capacity');
  });

  it('removes a renovation item when deleted', async () => {
    await testEnv.render(<HELOCPlanner currentHomeValue={650000} currentBalance={350000} />);

    const deleteButtons = () =>
      Array.from(testEnv.container.querySelectorAll('.heloc-delete-btn'));
    const before = deleteButtons().length;
    expect(before).toBeGreaterThan(0);

    await act(async () => {
      (deleteButtons()[0] as HTMLButtonElement).click();
    });

    expect(deleteButtons().length).toBe(before - 1);
  });

  it('allows reordering/prioritizing projects using Up/Down buttons', async () => {
    await testEnv.render(<HELOCPlanner currentHomeValue={650000} currentBalance={350000} />);

    // Get the first two project inputs to verify names
    const names = () => Array.from(testEnv.container.querySelectorAll('input[type="text"]'))
      .map(i => (i as HTMLInputElement).value);
    
    // Initial order: Kitchen, Bathroom, Basement...
    expect(names()[0]).toBe('Kitchen Remodel');
    expect(names()[1]).toBe('Bathroom Remodel');

    // Click Down on the first project
    const downButtons = () => Array.from(testEnv.container.querySelectorAll('button[title="Move Down"]')) as HTMLButtonElement[];
    expect(downButtons().length).toBeGreaterThan(0);

    await act(async () => {
      downButtons()[0].click();
    });

    // Verify order is swapped: Bathroom, Kitchen, Basement...
    expect(names()[0]).toBe('Bathroom Remodel');
    expect(names()[1]).toBe('Kitchen Remodel');
  });
});
