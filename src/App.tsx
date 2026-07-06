import { useState, useEffect, lazy, Suspense } from 'react';
import { 
  Landmark, 
  Settings as SettingsIcon, 
  TrendingDown, 
  Percent, 
  Calculator, 
  LayoutDashboard,
  ShieldCheck,
  Globe,
  ChevronDown,
  ExternalLink,
  Printer
} from 'lucide-react';
import type { Locale } from './utils/i18n';
import type { MortgageInputs } from './utils/mortgageMath';
import { 
  loadProfile, 
  saveProfile, 
  getPasscodeConfig, 
  setAppLockedStatus 
} from './utils/storage';
import { useI18n } from './utils/i18n';
import { useServiceWorker } from './hooks/useServiceWorker';
import { UpdateBanner } from './components/UpdateBanner';

// Import components
// Dashboard is the default landing tab, so it stays statically imported.
// The remaining views are code-split via React.lazy so their code (and, for the
// calculator views, Chart.js) is only fetched when the tab is opened.
import { Dashboard } from './components/Dashboard';
const PaydownSimulator = lazy(() => import('./components/PaydownSimulator').then(m => ({ default: m.PaydownSimulator })));
const RateComparer = lazy(() => import('./components/RateComparer').then(m => ({ default: m.RateComparer })));
const HELOCPlanner = lazy(() => import('./components/HELOCPlanner').then(m => ({ default: m.HELOCPlanner })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const PasscodeLock = lazy(() => import('./components/PasscodeLock').then(m => ({ default: m.PasscodeLock })));

const appVersion = import.meta.env.VITE_APP_VERSION || 'v0.0.0-dev';
const isDev = appVersion === 'v0.0.0-dev';
const releaseUrl = isDev 
  ? 'https://github.com/michaelsanford/Mortimer/releases' 
  : `https://github.com/michaelsanford/Mortimer/releases/tag/${appVersion}`;

function App() {
  const { t, locale, setLocale } = useI18n();
  const { updateState, applyUpdate } = useServiceWorker();

  // Government of Canada (FCAC) mortgages guide — French page for the fr locale, English otherwise.
  const mortgageResourcesUrl = locale === 'fr'
    ? 'https://www.canada.ca/fr/agence-consommation-matiere-financiere/services/hypotheques.html'
    : 'https://www.canada.ca/en/financial-consumer-agency/services/mortgages.html';
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [profile, setProfile] = useState<MortgageInputs | null>(null);
  const [isAppLocked, setIsAppLocked] = useState<boolean>(false);
  const [currentPin, setCurrentPin] = useState<string>('');
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);

  // Close language dropdown on outside click
  useEffect(() => {
    if (!isLangOpen) return;
    const handleClose = () => setIsLangOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isLangOpen]);

  const languages: { code: Locale; label: string; short: string }[] = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'fr', label: 'Français', short: 'FR' },
    { code: 'zh', label: '简体中文', short: 'ZH' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ', short: 'PA' },
    { code: 'zh-HK', label: '繁體中文', short: 'HK' },
    { code: 'es', label: 'Español', short: 'ES' },
    { code: 'ar', label: 'العربية', short: 'AR' }
  ];

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
    void initApp();
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
            onNavigate={setActiveTab}
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
    return (
      <Suspense fallback={<div className="container" style={{ padding: '2rem' }} />}>
        <PasscodeLock onUnlock={handleUnlock} />
      </Suspense>
    );
  }

  // Primary navigation destinations (shared by the desktop top bar and the mobile bottom bar)
  const navItems = [
    { id: 'dashboard', label: t.nav.dashboard, Icon: LayoutDashboard },
    { id: 'paydown', label: t.nav.paydown, Icon: TrendingDown },
    { id: 'rate', label: t.nav.rate, Icon: Percent },
    { id: 'heloc', label: t.nav.heloc, Icon: Calculator },
    { id: 'settings', label: t.nav.settings, Icon: SettingsIcon },
  ];

  return (
    <>
      {updateState === 'update-available' && (
        <UpdateBanner onReload={applyUpdate} />
      )}
      {/* Top Header */}
      <header className="app-header">
        <div className="container header-content">
          <a href="#" className="logo" onClick={() => setActiveTab('dashboard')}>
            <div className="logo-icon">
              <Landmark size={20} />
            </div>
            <span>{t.app.name}</span>
          </a>

          {/* Navigation Bar (desktop) */}
          <nav className="tabs-navigation" aria-label={t.app.name}>
            {navItems.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`tab-btn ${activeTab === id ? 'active' : ''}`}
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Language Picker */}
          <div 
            className="language-dropdown-container"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={`language-dropdown-trigger ${isLangOpen ? 'open' : ''}`}
              onClick={() => setIsLangOpen(!isLangOpen)}
              aria-expanded={isLangOpen}
              aria-haspopup="listbox"
              aria-label={t.language.label}
            >
              <Globe size={14} />
              <span>{languages.find(l => l.code === locale)?.short || locale.toUpperCase()}</span>
              <ChevronDown size={12} className="language-dropdown-arrow" />
            </button>

            {isLangOpen && (
              <div className="language-dropdown-menu" role="listbox" aria-label={t.language.label}>
                {languages.map(({ code, label }) => (
                  <button
                    key={code}
                    type="button"
                    role="option"
                    aria-selected={locale === code}
                    className={`language-dropdown-item ${locale === code ? 'active' : ''}`}
                    onClick={() => {
                      setLocale(code);
                      setIsLangOpen(false);
                    }}
                  >
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="app-main" style={{ flexGrow: 1 }}>
        <div className="container">
          <Suspense fallback={<div className="container" style={{ padding: '2rem' }} />}>
            {renderTabContent()}
          </Suspense>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav" aria-label={t.app.name}>
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`mobile-nav-btn ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

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

          <div className="flex align-center justify-center mt-4" style={{ fontSize: '0.9rem' }}>
            <a
              href={mortgageResourcesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link flex align-center gap-2"
              style={{ fontWeight: 600, color: 'var(--color-primary)' }}
            >
              <ExternalLink size={16} />
              {t.footer.mortgageResources}
            </a>
          </div>

          <div className="footer-disclaimer">
            <strong>{t.footer.disclaimerLabel}</strong> {t.footer.disclaimer}
          </div>
          
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <a href="https://github.com/michaelsanford/Mortimer" target="_blank" rel="noopener noreferrer" className="footer-link">{t.footer.copyright}</a>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            {isDev ? (
              <span>{appVersion}</span>
            ) : (
              <a href={releaseUrl} target="_blank" rel="noopener noreferrer" className="footer-link">
                {appVersion}
              </a>
            )}
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

      {/* Floating Print Report Action */}
      <button
        onClick={() => window.print()}
        className="no-print"
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary)',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          transition: 'transform 0.2s ease, background-color 0.2s ease',
        }}
        title={t.dashboard?.printReport || 'Print / Export PDF'}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.backgroundColor = 'var(--color-primary-hover, var(--color-primary))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = 'var(--color-primary)';
        }}
      >
        <Printer size={22} />
      </button>
    </>
  );
}

export default App;
