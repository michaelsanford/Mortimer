import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { PasscodeLock } from './PasscodeLock';
import { createTestContainer } from '../utils/testUtils';
import { setupPasscode } from '../utils/storage';

// Lets the async crypto (hashPin) settle and any resulting state update flush.
const flush = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

describe('PasscodeLock Component Integration Tests', () => {
  let testEnv: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    localStorage.clear();
    testEnv = createTestContainer();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  const pressKey = async (digit: string) => {
    const key = Array.from(testEnv.container.querySelectorAll('button.pin-key'))
      .find(b => b.textContent?.trim() === digit) as HTMLButtonElement | undefined;
    expect(key, `keypad button "${digit}"`).toBeDefined();
    await act(async () => {
      key!.click();
    });
  };

  const submit = async () => {
    const btn = testEnv.container.querySelector('button[aria-label="Submit PIN"]') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    await flush();
  };

  it('renders the lock screen', async () => {
    await testEnv.render(<PasscodeLock onUnlock={() => {}} />);

    expect(testEnv.container.innerHTML).toContain('App Locked');
    expect(testEnv.container.innerHTML).toContain('Enter your PIN');
    expect(testEnv.container.innerHTML).toContain('No digits entered');
  });

  it('shows a filled dot for each entered digit', async () => {
    await testEnv.render(<PasscodeLock onUnlock={() => {}} />);

    await pressKey('1');
    await pressKey('2');

    expect(testEnv.container.querySelectorAll('.pin-dot.filled').length).toBe(2);
  });

  it('removes the last digit on delete', async () => {
    await testEnv.render(<PasscodeLock onUnlock={() => {}} />);

    await pressKey('1');
    await pressKey('2');

    const del = testEnv.container.querySelector('button[aria-label="Delete last digit"]') as HTMLButtonElement;
    await act(async () => {
      del.click();
    });

    expect(testEnv.container.querySelectorAll('.pin-dot.filled').length).toBe(1);
  });

  it('calls onUnlock with the PIN when the correct code is entered', async () => {
    await setupPasscode('1234');
    const onUnlock = vi.fn();
    await testEnv.render(<PasscodeLock onUnlock={onUnlock} />);

    await pressKey('1');
    await pressKey('2');
    await pressKey('3');
    await pressKey('4');
    await submit();

    expect(onUnlock).toHaveBeenCalledWith('1234');
  });

  it('shows an error and does not unlock on an incorrect code', async () => {
    await setupPasscode('1234');
    const onUnlock = vi.fn();
    await testEnv.render(<PasscodeLock onUnlock={onUnlock} />);

    await pressKey('9');
    await pressKey('9');
    await pressKey('9');
    await pressKey('9');
    await submit();

    expect(onUnlock).not.toHaveBeenCalled();
    expect(testEnv.container.querySelector('.pin-container')?.className).toContain('shake');
  });

  it('reveals the hint on request when one is configured', async () => {
    await setupPasscode('1234', 'first pet');
    await testEnv.render(<PasscodeLock onUnlock={() => {}} />);

    const hintBtn = Array.from(testEnv.container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Show Hint')) as HTMLButtonElement | undefined;
    expect(hintBtn, 'Show Hint button').toBeDefined();

    await act(async () => {
      hintBtn!.click();
    });

    expect(testEnv.container.innerHTML).toContain('first pet');
  });
});
