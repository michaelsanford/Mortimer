import React, { useState, useEffect, useCallback } from 'react';
import { Lock, AlertCircle, Check, Delete, Fingerprint, Trash2 } from 'lucide-react';
import { hashPin, getPasscodeConfig, isBiometricsEnabled, unlockWithBiometrics, clearAllAppData, disableBiometrics } from '../utils/storage';
import { useI18n } from '../utils/i18n';

interface PasscodeLockProps {
  onUnlock: (pin: string) => void;
  onWipeData?: () => void;
}

export const PasscodeLock: React.FC<PasscodeLockProps> = ({ onUnlock, onWipeData }) => {
  const { t } = useI18n();
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [hint, setHint] = useState<string | undefined>(undefined);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [validating, setValidating] = useState<boolean>(false);

  const [biometricsAvailable] = useState<boolean>(() => isBiometricsEnabled());
  const [biometricsError, setBiometricsError] = useState<string>('');

  const handleBiometricsUnlock = useCallback(async () => {
    try {
      setBiometricsError('');
      const unlockedPin = await unlockWithBiometrics();
      if (unlockedPin) {
        onUnlock(unlockedPin);
      }
    } catch (err: any) {
      console.warn('Biometric unlock failed/cancelled:', err);
      // Only show user-facing errors for genuine failures, not cancellations
      if (err.name === 'NotAllowedError' || err.message?.includes('cancelled')) {
        // User cancelled or timed out — silent
      } else if (err.name === 'NotSupportedError') {
        setBiometricsError(t.settings?.biometricNotSupported || 'Biometrics are not supported on this device or browser.');
      } else {
        setBiometricsError(t.settings?.biometricFailed || 'Biometric unlock failed. Please enter your PIN.');
      }
    }
  }, [onUnlock]);

  useEffect(() => {
    if (biometricsAvailable) {
      const timer = setTimeout(() => {
        void handleBiometricsUnlock();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [biometricsAvailable, handleBiometricsUnlock]);

  useEffect(() => {
    const config = getPasscodeConfig();
    if (config?.hint) {
      setHint(config.hint);
    }
  }, []);

  const handleKeyPress = (num: string) => {
    setError(false);
    setPin(prev => prev + num);
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleSubmit = useCallback(async () => {
    if (pin.length === 0 || validating) return;

    setValidating(true);
    const config = getPasscodeConfig();
    if (!config) {
      onUnlock('');
      return;
    }

    const hashed = await hashPin(pin, config.salt);
    if (hashed === config.hash) {
      onUnlock(pin);
    } else {
      setError(true);
      setTimeout(() => {
        setPin('');
        setValidating(false);
      }, 300);
    }
  }, [pin, validating, onUnlock]);

  // Allow Enter key to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && pin.length > 0) {
        void handleSubmit();
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, handleSubmit]);

  return (
    <div className="pin-overlay">
      <div className={`pin-container ${error ? 'shake' : ''}`}>
        <div className="logo-icon mb-4" style={{ margin: '0 auto', width: '3.5rem', height: '3.5rem', borderRadius: '1rem' }}>
          {error ? <AlertCircle size={28} className="color-danger" /> : <Lock size={28} />}
        </div>
        
        <h2 className="mt-4" style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
          {t.passcode.appLocked}
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {t.passcode.enterPin}
        </p>

        {/* PIN display - shows dots for entered digits */}
        <div className="pin-dots" aria-live="polite" aria-label={`${pin.length} digits entered`}>
          {pin.length === 0 ? (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.passcode.noDigits}</span>
          ) : (
            Array.from({ length: Math.min(pin.length, 12) }).map((_, i) => (
              <div 
                key={i} 
                className={`pin-dot filled ${error ? 'color-danger' : ''}`}
                style={error ? { borderColor: 'var(--color-danger)', backgroundColor: 'var(--color-danger)' } : {}}
              />
            ))
          )}
          {pin.length > 12 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>+{pin.length - 12}</span>
          )}
        </div>

        <div className="pin-grid mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button 
              key={num} 
              type="button" 
              className="pin-key"
              onClick={() => handleKeyPress(num)}
              disabled={validating}
            >
              {num}
            </button>
          ))}
          <button 
            type="button" 
            className="pin-key action" 
            onClick={handleDelete}
            disabled={validating || pin.length === 0}
            aria-label="Delete last digit"
          >
            <Delete size={18} />
          </button>
          <button 
            type="button" 
            className="pin-key" 
            onClick={() => handleKeyPress('0')}
            disabled={validating}
          >
            0
          </button>
          <button 
            type="button" 
            className="pin-key action accept" 
            onClick={handleSubmit}
            disabled={validating || pin.length === 0}
            aria-label="Submit PIN"
            style={pin.length > 0 ? { backgroundColor: 'var(--color-success)', color: 'white', borderColor: 'var(--color-success)' } : {}}
          >
            <Check size={20} />
          </button>
        </div>

        {biometricsAvailable && (
          <div style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm flex align-center gap-2"
              style={{ margin: '0 auto', padding: '0.4rem 1rem' }}
              onClick={handleBiometricsUnlock}
            >
              <Fingerprint size={16} />
              {t.settings?.unlockBiometricsBtn || 'Unlock with Biometrics'}
            </button>
            {biometricsError && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '0.5rem' }}>
                {biometricsError}
              </p>
            )}
          </div>
        )}

        {hint && (
          <div style={{ marginTop: '1rem' }}>
            {showHint ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-accent)', fontStyle: 'italic' }}>
                {t.passcode.hint} {hint}
              </p>
            ) : (
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowHint(true)}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                {t.passcode.showHint}
              </button>
            )}
          </div>
        )}

        {/* PIN disclaimer and forgot PIN option */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
            {t.passcode.pinDisclaimer || 'Your PIN is never stored. It is used to encrypt your data and lock the app. If you forget your PIN, you will need to wipe your saved data.'}
          </p>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', opacity: 0.85 }}
            onClick={() => {
              if (window.confirm(t.passcode.forgotPinConfirm || 'This will permanently delete all your saved mortgage data, renovation checklists, and security settings. This cannot be undone. Continue?')) {
                clearAllAppData();
                disableBiometrics();
                if (onWipeData) {
                  onWipeData();
                } else {
                  window.location.reload();
                }
              }
            }}
          >
            <Trash2 size={12} />
            {t.passcode.forgotPinBtn || 'Forgot PIN? Wipe Data'}
          </button>
        </div>
      </div>
    </div>
  );
};
