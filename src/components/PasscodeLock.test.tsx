import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { PasscodeLock } from './PasscodeLock';
import { createTestContainer, waitFor } from '../utils/testUtils';
import { setupPasscode, enableBiometrics } from '../utils/storage';

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
    await waitFor(() => onUnlock.mock.calls.length > 0);

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
    await waitFor(() => testEnv.container.querySelector('.pin-container')?.className.includes('shake') ?? false);

    expect(onUnlock).not.toHaveBeenCalled();
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

  it('allows unlocking using biometrics when enabled', async () => {
    (window as any).PublicKeyCredential = class {};
    Object.defineProperty(navigator, 'credentials', {
      writable: true,
      value: {
        create: vi.fn().mockResolvedValue({
          rawId: new Uint8Array([1, 2, 3, 4]).buffer
        }),
        get: vi.fn().mockResolvedValue({ id: 'test-cred-id' })
      }
    });

    await enableBiometrics('1234');

    const onUnlock = vi.fn();
    await testEnv.render(<PasscodeLock onUnlock={onUnlock} />);

    const bioBtn = Array.from(testEnv.container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Unlock with Biometrics')) as HTMLButtonElement;
    
    expect(bioBtn).toBeDefined();

    await act(async () => {
      bioBtn.click();
    });

    await waitFor(() => onUnlock.mock.calls.length > 0);
    expect(onUnlock).toHaveBeenCalled();

    delete (window as any).PublicKeyCredential;
  });

  it('wipes all local data when forgot PIN is clicked and confirmed', async () => {
    const confirmFn = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmFn);
    const onWipeData = vi.fn();
    
    localStorage.setItem('mortimer_profile', JSON.stringify({ balance: 400000 }));
    
    await testEnv.render(<PasscodeLock onUnlock={() => {}} onWipeData={onWipeData} />);
    
    const wipeBtn = Array.from(testEnv.container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Forgot PIN? Wipe Data')) as HTMLButtonElement | undefined;
    expect(wipeBtn, 'Forgot PIN button').toBeDefined();
    
    await act(async () => {
      wipeBtn!.click();
    });
    
    expect(confirmFn).toHaveBeenCalled();
    expect(onWipeData).toHaveBeenCalled();
    expect(localStorage.getItem('mortimer_profile')).toBeNull();
    
    vi.unstubAllGlobals();
  });
});
