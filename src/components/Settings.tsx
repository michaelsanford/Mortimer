import React, { useState, useEffect } from 'react';
import { Download, Upload, Trash2, Key, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useI18n } from '../utils/i18n';
import { 
  getPasscodeConfig, 
  setupPasscode, 
  disablePasscode, 
  clearAllAppData, 
  importAppData,
  loadRenoList,
  loadCompareProfiles,
  enableBiometrics,
  disableBiometrics,
  isBiometricsEnabled,
  setAutoLockDuration,
  getAutoLockDuration
} from '../utils/storage';

interface SettingsProps {
  onClearProfile: () => void;
  onImportSuccess: () => void;
  currentPin?: string;
  onUpdatePin?: (pin: string) => void;
  profile?: any;
}

export const Settings: React.FC<SettingsProps> = ({ onClearProfile, onImportSuccess, currentPin, onUpdatePin, profile }) => {
  const { t } = useI18n();

  // Passcode States
  const [passcodeEnabled, setPasscodeEnabled] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [hint, setHint] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string>('');
  const [passcodeSuccess, setPasscodeSuccess] = useState<string>('');
  const [showPinForm, setShowPinForm] = useState<boolean>(false);

  // Biometrics & Auto-lock States
  const [biometricsActive, setBiometricsActive] = useState<boolean>(() => isBiometricsEnabled());
  const [autoLockDuration, setAutoLockDurationState] = useState<number>(() => getAutoLockDuration());

  const handleToggleBiometrics = async () => {
    try {
      setPasscodeError('');
      setPasscodeSuccess('');
      if (biometricsActive) {
        disableBiometrics();
        setBiometricsActive(false);
        setPasscodeSuccess(t.settings.biometricsDisabled || 'Biometrics Disabled');
      } else {
        if (!passcodeEnabled || !currentPin) {
          setPasscodeError('Please enable PIN lock first to use biometrics.');
          return;
        }
        await enableBiometrics(currentPin);
        setBiometricsActive(true);
        setPasscodeSuccess(t.settings.biometricsEnabled || 'Biometrics Enabled');
      }
    } catch (err: any) {
      console.warn('Biometric configuration error:', err);
      if (err.name === 'NotAllowedError' || err.message?.includes('timed out')) {
        setPasscodeError(t.settings.biometricTimedOut || 'Biometric verification was not completed. Please try again.');
      } else if (err.name === 'NotSupportedError') {
        setPasscodeError(t.settings.biometricNotSupported || 'Biometrics are not supported on this device or browser.');
      } else {
        setPasscodeError(t.settings.biometricFailed || 'Biometric configuration failed. Please try again.');
      }
    }
  };

  const handleAutoLockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const duration = parseInt(e.target.value) || 0;
    setAutoLockDuration(duration);
    setAutoLockDurationState(duration);
  };

  // Import Status
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const config = getPasscodeConfig();
    setPasscodeEnabled(!!config?.isEnabled);
  }, []);

  // Handle export — uses in-memory profile as the source of truth
  const handleExport = async () => {
    try {
      setPasscodeError('');

      // Build export object from in-memory profile and decrypted localStorage keys
      const renoList = await loadRenoList(currentPin || undefined);
      const compareProfiles = await loadCompareProfiles(currentPin || undefined);

      const exportObj = {
        version: '1.0.0',
        profile: profile || null,
        renoList,
        compareProfiles,
        exportedAt: new Date().toISOString()
      };

      const dataStr = JSON.stringify(exportObj, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mortimer-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setPasscodeError(t.settings.exportFailed);
    }
  };

  // Handle import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const success = await importAppData(content, currentPin || undefined);
      if (success) {
        setImportStatus({ type: 'success', message: t.settings.importSuccess });
        onImportSuccess();
      } else {
        setImportStatus({ type: 'error', message: t.settings.importFailed });
      }
    };
    reader.readAsText(file);
  };

  // Handle PIN passcode submission
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    setPasscodeSuccess('');

    if (pin.length === 0 || !/^\d+$/.test(pin)) {
      setPasscodeError(t.settings.pinMinDigit);
      return;
    }

    if (passcodeEnabled) {
      // Disable passcode — pass the in-memory profile so it can be saved as cleartext
      // even if the encrypted localStorage blob is corrupted
      const success = await disablePasscode(pin, profile);
      if (success) {
        setPasscodeEnabled(false);
        disableBiometrics();
        setBiometricsActive(false);
        if (onUpdatePin) onUpdatePin('');
        setPin('');
        setHint('');
        setShowPinForm(false);
        setPasscodeSuccess(t.settings.passcodeDisabled);
      } else {
        setPasscodeError(t.settings.incorrectPin);
      }
    } else {
      // Enable passcode
      await setupPasscode(pin, hint || undefined);
      setPasscodeEnabled(true);
      if (onUpdatePin) onUpdatePin(pin);
      setPin('');
      setHint('');
      setShowPinForm(false);
      setPasscodeSuccess(t.settings.passcodeEnabled);
    }
  };

  // Handle clear data
  const handleClearData = () => {
    if (window.confirm(t.settings.wipeConfirm)) {
      clearAllAppData();
      disableBiometrics();
      setBiometricsActive(false);
      setAutoLockDuration(0);
      setAutoLockDurationState(0);
      onClearProfile();
      setPasscodeEnabled(false);
      setPin('');
      setHint('');
      alert(t.settings.wipeSuccess);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>{t.settings.title}</h2>
        <p style={{ fontSize: '0.95rem' }}>{t.settings.subtitle}</p>
      </div>

      <div className="grid grid-cols-2">
        {/* Actions panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Backups Card */}
          <div className="card">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              {t.settings.importExport}
            </h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {t.settings.importExportDesc}
            </p>

            <div className="flex gap-4">
              <button type="button" className="btn btn-secondary w-full" onClick={handleExport}>
                <Download size={16} /> {t.settings.exportFile}
              </button>
              
              <label className="btn btn-secondary w-full text-center" style={{ cursor: 'pointer' }}>
                <Upload size={16} /> {t.settings.importFile}
                <input 
                  type="file" 
                  accept=".json" 
                  style={{ display: 'none' }} 
                  onChange={handleImport}
                />
              </label>
            </div>

            {importStatus && (
              <div 
                className={`alert ${importStatus.type === 'success' ? 'alert-info' : 'alert-warning'}`}
                style={{ marginTop: '1rem', marginBottom: 0 }}
              >
                {importStatus.type === 'success' ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
                <span style={{ fontSize: '0.85rem' }}>{importStatus.message}</span>
              </div>
            )}
          </div>

          {/* Security Card */}
          <div className="card">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              {t.settings.localSecurity}
            </h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              {t.settings.localSecurityDesc}
            </p>

            <div className="settings-item" style={{ borderBottom: 'none', padding: '0.5rem 0' }}>
              <div className="settings-item-info">
                <span className="settings-item-title">{t.settings.passcodeProtection}</span>
                <span className="settings-item-desc">
                  {passcodeEnabled ? t.settings.lockedWithPin : t.settings.unprotected}
                </span>
              </div>
              <button 
                type="button" 
                className={`btn ${passcodeEnabled ? 'btn-danger' : 'btn-primary'} btn-sm`}
                onClick={() => setShowPinForm(!showPinForm)}
              >
                <Key size={14} /> {passcodeEnabled ? t.settings.disablePin : t.settings.enablePin}
              </button>
            </div>

            {/* PIN Setup Form */}
            {showPinForm && (
              <form onSubmit={handlePinSubmit} style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  {passcodeEnabled ? t.settings.enterPinToDisable : t.settings.configureNewPin}
                </h4>
                
                <div className="flex gap-4">
                  <div className="form-group w-full" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>{t.settings.pinLabel}</label>
                    <input 
                      type="password" 
                      placeholder={t.settings.pinPlaceholder}
                      className="form-input" 
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  {!passcodeEnabled && (
                    <div className="form-group w-full" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>{t.settings.hintLabel}</label>
                      <input 
                        type="text" 
                        placeholder={t.settings.hintPlaceholder}
                        className="form-input" 
                        value={hint}
                        onChange={(e) => setHint(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary w-full mt-4 btn-sm">
                  {t.settings.confirmCode}
                </button>
              </form>
            )}

            {passcodeError && <p className="color-danger" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>{passcodeError}</p>}
            {passcodeSuccess && <p className="color-success" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>{passcodeSuccess}</p>}

            {passcodeEnabled && (
              <>
                {/* Biometrics Toggle Option */}
                <div className="settings-item" style={{ borderTop: '1px solid var(--border-color)', marginTop: '1.25rem', paddingTop: '1.25rem' }}>
                  <div className="settings-item-info">
                    <span className="settings-item-title">{t.settings.biometricProtection}</span>
                    <span className="settings-item-desc">{t.settings.biometricProtectionDesc}</span>
                  </div>
                  <button
                    type="button"
                    className={`btn ${biometricsActive ? 'btn-danger' : 'btn-primary'} btn-sm`}
                    onClick={handleToggleBiometrics}
                  >
                    {biometricsActive ? t.settings.disableBiometrics : t.settings.enableBiometrics}
                  </button>
                </div>

                {/* Auto-Lock Duration Option */}
                <div className="settings-item" style={{ borderTop: '1px solid var(--border-color)', marginTop: '1.25rem', paddingTop: '1.25rem', borderBottom: 'none', paddingBottom: 0 }}>
                  <div className="settings-item-info">
                    <span className="settings-item-title">{t.settings.autoLockSession}</span>
                    <span className="settings-item-desc">{t.settings.autoLockSessionDesc}</span>
                  </div>
                  <div style={{ minWidth: '150px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>{t.settings.autoLockDuration}</label>
                    <select
                      className="form-select"
                      style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                      value={autoLockDuration}
                      onChange={handleAutoLockChange}
                    >
                      <option value="0">{t.settings.autoLockDisabled}</option>
                      <option value="30">{t.settings.autoLock30s}</option>
                      <option value="60">{t.settings.autoLock1m}</option>
                      <option value="300">{t.settings.autoLock5m}</option>
                      <option value="900">{t.settings.autoLock15m}</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Destructive Actions Card */}
          <div className="card" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
            <h3 style={{ borderBottom: '1px solid rgba(239,68,68,0.2)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--color-danger)' }}>
              {t.settings.dangerZone}
            </h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {t.settings.dangerDesc}
            </p>
            <button type="button" className="btn btn-danger w-full justify-between" onClick={handleClearData}>
              <span>{t.settings.wipeData}</span>
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Legal & Compliance panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Privacy Compliance Card */}
          <div className="card">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              {t.settings.privacyStatement}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <p style={{ margin: 0 }}>
                {t.settings.privacyStatementDesc}
              </p>
              <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>
                  <strong>{t.settings.zeroDataCollection}</strong>: {t.settings.zeroDataDesc}
                </li>
                <li>
                  <strong>{t.settings.informedConsent}</strong>: {t.settings.informedConsentDesc}
                </li>
                <li>
                  <strong>{t.settings.encryption}</strong>: {t.settings.encryptionDesc}
                </li>
              </ul>
            </div>
          </div>

          {/* Disclaimer Card */}
          <div className="card card-accent">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              {t.settings.disclaimerTitle}
            </h3>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <p style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: '0.5rem' }}>
                {t.settings.disclaimerText1}
              </p>
              <p style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: '0.5rem' }}>
                {t.settings.disclaimerText2}
              </p>
              <p style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: '0.5rem' }}>
                {t.settings.disclaimerText3}
              </p>
              <p style={{ margin: '1rem 0 0 0' }}>
                {t.settings.disclaimerLong}
              </p>
            </div>
          </div>

          {/* GitHub Integration card */}
          <div className="card">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              {t.settings.openSource}
            </h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {t.settings.openSourceDesc}
            </p>
            <a 
              href="https://github.com/michaelsanford/Mortimer/issues/new/choose" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-secondary w-full"
            >
              {t.settings.reportIssues}
            </a>
          </div>

        </div>
      </div>
    </div>
  );
};
