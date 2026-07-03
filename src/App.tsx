import { useState, useEffect } from 'react';
import { 
  Landmark, 
  Settings as SettingsIcon, 
  TrendingDown, 
  Percent, 
  Calculator, 
  LayoutDashboard,
  ShieldCheck
} from 'lucide-react';
import type { MortgageInputs } from './utils/mortgageMath';
import { 
  loadProfile, 
  saveProfile, 
  getPasscodeConfig, 
  setAppLockedStatus 
} from './utils/storage';

// Import components
import { Dashboard } from './components/Dashboard';
import { PaydownSimulator } from './components/PaydownSimulator';
import { RateComparer } from './components/RateComparer';
import { HELOCPlanner } from './components/HELOCPlanner';
import { Settings } from './components/Settings';
import { PasscodeLock } from './components/PasscodeLock';

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [profile, setProfile] = useState<MortgageInputs | null>(null);
  const [isAppLocked, setIsAppLocked] = useState<boolean>(false);
  const [currentPin, setCurrentPin] = useState<string>('');

  // Initial load
  useEffect(() => {
    const initApp = async () => {
      const passcodeConfig = getPasscodeConfig();
      if (passcodeConfig?.isEnabled) {
        setIsAppLocked(true);
        setAppLockedStatus(true);
      } else {
        const loadedProfile = await loadProfile();
        setProfile(loadedProfile);
      }
    };
    initApp();
  }, []);

  // Unlock callback
  const handleUnlock = async (pin: string) => {
    setCurrentPin(pin);
    setIsAppLocked(false);
    setAppLockedStatus(false);
    
    // Load profile using the PIN to decrypt
    const loadedProfile = await loadProfile(pin);
    if (loadedProfile && !loadedProfile.__isEncrypted) {
      setProfile(loadedProfile);
    }
  };

  // Profile update callback
  const handleSaveProfile = async (newProfile: MortgageInputs) => {
    setProfile(newProfile);
    await saveProfile(newProfile, currentPin || undefined);
  };

  // Reload profile after settings import
  const handleReloadProfile = async () => {
    const loadedProfile = await loadProfile(currentPin || undefined);
    setProfile(loadedProfile);
    setActiveTab('dashboard');
  };

  // Clear profile data state
  const handleClearProfile = () => {
    setProfile(null);
    setCurrentPin('');
    setActiveTab('dashboard');
  };

  // Render active tab view
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard profile={profile} onNavigate={setActiveTab} />;
      case 'paydown':
        return (
          <PaydownSimulator 
            initialProfile={profile} 
            onSaveProfile={handleSaveProfile} 
          />
        );
      case 'rate':
        return (
          <RateComparer 
            profile={profile}
            onSaveProfile={handleSaveProfile}
          />
        );
      case 'heloc':
        return (
          <HELOCPlanner 
            currentHomeValue={1.5 * (profile?.principal || 500000)}
            currentBalance={profile?.principal || 0}
          />
        );
      case 'settings':
        return (
          <Settings 
            onClearProfile={handleClearProfile} 
            onImportSuccess={handleReloadProfile} 
            currentPin={currentPin}
          />
        );
      default:
        return <Dashboard profile={profile} onNavigate={setActiveTab} />;
    }
  };

  // Show PIN entry screen if locked
  if (isAppLocked) {
    return <PasscodeLock onUnlock={handleUnlock} />;
  }

  return (
    <>
      {/* Top Header */}
      <header className="app-header">
        <div className="container header-content">
          <a href="#" className="logo" onClick={() => setActiveTab('dashboard')}>
            <div className="logo-icon">
              <Landmark size={20} />
            </div>
            <span>Mortimer</span>
          </a>

          {/* Navigation Bar */}
          <nav className="tabs-navigation">
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </button>
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'paydown' ? 'active' : ''}`}
              onClick={() => setActiveTab('paydown')}
            >
              <TrendingDown size={16} />
              <span>Paydown Simulator</span>
            </button>
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'rate' ? 'active' : ''}`}
              onClick={() => setActiveTab('rate')}
            >
              <Percent size={16} />
              <span>Rates Comparer</span>
            </button>
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'heloc' ? 'active' : ''}`}
              onClick={() => setActiveTab('heloc')}
            >
              <Calculator size={16} />
              <span>Reno & HELOC</span>
            </button>
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <SettingsIcon size={16} />
              <span>Settings</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flexGrow: 1, padding: '2rem 0' }}>
        <div className="container">
          {renderTabContent()}
        </div>
      </main>

      {/* App Footer */}
      <footer className="app-footer">
        <div className="container">
          <div className="footer-links">
            <a href="#" className="footer-link" onClick={() => setActiveTab('dashboard')}>Dashboard</a>
            <a href="#" className="footer-link" onClick={() => setActiveTab('paydown')}>Paydowns</a>
            <a href="#" className="footer-link" onClick={() => setActiveTab('rate')}>Renewal & Refinance</a>
            <a href="#" className="footer-link" onClick={() => setActiveTab('heloc')}>Reno & HELOC Planner</a>
            <a href="#" className="footer-link" onClick={() => setActiveTab('settings')}>Settings & Privacy</a>
          </div>

          <div className="flex align-center justify-center gap-4 mt-4" style={{ fontSize: '0.85rem' }}>
            <a 
              href="#" 
              className="footer-link flex align-center gap-2" 
              onClick={(e) => { e.preventDefault(); setActiveTab('settings'); }}
            >
              <ShieldCheck size={16} style={{ color: 'var(--color-success)' }} />
              PIPEDA Compliant
            </a>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <a 
              href="#" 
              className="footer-link flex align-center gap-2" 
              onClick={(e) => { e.preventDefault(); setActiveTab('settings'); }}
            >
              <ShieldCheck size={16} style={{ color: 'var(--color-success)' }} />
              Loi 25 (Quebec) Compliant
            </a>
          </div>

          <div className="footer-disclaimer">
            <strong>Disclaimer:</strong> I am not a financial professional. This is not financial advice. Make your own decisions. All calculation models are provided for informational and educational purposes only. Mortimer does not collect, store, or transmit your personal data.
          </div>
          
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>&copy; {new Date().getFullYear()} Mortimer.</span>
            <a href="https://github.com/michaelsanford/Mortimer" target="_blank" rel="noopener noreferrer" className="footer-link">
              Hosted on GitHub Pages
            </a>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <a href="https://github.com/michaelsanford/Mortimer/issues" target="_blank" rel="noopener noreferrer" className="footer-link">
              Report an Issue
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
