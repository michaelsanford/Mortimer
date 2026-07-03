import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, Check, Delete } from 'lucide-react';
import { hashPin, getPasscodeConfig } from '../utils/storage';
import { useI18n } from '../utils/i18n';

interface PasscodeLockProps {
  onUnlock: (pin: string) => void;
}

export const PasscodeLock: React.FC<PasscodeLockProps> = ({ onUnlock }) => {
  const { t } = useI18n();
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [hint, setHint] = useState<string | undefined>(undefined);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [validating, setValidating] = useState<boolean>(false);

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

  const handleSubmit = async () => {
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
  };

  // Allow Enter key to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && pin.length > 0) {
        handleSubmit();
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, validating]);

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
      </div>
    </div>
  );
};
