import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPin,
  encryptData,
  decryptData,
  saveProfile,
  loadProfile,
  saveCompareProfiles,
  loadCompareProfiles,
  saveRenoList,
  loadRenoList,
  getPasscodeConfig,
  setupPasscode,
  disablePasscode,
  setAppLockedStatus,
  getAppLockedStatus,
  clearAllAppData,
  exportAppData,
  importAppData,
} from './storage';

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear();
});

describe('hashPin', () => {
  it('produces a consistent hash for same pin and salt', async () => {
    const hash1 = await hashPin('1234', 'abcdef0123456789');
    const hash2 = await hashPin('1234', 'abcdef0123456789');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different pins', async () => {
    const hash1 = await hashPin('1234', 'abcdef0123456789');
    const hash2 = await hashPin('5678', 'abcdef0123456789');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different salts', async () => {
    const hash1 = await hashPin('1234', 'abcdef0123456789');
    const hash2 = await hashPin('1234', '1234567890abcdef');
    expect(hash1).not.toBe(hash2);
  });

  it('returns a 64-character hex string (SHA-256)', async () => {
    const hash = await hashPin('999999', 'abcdef0123456789');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('encryptData / decryptData', () => {
  it('encrypts and decrypts a simple string', async () => {
    const plaintext = 'Hello, Mortimer!';
    const encrypted = await encryptData(plaintext, '1234');
    
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.salt).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(plaintext);

    const decrypted = await decryptData(encrypted.ciphertext, '1234', encrypted.salt, encrypted.iv);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypts and decrypts JSON data', async () => {
    const data = { principal: 500000, rate: 5.25, frequency: 'monthly' };
    const plaintext = JSON.stringify(data);
    const encrypted = await encryptData(plaintext, '9876');
    const decrypted = await decryptData(encrypted.ciphertext, '9876', encrypted.salt, encrypted.iv);
    expect(JSON.parse(decrypted)).toEqual(data);
  });

  it('fails to decrypt with wrong PIN', async () => {
    const encrypted = await encryptData('secret data', '1234');
    await expect(
      decryptData(encrypted.ciphertext, '0000', encrypted.salt, encrypted.iv)
    ).rejects.toThrow();
  });

  it('produces different ciphertexts for same plaintext (random salt/iv)', async () => {
    const encrypted1 = await encryptData('same text', '1234');
    const encrypted2 = await encryptData('same text', '1234');
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
  });

  it('handles empty string', async () => {
    const encrypted = await encryptData('', '1234');
    const decrypted = await decryptData(encrypted.ciphertext, '1234', encrypted.salt, encrypted.iv);
    expect(decrypted).toBe('');
  });

  it('handles long PIN', async () => {
    const longPin = '123456789012345678901234567890';
    const encrypted = await encryptData('test data', longPin);
    const decrypted = await decryptData(encrypted.ciphertext, longPin, encrypted.salt, encrypted.iv);
    expect(decrypted).toBe('test data');
  });

  it('handles unicode content', async () => {
    const text = 'Données hypothécaires: $500,000 à 5,25%';
    const encrypted = await encryptData(text, '42');
    const decrypted = await decryptData(encrypted.ciphertext, '42', encrypted.salt, encrypted.iv);
    expect(decrypted).toBe(text);
  });
});

describe('saveProfile / loadProfile', () => {
  const testProfile = { principal: 500000, interestRate: 5.25, paymentFrequency: 'monthly' };

  describe('without PIN (plaintext)', () => {
    it('saves and loads a profile', async () => {
      await saveProfile(testProfile);
      const loaded = await loadProfile();
      expect(loaded).toEqual(testProfile);
    });

    it('returns null when no profile exists', async () => {
      const loaded = await loadProfile();
      expect(loaded).toBeNull();
    });
  });

  describe('with PIN (encrypted)', () => {
    it('saves encrypted and loads with correct PIN', async () => {
      await saveProfile(testProfile, '5678');
      const loaded = await loadProfile('5678');
      expect(loaded).toEqual(testProfile);
    });

    it('returns __isEncrypted marker when PIN not provided', async () => {
      await saveProfile(testProfile, '5678');
      const loaded = await loadProfile();
      expect(loaded).toEqual({ __isEncrypted: true });
    });

    it('returns null with wrong PIN', async () => {
      await saveProfile(testProfile, '5678');
      const loaded = await loadProfile('0000');
      expect(loaded).toBeNull();
    });
  });
});

describe('saveCompareProfiles / loadCompareProfiles', () => {
  const profiles = [
    { rate: 4.5, term: 5 },
    { rate: 5.0, term: 3 },
  ];

  it('saves and loads plaintext', async () => {
    await saveCompareProfiles(profiles);
    const loaded = await loadCompareProfiles();
    expect(loaded).toEqual(profiles);
  });

  it('returns empty array when none saved', async () => {
    const loaded = await loadCompareProfiles();
    expect(loaded).toEqual([]);
  });

  it('saves encrypted and loads with PIN', async () => {
    await saveCompareProfiles(profiles, '1234');
    const loaded = await loadCompareProfiles('1234');
    expect(loaded).toEqual(profiles);
  });

  it('returns empty array when encrypted but no PIN provided', async () => {
    await saveCompareProfiles(profiles, '1234');
    const loaded = await loadCompareProfiles();
    expect(loaded).toEqual([]);
  });
});

describe('saveRenoList / loadRenoList', () => {
  const renoList = { kitchen: true, bathroom: false, cost: 25000 };

  it('saves and loads plaintext', async () => {
    await saveRenoList(renoList);
    const loaded = await loadRenoList();
    expect(loaded).toEqual(renoList);
  });

  it('returns null when none saved', async () => {
    const loaded = await loadRenoList();
    expect(loaded).toBeNull();
  });

  it('saves encrypted and loads with PIN', async () => {
    await saveRenoList(renoList, '4321');
    const loaded = await loadRenoList('4321');
    expect(loaded).toEqual(renoList);
  });
});

describe('setupPasscode / getPasscodeConfig / disablePasscode', () => {
  it('sets up a passcode config', async () => {
    await setupPasscode('1234', 'my hint');
    const config = getPasscodeConfig();
    expect(config).not.toBeNull();
    expect(config!.isEnabled).toBe(true);
    expect(config!.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(config!.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(config!.hint).toBe('my hint');
  });

  it('encrypts existing profile when setting up passcode', async () => {
    const profile = { principal: 300000 };
    await saveProfile(profile);
    await setupPasscode('5555');
    
    // Profile should now be encrypted — loading without PIN returns marker
    const loaded = await loadProfile();
    expect(loaded).toEqual({ __isEncrypted: true });
    
    // With PIN, we get the data back
    const decrypted = await loadProfile('5555');
    expect(decrypted).toEqual(profile);
  });

  it('disablePasscode decrypts data back to plaintext', async () => {
    const profile = { principal: 250000 };
    await saveProfile(profile);
    await setupPasscode('9999');
    
    const success = await disablePasscode('9999', profile);
    expect(success).toBe(true);
    
    const config = getPasscodeConfig();
    expect(config).toBeNull();
    
    const loaded = await loadProfile();
    expect(loaded).toEqual(profile);
  });

  it('disablePasscode fails with wrong PIN', async () => {
    await setupPasscode('1234');
    const success = await disablePasscode('0000');
    expect(success).toBe(false);
    // Config should still exist
    expect(getPasscodeConfig()).not.toBeNull();
  });

  it('disablePasscode returns true when no passcode exists', async () => {
    const success = await disablePasscode('anything');
    expect(success).toBe(true);
  });
});

describe('setAppLockedStatus / getAppLockedStatus', () => {
  it('defaults to unlocked', () => {
    expect(getAppLockedStatus()).toBe(false);
  });

  it('returns false without passcode config', () => {
    setAppLockedStatus(true);
    // Without a passcode config, it should still return false
    expect(getAppLockedStatus()).toBe(false);
  });

  it('returns true when passcode is configured and locked', async () => {
    await setupPasscode('1234');
    setAppLockedStatus(true);
    expect(getAppLockedStatus()).toBe(true);
  });

  it('unlocks when set to false', async () => {
    await setupPasscode('1234');
    setAppLockedStatus(true);
    setAppLockedStatus(false);
    expect(getAppLockedStatus()).toBe(false);
  });
});

describe('clearAllAppData', () => {
  it('removes all mortimer keys from localStorage', async () => {
    await saveProfile({ test: true });
    await saveCompareProfiles([{ a: 1 }]);
    await saveRenoList({ b: 2 });
    await setupPasscode('1234');
    setAppLockedStatus(true);

    clearAllAppData();

    expect(await loadProfile()).toBeNull();
    expect(await loadCompareProfiles()).toEqual([]);
    expect(await loadRenoList()).toBeNull();
    expect(getPasscodeConfig()).toBeNull();
    expect(getAppLockedStatus()).toBe(false);
  });

  it('does not affect non-mortimer localStorage keys', async () => {
    localStorage.setItem('other_key', 'preserved');
    await saveProfile({ test: true });
    
    clearAllAppData();
    
    expect(localStorage.getItem('other_key')).toBe('preserved');
  });
});

describe('exportAppData / importAppData', () => {
  it('exports all data as JSON string', async () => {
    const profile = { principal: 500000 };
    const renoList = { kitchen: true };
    const compareProfiles = [{ rate: 4.5 }];

    await saveProfile(profile);
    await saveRenoList(renoList);
    await saveCompareProfiles(compareProfiles);

    const exported = await exportAppData();
    expect(exported).not.toBeNull();
    
    const parsed = JSON.parse(exported!);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.profile).toEqual(profile);
    expect(parsed.renoList).toEqual(renoList);
    expect(parsed.compareProfiles).toEqual(compareProfiles);
    expect(parsed.exportedAt).toBeDefined();
  });

  it('imports data from JSON string', async () => {
    const data = {
      version: '1.0.0',
      profile: { principal: 300000 },
      renoList: { bathroom: true },
      compareProfiles: [{ rate: 3.5 }],
      exportedAt: '2026-01-01T00:00:00Z',
    };

    const success = await importAppData(JSON.stringify(data));
    expect(success).toBe(true);

    const loaded = await loadProfile();
    expect(loaded).toEqual(data.profile);
    const reno = await loadRenoList();
    expect(reno).toEqual(data.renoList);
    const compare = await loadCompareProfiles();
    expect(compare).toEqual(data.compareProfiles);
  });

  it('returns false for invalid JSON', async () => {
    const success = await importAppData('not json at all');
    expect(success).toBe(false);
  });

  it('handles encrypted export/import round-trip', async () => {
    const profile = { principal: 400000 };
    await saveProfile(profile, '1111');
    await setupPasscode('1111');

    const exported = await exportAppData('1111');
    expect(exported).not.toBeNull();

    // Clear and reimport
    clearAllAppData();
    const success = await importAppData(exported!, '1111');
    expect(success).toBe(true);

    const loaded = await loadProfile('1111');
    expect(loaded).toEqual(profile);
  });
});
