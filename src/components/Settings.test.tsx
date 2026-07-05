import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { Settings } from './Settings';
import { createTestContainer } from '../utils/testUtils';
import { setupPasscode, getPasscodeConfig } from '../utils/storage';

// Lets async storage/crypto work settle and the resulting state update flush.
const flush = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

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
    await flush();
  };

  it('renders the settings panels', async () => {
    await testEnv.render(<Settings onClearProfile={() => {}} onImportSuccess={() => {}} />);

    expect(testEnv.container.innerHTML).toContain('Import / Export Data');
    expect(testEnv.container.innerHTML).toContain('Local Security');
    expect(testEnv.container.innerHTML).toContain('Passcode Protection');
    expect(testEnv.container.innerHTML).toContain('Danger Zone');
  });

  it('rejects an empty PIN', async () => {
    const onUpdatePin = vi.fn();
    await testEnv.render(
      <Settings onClearProfile={() => {}} onImportSuccess={() => {}} onUpdatePin={onUpdatePin} />
    );

    await clickButton('Enable PIN');
    await submitPin('');

    expect(testEnv.container.innerHTML).toContain('PIN must be at least 1 digit.');
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

    expect(testEnv.container.innerHTML).toContain('Passcode lock enabled');
    expect(onUpdatePin).toHaveBeenCalledWith('2468');
    expect(getPasscodeConfig()?.isEnabled).toBe(true);
  });

  it('refuses to disable protection with an incorrect PIN', async () => {
    await setupPasscode('1357');
    await testEnv.render(<Settings onClearProfile={() => {}} onImportSuccess={() => {}} />);

    await clickButton('Disable PIN');
    await submitPin('0000');

    expect(testEnv.container.innerHTML).toContain('Incorrect PIN');
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

    expect(testEnv.container.innerHTML).toContain('Passcode lock disabled');
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

    expect(onClearProfile).toHaveBeenCalled();
    expect(getPasscodeConfig()).toBeNull();

    vi.unstubAllGlobals();
  });
});
