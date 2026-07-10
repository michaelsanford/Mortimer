// LocalStorage Keys
const STORAGE_PREFIX = 'mortimer_';
const KEYS = {
  PROFILE: `${STORAGE_PREFIX}profile`,
  PASSCODE_CONFIG: `${STORAGE_PREFIX}passcode_config`,
  IS_LOCKED: `${STORAGE_PREFIX}is_locked`,
  RENO_LIST: `${STORAGE_PREFIX}reno_list`,
  COMPARE_PROFILES: `${STORAGE_PREFIX}compare_profiles`
};

export interface PasscodeConfig {
  isEnabled: boolean;
  salt: string; // Hex string for key derivation
  hash: string; // SHA-256 of PIN + salt
  hint?: string;
}

export interface AppDataExport {
  version: string;
  profile: any;
  renoList: any;
  compareProfiles: any;
  exportedAt: string;
}

// Convert string to ArrayBuffer
function stringToArrayBuffer(str: string): Uint8Array {
  const enc = new TextEncoder();
  return enc.encode(str);
}

// Convert ArrayBuffer or Uint8Array to Hex string
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.prototype.map.call(array, (x: any) => ('00' + x.toString(16)).slice(-2)).join('');
}

// Convert Hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const view = new Uint8Array(hex.length / 2);
  for (let i = 0; i < view.length; i++) {
    view[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return view;
}

// Generate a random salt
function generateSalt(): string {
  const arr = new Uint8Array(16);
  window.crypto.getRandomValues(arr);
  return bufferToHex(arr);
}

// Hash PIN with Salt
export async function hashPin(pin: string, salt: string): Promise<string> {
  const msgUint8 = stringToArrayBuffer(pin + salt);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8 as any);
  return bufferToHex(hashBuffer);
}

// Derive a CryptoKey from PIN and Salt
async function deriveKey(pin: string, saltHex: string): Promise<CryptoKey> {
  const pinBuffer = stringToArrayBuffer(pin);
  const salt = hexToUint8Array(saltHex);
  
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    pinBuffer as any,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt plaintext with PIN
export async function encryptData(plaintext: string, pin: string): Promise<{ ciphertext: string; salt: string; iv: string }> {
  const salt = generateSalt();
  const key = await deriveKey(pin, salt);
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = stringToArrayBuffer(plaintext);
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any
    },
    key,
    encodedText as any
  );
  
  return {
    ciphertext: bufferToHex(ciphertextBuffer),
    salt,
    iv: bufferToHex(iv)
  };
}

// Decrypt ciphertext with PIN
export async function decryptData(ciphertextHex: string, pin: string, salt: string, ivHex: string): Promise<string> {
  const key = await deriveKey(pin, salt);
  const ciphertext = hexToUint8Array(ciphertextHex);
  const iv = hexToUint8Array(ivHex);
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as any
    },
    key,
    ciphertext as any
  );
  
  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

// Save profile to LocalStorage (Encrypted if PIN is active)
export async function saveProfile(profile: any, pin?: string): Promise<void> {
  const dataStr = JSON.stringify(profile);
  
  if (pin) {
    try {
      const encrypted = await encryptData(dataStr, pin);
      localStorage.setItem(KEYS.PROFILE, JSON.stringify(encrypted));
    } catch (err) {
      console.error('Failed to encrypt profile', err);
    }
  } else {
    localStorage.setItem(KEYS.PROFILE, dataStr);
  }
}

// Load profile from LocalStorage (Decrypts if PIN is active and provided)
export async function loadProfile(pin?: string): Promise<any | null> {
  const stored = localStorage.getItem(KEYS.PROFILE);
  if (!stored) return null;
  
  try {
    const parsed = JSON.parse(stored);
    
    // Check if stored data is encrypted (has ciphertext, salt, iv)
    if (parsed && typeof parsed === 'object' && 'ciphertext' in parsed && 'salt' in parsed && 'iv' in parsed) {
      if (!pin) {
        // Needs pin to unlock
        return { __isEncrypted: true };
      }
      try {
        const decrypted = await decryptData(parsed.ciphertext, pin, parsed.salt, parsed.iv);
        return JSON.parse(decrypted);
      } catch {
        console.error('Decryption failed. Incorrect PIN.');
        return null;
      }
    }
    
    return parsed;
  } catch {
    // Stored string is raw JSON (not encrypted)
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
}

// Save comparison profiles list (encrypted if PIN is provided)
export async function saveCompareProfiles(profiles: any[], pin?: string): Promise<void> {
  const dataStr = JSON.stringify(profiles);
  if (pin) {
    try {
      const encrypted = await encryptData(dataStr, pin);
      localStorage.setItem(KEYS.COMPARE_PROFILES, JSON.stringify(encrypted));
    } catch (err) {
      console.error('Failed to encrypt compare profiles', err);
    }
  } else {
    localStorage.setItem(KEYS.COMPARE_PROFILES, dataStr);
  }
}

// Load comparison profiles list (decrypts if PIN is provided)
export async function loadCompareProfiles(pin?: string): Promise<any[]> {
  const stored = localStorage.getItem(KEYS.COMPARE_PROFILES);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && 'ciphertext' in parsed && 'salt' in parsed && 'iv' in parsed) {
      if (!pin) return [];
      try {
        const decrypted = await decryptData(parsed.ciphertext, pin, parsed.salt, parsed.iv);
        return JSON.parse(decrypted);
      } catch {
        return [];
      }
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Save reno checklist state (encrypted if PIN is provided)
export async function saveRenoList(list: any, pin?: string): Promise<void> {
  const dataStr = JSON.stringify(list);
  if (pin) {
    try {
      const encrypted = await encryptData(dataStr, pin);
      localStorage.setItem(KEYS.RENO_LIST, JSON.stringify(encrypted));
    } catch (err) {
      console.error('Failed to encrypt reno list', err);
    }
  } else {
    localStorage.setItem(KEYS.RENO_LIST, dataStr);
  }
}

// Load reno checklist state (decrypts if PIN is provided)
export async function loadRenoList(pin?: string): Promise<any> {
  const stored = localStorage.getItem(KEYS.RENO_LIST);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && 'ciphertext' in parsed && 'salt' in parsed && 'iv' in parsed) {
      if (!pin) return null;
      try {
        const decrypted = await decryptData(parsed.ciphertext, pin, parsed.salt, parsed.iv);
        return JSON.parse(decrypted);
      } catch {
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

// Check if passcode lock is set up
export function getPasscodeConfig(): PasscodeConfig | null {
  const stored = localStorage.getItem(KEYS.PASSCODE_CONFIG);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

// Set up passcode lock
export async function setupPasscode(pin: string, hint?: string): Promise<void> {
  const salt = generateSalt();
  const hash = await hashPin(pin, salt);
  
  const config: PasscodeConfig = {
    isEnabled: true,
    salt,
    hash,
    hint
  };
  
  localStorage.setItem(KEYS.PASSCODE_CONFIG, JSON.stringify(config));
  
  // Encrypt all existing data with the new PIN
  const currentProfile = await loadProfile();
  if (currentProfile && !currentProfile.__isEncrypted) {
    await saveProfile(currentProfile, pin);
  }

  const currentRenoList = await loadRenoList();
  if (currentRenoList) {
    await saveRenoList(currentRenoList, pin);
  }

  const currentCompareProfiles = await loadCompareProfiles();
  if (currentCompareProfiles && currentCompareProfiles.length > 0) {
    await saveCompareProfiles(currentCompareProfiles, pin);
  }
}

// Disable passcode lock
export async function disablePasscode(pin: string, inMemoryProfile?: any): Promise<boolean> {
  const config = getPasscodeConfig();
  if (!config) return true;
  
  const hash = await hashPin(pin, config.salt);
  if (hash !== config.hash) {
    return false; // Wrong PIN
  }
  
  // Decrypt all data back to plaintext
  let profileToSave = await loadProfile(pin);
  if (!profileToSave || profileToSave.__isEncrypted) {
    profileToSave = inMemoryProfile || null;
  }

  const renoList = await loadRenoList(pin);
  const compareProfiles = await loadCompareProfiles(pin);
  
  localStorage.removeItem(KEYS.PASSCODE_CONFIG);
  localStorage.removeItem(KEYS.IS_LOCKED);
  
  // Re-save everything as plaintext
  if (profileToSave) {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(profileToSave));
  }
  if (renoList) {
    localStorage.setItem(KEYS.RENO_LIST, JSON.stringify(renoList));
  }
  if (compareProfiles && compareProfiles.length > 0) {
    localStorage.setItem(KEYS.COMPARE_PROFILES, JSON.stringify(compareProfiles));
  }
  
  return true;
}

// Set locked status (for app locking on start or blur)
export function setAppLockedStatus(locked: boolean): void {
  if (locked) {
    localStorage.setItem(KEYS.IS_LOCKED, 'true');
  } else {
    localStorage.removeItem(KEYS.IS_LOCKED);
  }
}

// Get locked status
export function getAppLockedStatus(): boolean {
  const config = getPasscodeConfig();
  if (!config || !config.isEnabled) return false;
  return localStorage.getItem(KEYS.IS_LOCKED) === 'true';
}

// Clear all app data
export function clearAllAppData(): void {
  localStorage.removeItem(KEYS.PROFILE);
  localStorage.removeItem(KEYS.PASSCODE_CONFIG);
  localStorage.removeItem(KEYS.IS_LOCKED);
  localStorage.removeItem(KEYS.RENO_LIST);
  localStorage.removeItem(KEYS.COMPARE_PROFILES);
  localStorage.removeItem('mortimer_locale');

  // Deregister service workers if in browser
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      })
      .catch((err) => console.error('[SW] Unregister failed:', err));
  }

  // Clear cache storage if in browser
  if (typeof window !== 'undefined' && 'caches' in window) {
    caches.keys()
      .then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      })
      .catch((err) => console.error('[Cache] Clear failed:', err));
  }
}

// Export data to a JSON string
export async function exportAppData(pin?: string): Promise<string | null> {
  const stored = localStorage.getItem(KEYS.PROFILE);
  let isProfileEncrypted = false;
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && 'ciphertext' in parsed && 'salt' in parsed && 'iv' in parsed) {
        isProfileEncrypted = true;
      }
    } catch {}
  }

  const profile = await loadProfile(pin);
  if (isProfileEncrypted && (!profile || profile.__isEncrypted)) {
    return null; // Needs unlock or incorrect PIN
  }
  
  const renoList = await loadRenoList(pin);
  const compareProfiles = await loadCompareProfiles(pin);
  
  const exportObj: AppDataExport = {
    version: '1.0.0',
    profile,
    renoList,
    compareProfiles,
    exportedAt: new Date().toISOString()
  };
  
  return JSON.stringify(exportObj, null, 2);
}

// Import data from a JSON string
export async function importAppData(jsonStr: string, pin?: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(jsonStr) as AppDataExport;
    
    if (parsed.version !== '1.0.0' && !parsed.profile) {
      return false; // Invalid file format
    }
    
    // Save data (encrypted if PIN is provided)
    if (parsed.profile) {
      await saveProfile(parsed.profile, pin);
    }
    if (parsed.renoList) {
      await saveRenoList(parsed.renoList, pin);
    }
    if (parsed.compareProfiles) {
      await saveCompareProfiles(parsed.compareProfiles, pin);
    }
    
    return true;
  } catch (e) {
    console.error('Failed to import app data', e);
    return false;
  }
}

export async function enableBiometrics(pin: string): Promise<void> {
  if (!window.PublicKeyCredential) {
    throw new Error("Biometrics not supported on this device");
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  const userId = new Uint8Array(16);
  window.crypto.getRandomValues(userId);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Mortimer" },
      user: {
        id: userId,
        name: "mortimer-user",
        displayName: "Mortimer User"
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      authenticatorSelection: { userVerification: "required" }
    }
  }) as PublicKeyCredential;

  if (!credential) {
    throw new Error("Biometric registration cancelled");
  }

  const credentialIdHex = bufferToHex(credential.rawId);
  localStorage.setItem('biometric_credential_id', credentialIdHex);
  
  const bioKey = "mortimer-bio-secret-key-123";
  const encryptedPin = await encryptData(pin, bioKey);
  
  localStorage.setItem('biometric_encrypted_pin', JSON.stringify(encryptedPin));
  localStorage.setItem('biometric_enabled', 'true');
}

export function disableBiometrics(): void {
  localStorage.removeItem('biometric_credential_id');
  localStorage.removeItem('biometric_encrypted_pin');
  localStorage.removeItem('biometric_enabled');
}

export function isBiometricsEnabled(): boolean {
  return localStorage.getItem('biometric_enabled') === 'true';
}

export async function unlockWithBiometrics(): Promise<string> {
  if (!isBiometricsEnabled()) {
    throw new Error("Biometrics not enabled");
  }

  const credentialIdHex = localStorage.getItem('biometric_credential_id');
  const encryptedPinStr = localStorage.getItem('biometric_encrypted_pin');
  
  if (!credentialIdHex || !encryptedPinStr) {
    throw new Error("Biometric configuration corrupted");
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  const credentialId = hexToUint8Array(credentialIdHex);

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: credentialId as any, type: "public-key" }],
      userVerification: "required"
    }
  });

  if (!assertion) {
    throw new Error("Biometric authentication cancelled");
  }

  const bioKey = "mortimer-bio-secret-key-123";
  const parsed = JSON.parse(encryptedPinStr);
  return await decryptData(parsed.ciphertext, bioKey, parsed.salt, parsed.iv);
}

export function setAutoLockDuration(seconds: number): void {
  localStorage.setItem('auto_lock_duration', String(seconds));
}

export function getAutoLockDuration(): number {
  const stored = localStorage.getItem('auto_lock_duration');
  return stored ? parseInt(stored) || 0 : 0;
}
