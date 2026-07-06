import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { Settings } from './Settings';
import { createTestContainer, waitFor } from '../utils/testUtils';
import { setupPasscode, getPasscodeConfig } from '../utils/storage';

// Drives a controlled React input the way a user would, so onChange fires.
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Settings Component Integration Tests', () => {
  let testEnv: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    localStorage.clear();
    testEnv = createTestContainer();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  const has = (text: string) => testEnv.container.innerHTML.includes(text);

  const clickButton = async (text: string) => {
    const btn = Array.from(testEnv.container.querySelectorAll('button'))
      .find(b => b.textContent?.includes(text)) as HTMLButtonElement | undefined;
    expect(btn, `button "${text}"`).toBeDefined();
    await act(async () => {
      btn!.click();
    });
  };

  const submitPin = async (pin: string) => {
    const input = testEnv.container.querySelector('input[type="password"]') as HTMLInputElement;
    expect(input, 'PIN input').toBeDefined();
    await act(async () => {
      typeInto(input, pin);
    });
    const form = input.closest('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  };

  it('renders the settings panels', async () => {
    await testEnv.render(<Settings onClearProfile={() => {}} onImportSuccess={() => {}} />);

    expect(has('Import / Export Data')).toBe(true);
    expect(has('Local Security')).toBe(true);
    expect(has('Passcode Protection')).toBe(true);
    expect(has('Danger Zone')).toBe(true);
  });

  it('rejects an empty PIN', async () => {
    const onUpdatePin = vi.fn();
    await testEnv.render(
      <Settings onClearProfile={() => {}} onImportSuccess={() => {}} onUpdatePin={onUpdatePin} />
    );

    await clickButton('Enable PIN');
    await submitPin('');
    await waitFor(() => has('PIN must be at least 1 digit.'));

    expect(onUpdatePin).not.toHaveBeenCalled();
    expect(getPasscodeConfig()).toBeNull();
  });

  it('enables passcode protection with a valid PIN', async () => {
    const onUpdatePin = vi.fn();
    await testEnv.render(
      <Settings onClearProfile={() => {}} onImportSuccess={() => {}} onUpdatePin={onUpdatePin} />
    );

    await clickButton('Enable PIN');
    await submitPin('2468');
    await waitFor(() => has('Passcode lock enabled'));

    expect(onUpdatePin).toHaveBeenCalledWith('2468');
    expect(getPasscodeConfig()?.isEnabled).toBe(true);
  });

  it('refuses to disable protection with an incorrect PIN', async () => {
    await setupPasscode('1357');
    await testEnv.render(<Settings onClearProfile={() => {}} onImportSuccess={() => {}} />);

    await clickButton('Disable PIN');
    await submitPin('0000');
    await waitFor(() => has('Incorrect PIN'));

    expect(getPasscodeConfig()?.isEnabled).toBe(true);
  });

  it('disables protection with the correct PIN', async () => {
    await setupPasscode('1357');
    const onUpdatePin = vi.fn();
    await testEnv.render(
      <Settings onClearProfile={() => {}} onImportSuccess={() => {}} onUpdatePin={onUpdatePin} />
    );

    await clickButton('Disable PIN');
    await submitPin('1357');
    await waitFor(() => has('Passcode lock disabled'));

    expect(onUpdatePin).toHaveBeenCalledWith('');
    expect(getPasscodeConfig()).toBeNull();
  });

  it('wipes local data after confirmation', async () => {
    await setupPasscode('1357');
    const onClearProfile = vi.fn();
    // happy-dom does not implement window.confirm/alert, so stub them.
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('alert', vi.fn());

    await testEnv.render(<Settings onClearProfile={onClearProfile} onImportSuccess={() => {}} />);

    await clickButton('Wipe Local Data');
    await waitFor(() => getPasscodeConfig() === null);

    expect(onClearProfile).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('shows biometric toggle and auto-lock options when PIN is enabled, and handles change', async () => {
    (window as any).PublicKeyCredential = class {};
    Object.defineProperty(navigator, 'credentials', {
      writable: true,
      value: {
        create: vi.fn().mockResolvedValue({
          rawId: new Uint8Array([1, 2, 3, 4]).buffer
        })
      }
    });

    await setupPasscode('1357');
    await testEnv.render(
      <Settings 
        onClearProfile={() => {}} 
        onImportSuccess={() => {}} 
        currentPin="1357"
      />
    );

    expect(has('Biometric Unlock')).toBe(true);
    expect(has('Session Auto-Lock')).toBe(true);

    await clickButton('Enable Biometrics');
    await waitFor(() => has('Biometrics Enabled'));

    const select = testEnv.container.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(select, '300');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(select.value).toBe('300');

    delete (window as any).PublicKeyCredential;
  });
});
