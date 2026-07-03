import React, { useState, useEffect } from 'react';
import { Download, Upload, Trash2, Key, ShieldCheck, AlertTriangle } from 'lucide-react';
import { 
  getPasscodeConfig, 
  setupPasscode, 
  disablePasscode, 
  clearAllAppData, 
  exportAppData, 
  importAppData 
} from '../utils/storage';

interface SettingsProps {
  onClearProfile: () => void;
  onImportSuccess: () => void;
  currentPin?: string;
}

export const Settings: React.FC<SettingsProps> = ({ onClearProfile, onImportSuccess, currentPin }) => {
  // Passcode States
  const [passcodeEnabled, setPasscodeEnabled] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [hint, setHint] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string>('');
  const [passcodeSuccess, setPasscodeSuccess] = useState<string>('');
  const [showPinForm, setShowPinForm] = useState<boolean>(false);

  // Import Status
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const config = getPasscodeConfig();
    setPasscodeEnabled(!!config?.isEnabled);
  }, []);

  // Handle export
  const handleExport = async () => {
    try {
      const dataStr = await exportAppData(currentPin || pin || undefined);
      if (!dataStr) {
        setPasscodeError('Please unlock the app or verify passcode to export.');
        return;
      }
      
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
      setPasscodeError('Export failed.');
    }
  };

  // Handle import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const success = await importAppData(content, pin || undefined);
      if (success) {
        setImportStatus({ type: 'success', message: 'Data imported successfully! Reloading profile...' });
        onImportSuccess();
      } else {
        setImportStatus({ type: 'error', message: 'Import failed. Verify the file layout.' });
      }
    };
    reader.readAsText(file);
  };

  // Handle PIN passcode submission
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    setPasscodeSuccess('');

    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      setPasscodeError('PIN must be exactly 4 digits.');
      return;
    }

    if (passcodeEnabled) {
      // Disable passcode
      const success = await disablePasscode(pin);
      if (success) {
        setPasscodeEnabled(false);
        setPin('');
        setHint('');
        setShowPinForm(false);
        setPasscodeSuccess('Passcode lock disabled successfully!');
      } else {
        setPasscodeError('Incorrect PIN. Unable to disable.');
      }
    } else {
      // Enable passcode
      await setupPasscode(pin, hint || undefined);
      setPasscodeEnabled(true);
      setPin('');
      setHint('');
      setShowPinForm(false);
      setPasscodeSuccess('Passcode lock enabled! Stored data is now encrypted.');
    }
  };

  // Handle clear data
  const handleClearData = () => {
    if (window.confirm('WARNING: This will delete all your local configurations, renovation checklists, and passcode options. This action is irreversible. Proceed?')) {
      clearAllAppData();
      onClearProfile();
      setPasscodeEnabled(false);
      setPin('');
      setHint('');
      alert('All local app data cleared.');
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>Settings & Privacy</h2>
        <p style={{ fontSize: '0.95rem' }}>Configure device security, backup configurations, and read about our local-only privacy compliance.</p>
      </div>

      <div className="grid grid-cols-2">
        {/* Actions panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Backups Card */}
          <div className="card">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Import / Export Data
            </h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Backup your mortgage settings and renovation checklists to a file on your device, or restore data from a previous export.
            </p>

            <div className="flex gap-4">
              <button type="button" className="btn btn-secondary w-full" onClick={handleExport}>
                <Download size={16} /> Export File
              </button>
              
              <label className="btn btn-secondary w-full text-center" style={{ cursor: 'pointer' }}>
                <Upload size={16} /> Import File
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
              Local Security (PIN Lock)
            </h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Secure this application using a local PIN. If enabled, your mortgage values are AES-256 encrypted using your passcode as the key.
            </p>

            <div className="settings-item" style={{ borderBottom: 'none', padding: '0.5rem 0' }}>
              <div className="settings-item-info">
                <span className="settings-item-title">Passcode Protection</span>
                <span className="settings-item-desc">
                  {passcodeEnabled ? 'Locked with 4-digit PIN' : 'Unprotected (localStorage plaintext)'}
                </span>
              </div>
              <button 
                type="button" 
                className={`btn ${passcodeEnabled ? 'btn-danger' : 'btn-primary'} btn-sm`}
                onClick={() => setShowPinForm(!showPinForm)}
              >
                <Key size={14} /> {passcodeEnabled ? 'Disable PIN' : 'Enable PIN'}
              </button>
            </div>

            {/* PIN Setup Form */}
            {showPinForm && (
              <form onSubmit={handlePinSubmit} style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  {passcodeEnabled ? 'Enter current PIN to Disable' : 'Configure New 4-Digit PIN'}
                </h4>
                
                <div className="flex gap-4">
                  <div className="form-group w-full" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>PIN (4 Digits)</label>
                    <input 
                      type="password" 
                      maxLength={4}
                      placeholder="e.g. 1234"
                      className="form-input" 
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  {!passcodeEnabled && (
                    <div className="form-group w-full" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>PIN Hint (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="Hint description"
                        className="form-input" 
                        value={hint}
                        onChange={(e) => setHint(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary w-full mt-4 btn-sm">
                  Confirm Code
                </button>
              </form>
            )}

            {passcodeError && <p className="color-danger" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>{passcodeError}</p>}
            {passcodeSuccess && <p className="color-success" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>{passcodeSuccess}</p>}
          </div>

          {/* Destructive Actions Card */}
          <div className="card" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
            <h3 style={{ borderBottom: '1px solid rgba(239,68,68,0.2)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--color-danger)' }}>
              Danger Zone
            </h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Permanently wipe all mortgage parameters, passcode secrets, and checklists from local storage.
            </p>
            <button type="button" className="btn btn-danger w-full justify-between" onClick={handleClearData}>
              <span>Wipe Local Data</span>
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Legal & Compliance panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Privacy Compliance Card */}
          <div className="card">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Privacy Statement (PIPEDA & Loi 25)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <p style={{ margin: 0 }}>
                Mortimer is built to strictly adhere to the Canadian **Personal Information Protection and Electronic Documents Act (PIPEDA)** and Quebec's **Loi 25** (formerly Bill 64).
              </p>
              <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>
                  <strong>Zero Data Collection</strong>: We do not operate databases or backend web servers. None of your inputs leave your device.
                </li>
                <li>
                  <strong>Informed Consent</strong>: Calculations and settings are stored locally. Clearing cache or using "Wipe Local Data" immediately removes everything.
                </li>
                <li>
                  <strong>Encryption</strong>: Enforcing PIN lock derives keys inside the browser's sandbox using the Web Cryptography API, meaning no cleartext calculations can be read.
                </li>
              </ul>
            </div>
          </div>

          {/* Disclaimer Card */}
          <div className="card card-accent">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Disclaimer
            </h3>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <p style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: '0.5rem' }}>
                I am not a financial professional. This is not financial advice. Make your own decisions.
              </p>
              <p style={{ margin: 0 }}>
                Mortimer is an educational calculator for simulating mortgage paydowns and equity limits. Lending systems differ in interest rounding, compounding schedules, and adjustments. Always consult a licensed mortgage broker, financial planner, or bank advisor before signing agreements.
              </p>
            </div>
          </div>

          {/* GitHub Integration card */}
          <div className="card">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Open Source & Support
            </h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Spotted a mathematical inconsistency or want to suggest an improvement? Submit a ticket using our GitHub issue templates.
            </p>
            <a 
              href="https://github.com/michaelsanford/Mortimer/issues/new/choose" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-secondary w-full"
            >
              Report Issues / Math Errors
            </a>
          </div>

        </div>
      </div>
    </div>
  );
};
