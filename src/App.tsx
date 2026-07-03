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
import { useI18n } from './utils/i18n';

// Import components
import { Dashboard } from './components/Dashboard';
import { PaydownSimulator } from './components/PaydownSimulator';
import { RateComparer } from './components/RateComparer';
import { HELOCPlanner } from './components/HELOCPlanner';
import { Settings } from './components/Settings';
import { PasscodeLock } from './components/PasscodeLock';

function App() {
  const { t, locale, setLocale } = useI18n();
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
            onUpdatePin={setCurrentPin}
            profile={profile}
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
            <span>{t.app.name}</span>
          </a>

          {/* Navigation Bar */}
          <nav className="tabs-navigation">
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={16} />
              <span>{t.nav.dashboard}</span>
            </button>
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'paydown' ? 'active' : ''}`}
              onClick={() => setActiveTab('paydown')}
            >
              <TrendingDown size={16} />
              <span>{t.nav.paydown}</span>
            </button>
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'rate' ? 'active' : ''}`}
              onClick={() => setActiveTab('rate')}
            >
              <Percent size={16} />
              <span>{t.nav.rate}</span>
            </button>
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'heloc' ? 'active' : ''}`}
              onClick={() => setActiveTab('heloc')}
            >
              <Calculator size={16} />
              <span>{t.nav.heloc}</span>
            </button>
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <SettingsIcon size={16} />
              <span>{t.nav.settings}</span>
            </button>
          </nav>

          {/* Language Picker */}
          <div 
            className="language-picker" 
            role="radiogroup" 
            aria-label={t.language.label}
            style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: '0.75rem', fontWeight: 600 }}
          >
            <button
              type="button"
              onClick={() => setLocale('en')}
              aria-pressed={locale === 'en'}
              style={{
                background: locale === 'en' ? 'var(--color-accent)' : 'transparent',
                color: locale === 'en' ? 'white' : 'var(--text-secondary)',
                border: '1px solid ' + (locale === 'en' ? 'var(--color-accent)' : 'var(--border-color)'),
                borderRight: 'none',
                borderRadius: '0.375rem 0 0 0.375rem',
                padding: '0.3rem 0.5rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.7rem',
                lineHeight: 1,
                transition: 'all 0.15s ease',
              }}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLocale('fr')}
              aria-pressed={locale === 'fr'}
              style={{
                background: locale === 'fr' ? 'var(--color-accent)' : 'transparent',
                color: locale === 'fr' ? 'white' : 'var(--text-secondary)',
                border: '1px solid ' + (locale === 'fr' ? 'var(--color-accent)' : 'var(--border-color)'),
                borderRadius: '0 0.375rem 0.375rem 0',
                padding: '0.3rem 0.5rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.7rem',
                lineHeight: 1,
                transition: 'all 0.15s ease',
              }}
            >
              FR
            </button>
          </div>
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
            <a href="#" className="footer-link" onClick={() => setActiveTab('dashboard')}>{t.footer.dashboard}</a>
            <a href="#" className="footer-link" onClick={() => setActiveTab('paydown')}>{t.footer.paydowns}</a>
            <a href="#" className="footer-link" onClick={() => setActiveTab('rate')}>{t.footer.renewal}</a>
            <a href="#" className="footer-link" onClick={() => setActiveTab('heloc')}>{t.footer.heloc}</a>
            <a href="#" className="footer-link" onClick={() => setActiveTab('settings')}>{t.footer.settings}</a>
          </div>

          <div className="flex align-center justify-center gap-4 mt-4" style={{ fontSize: '0.85rem' }}>
            <a 
              href="#" 
              className="footer-link flex align-center gap-2" 
              onClick={(e) => { e.preventDefault(); setActiveTab('settings'); }}
            >
              <ShieldCheck size={16} style={{ color: 'var(--color-success)' }} />
              {t.footer.pipeda}
            </a>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <a 
              href="#" 
              className="footer-link flex align-center gap-2" 
              onClick={(e) => { e.preventDefault(); setActiveTab('settings'); }}
            >
              <ShieldCheck size={16} style={{ color: 'var(--color-success)' }} />
              {t.footer.loi25}
            </a>
          </div>

          <div className="footer-disclaimer">
            <strong>{t.footer.disclaimerLabel}</strong> {t.footer.disclaimer}
          </div>
          
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>{t.footer.copyright.replace('{year}', String(new Date().getFullYear()))}</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <a href="https://github.com/michaelsanford/Mortimer/issues" target="_blank" rel="noopener noreferrer" className="footer-link">
              {t.footer.reportIssue}
            </a>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <a href="https://github.com/michaelsanford/Mortimer/security/advisories/new" target="_blank" rel="noopener noreferrer" className="footer-link">
              {t.footer.reportSecurity}
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
