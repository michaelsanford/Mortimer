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
    view[i] = parseInt(hex.substring(i * 2, 2), 16);
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
      } catch (err) {
        console.error('Decryption failed. Incorrect PIN.');
        return null;
      }
    }
    
    return parsed;
  } catch (e) {
    // Stored string is raw JSON (not encrypted)
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
}

// Save comparison profiles list
export function saveCompareProfiles(profiles: any[]): void {
  localStorage.setItem(KEYS.COMPARE_PROFILES, JSON.stringify(profiles));
}

// Load comparison profiles list
export function loadCompareProfiles(): any[] {
  const stored = localStorage.getItem(KEYS.COMPARE_PROFILES);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Save reno checklist state
export function saveRenoList(list: any): void {
  localStorage.setItem(KEYS.RENO_LIST, JSON.stringify(list));
}

// Load reno checklist state
export function loadRenoList(): any {
  const stored = localStorage.getItem(KEYS.RENO_LIST);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
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
  
  // Encrypt current profile if it exists unencrypted
  const currentProfile = await loadProfile();
  if (currentProfile && !currentProfile.__isEncrypted) {
    await saveProfile(currentProfile, pin);
  }
}

// Disable passcode lock
export async function disablePasscode(pin: string): Promise<boolean> {
  const config = getPasscodeConfig();
  if (!config) return true;
  
  const hash = await hashPin(pin, config.salt);
  if (hash !== config.hash) {
    return false; // Wrong PIN
  }
  
  // Decrypt and save profile back as unencrypted
  const decryptedProfile = await loadProfile(pin);
  localStorage.removeItem(KEYS.PASSCODE_CONFIG);
  localStorage.removeItem(KEYS.IS_LOCKED);
  
  if (decryptedProfile) {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(decryptedProfile));
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
    } catch (e) {}
  }

  const profile = await loadProfile(pin);
  if (isProfileEncrypted && (!profile || profile.__isEncrypted)) {
    return null; // Needs unlock or incorrect PIN
  }
  
  const renoList = loadRenoList();
  const compareProfiles = loadCompareProfiles();
  
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
    
    // Save data
    if (parsed.profile) {
      await saveProfile(parsed.profile, pin);
    }
    if (parsed.renoList) {
      saveRenoList(parsed.renoList);
    }
    if (parsed.compareProfiles) {
      saveCompareProfiles(parsed.compareProfiles);
    }
    
    return true;
  } catch (e) {
    console.error('Failed to import app data', e);
    return false;
  }
}
